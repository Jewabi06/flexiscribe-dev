"""
Timer-based summarisation worker — fully decoupled from Whisper and
non-blocking for per-minute summaries.

Architecture (optimised for Jetson Orin Nano — 7.4 GB shared VRAM):

1. **Chunk collection** runs on a strict BUFFER_INTERVAL (60 s) timer.
   It snapshots all new live_chunks and saves the aggregated transcript.
   This NEVER blocks — no Ollama call on this path.

2. **Per-minute summaries** are submitted to a ThreadPoolExecutor
   (SUMMARY_MAX_WORKERS threads, default 2).  Ollama runs CPU-only
   (num_gpu=0) so the GPU stays 100 % free for Whisper.  Having 2
   workers lets the next summary start while the previous one finishes.

3. On stop, the worker waits for whisper_done (so no audio is lost),
   collects final chunks, then waits for ALL in-flight summary futures
   before signalling minutes_done.

4. The final Cornell / MOTM generation happens after minutes_done.

This eliminates the blocking-summary bottleneck that caused only 1 out
of ~5 minute summaries to complete in the previous design.
"""

import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed, Future
from typing import List

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from summarizer.summarizer import summarize_minute, summarize_cornell_context_aware, summarize_cornell, summarize_motm
from utils.json_writer import write_json
from config import BUFFER_INTERVAL, SUMMARY_MAX_WORKERS


def _format_minute_summaries(minute_summaries):
    """Format minute summary dicts into a structured text block for the Cornell prompt."""
    parts = []
    for ms in minute_summaries:
        minute_num = ms.get("minute", "?")
        timestamp = ms.get("timestamp", "")
        summary = ms.get("summary", "")
        key_points = ms.get("key_points", [])
        block = f"Minute {minute_num} ({timestamp}):\nSummary: {summary}"
        if key_points:
            block += "\nKey points:\n" + "\n".join(f"- {kp}" for kp in key_points)
        parts.append(block)
    return "\n\n".join(parts)


# ── Thread-pool task: generate one minute summary (runs on CPU) ───────────

def _summarize_minute_task(session, combined_text: str, minute_num: int, timestamp: str):
    """
    Called inside a ThreadPoolExecutor worker.  Generates a per-minute
    summary via Ollama (CPU-only) and thread-safely appends the result.
    """
    try:
        summary = summarize_minute(combined_text)
        minute_summary = {
            "minute": minute_num,
            "timestamp": timestamp,
            **summary,
        }
        with session.summary_lock:
            session.minute_summaries.append(minute_summary)
            # Keep summaries sorted by minute number (threads may finish out-of-order)
            session.minute_summaries.sort(key=lambda x: x["minute"])
        write_json(session.get_summary_json(), session.minute_summary_path)
        print(f"[SUMMARY] Minute {minute_num} summarized.")
    except Exception as e:
        print(f"[ERROR] Minute summary failed for minute {minute_num}: {e}")


# ── Collect new chunks + submit summary (non-blocking) ────────────────────

def _collect_and_submit(session, last_processed_idx: int, minute_counter: int,
                        executor: ThreadPoolExecutor, futures: List[Future]):
    """
    Snapshot new live_chunks since *last_processed_idx*, save the
    aggregated transcript immediately, and submit a per-minute summary
    to the thread pool **without blocking**.

    Returns (new_last_processed_idx, new_minute_counter).
    """
    current_chunks = session.live_chunks[last_processed_idx:]
    if not current_chunks:
        return last_processed_idx, minute_counter

    new_idx = len(session.live_chunks)
    combined_text = " ".join(c["text"] for c in current_chunks).strip()
    if not combined_text:
        return new_idx, minute_counter

    minute_counter += 1
    # Use 0-based elapsed time instead of wall clock time
    timestamp = session.get_elapsed_timestamp()

    # ── Save transcript chunk immediately (fast, no Ollama) ───────
    chunk = {
        "minute": minute_counter,
        "timestamp": timestamp,
        "text": combined_text,
    }
    session.transcript_chunks.append(chunk)
    write_json(session.get_transcript_json(), session.transcript_path)
    print(f"[TRANSCRIPT] Minute {minute_counter} at {timestamp}: {combined_text[:80]}...")

    # ── Submit summary to thread pool (non-blocking) ─────────────
    future = executor.submit(
        _summarize_minute_task, session, combined_text, minute_counter, timestamp,
    )
    futures.append(future)
    print(f"[SUMMARY] Minute {minute_counter} queued for background summarization.")

    return new_idx, minute_counter


def summarization_worker(stop_event: threading.Event, session):
    """
    Timer-based summarisation with non-blocking per-minute summaries.

    Chunk collection runs every BUFFER_INTERVAL seconds on the main thread.
    Ollama summaries run in a ThreadPoolExecutor so they never delay the
    next collection cycle.  On Jetson Orin Nano the GPU stays free for
    Whisper while Ollama uses CPU threads.
    """
    last_processed_idx = 0  # index into session.live_chunks
    minute_counter = 0
    futures: List[Future] = []

    executor = ThreadPoolExecutor(
        max_workers=SUMMARY_MAX_WORKERS,
        thread_name_prefix="minute-summary",
    )

    try:
        # ── Main loop: collect chunks every BUFFER_INTERVAL ───────────
        while not stop_event.is_set():
            stopped = stop_event.wait(timeout=BUFFER_INTERVAL)

            if stopped:
                break  # handle remaining chunks below

            last_processed_idx, minute_counter = _collect_and_submit(
                session, last_processed_idx, minute_counter, executor, futures,
            )

        # ── After stop: wait for whisper to finish final audio ────────
        print("[INFO] Summarizer waiting for whisper_done...")
        got_it = session.whisper_done.wait(timeout=60)
        if got_it:
            print("[INFO] Whisper done — processing remaining chunks.")
        else:
            print("[WARN] whisper_done timed out after 60 s — processing what we have.")

        # Collect any chunks added since the last cycle
        last_processed_idx, minute_counter = _collect_and_submit(
            session, last_processed_idx, minute_counter, executor, futures,
        )

        # ── Wait for ALL in-flight minute summaries to finish ─────────
        # On Jetson CPU this is the only blocking wait; summaries that
        # were submitted during transcription should mostly be done already.
        pending = [f for f in futures if not f.done()]
        if pending:
            print(f"[INFO] Waiting for {len(pending)} in-flight minute summaries...")
        for f in as_completed(futures):
            try:
                f.result()  # propagate any exceptions
            except Exception as e:
                print(f"[ERROR] Summary future raised: {e}")
        print(f"[INFO] All minute summaries complete: {len(session.minute_summaries)} summaries.")

        # ── Signal that all minute summaries are done ────────────────
        session.minutes_done.set()
        print(f"[INFO] minutes_done signalled — {len(session.minute_summaries)} summaries ready.")

        successful_final_summary = False

        # ── Generate final summary from minute summaries ─────────────
        if session.minute_summaries:
            summaries_text = _format_minute_summaries(session.minute_summaries)

            if getattr(session, "session_type", "lecture") == "meeting":
                print("[INFO] Generating Minutes of the Meeting (MOTM)...")
                full_text = "\n".join(c["text"] for c in session.transcript_chunks)
                try:
                    motm = summarize_motm(full_text)
                    session.final_summary = motm
                    write_json(
                        session.get_final_summary_json(),
                        session.final_summary_path,
                    )
                    print("[INFO] MOTM generated successfully.")
                    successful_final_summary = True
                except Exception as e:
                    print(f"[ERROR] MOTM generation failed: {e}")
                    session.final_summary = {
                        "meeting_title": f"Meeting - {session.course_code}",
                        "date": "Not specified",
                        "time": "Not specified",
                        "speaker": "",
                        "agendas": [],
                        "next_meeting": {"date": "To be announced", "time": "To be announced"},
                        "prepared_by": "To be determined",
                    }
                    successful_final_summary = False
            else:
                print("[INFO] Generating context-aware Cornell summary...")
                try:
                    cornell = summarize_cornell_context_aware(
                        session.transcript_chunks,
                        session.minute_summaries,
                    )
                    session.final_summary = cornell
                    write_json(
                        session.get_final_summary_json(),
                        session.final_summary_path,
                    )
                    print("[INFO] Final Cornell summary generated.")
                    successful_final_summary = True
                except Exception as e:
                    print(f"[ERROR] Final Cornell summary failed: {e}")
                    session.final_summary = {
                        "title": f"Lecture - {session.course_code}",
                        "key_concepts": [],
                        "notes": [],
                        "summary": ["Summary generation failed. Minute summaries available."],
                    }
                    successful_final_summary = False
        else:
            print("[INFO] No minute summaries available; generating fallback final summary.")
            transcript_text = "\n".join(c.get("text", "") for c in session.transcript_chunks)
            if transcript_text.strip():
                try:
                    fallback_cornell = summarize_cornell(transcript_text)
                    session.final_summary = fallback_cornell
                    write_json(
                        session.get_final_summary_json(),
                        session.final_summary_path,
                    )
                    print("[INFO] Fallback Cornell summary generated from transcript chunks.")
                    successful_final_summary = True
                except Exception as e:
                    print(f"[ERROR] Fallback Cornell summary failed: {e}")
                    session.final_summary = {
                        "title": f"Lecture - {session.course_code}",
                        "key_concepts": [],
                        "notes": [],
                        "summary": ["No minute summaries available, and fallback generation failed."],
                    }
                    successful_final_summary = False
            else:
                session.final_summary = {
                    "title": f"Lecture - {session.course_code}",
                    "key_concepts": [],
                    "notes": [],
                    "summary": ["No transcript text available to summarize."],
                }
                successful_final_summary = False

        session.status = "completed" if successful_final_summary else "error"
        print(f"[INFO] Session {session.session_id} final status={session.status}.")
    except Exception as e:
        session.status = "error"
        print(f"[ERROR] Summarization worker error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        executor.shutdown(wait=False)


def generate_summary_from_transcript_json(
    transcript_json: dict,
    minute_summaries: list | None = None,
    session_type: str = "lecture",
    course_code: str = "",
) -> dict:
    """Generate a final Cornell/MOTM summary from transcriptJson and minute summaries."""
    # The frontend must not mutate transcriptJson here.
    # Use the existing summarization pipeline implementation.
    transcript_chunks = transcript_json.get("chunks") if isinstance(transcript_json, dict) else None

    if transcript_chunks is None or not isinstance(transcript_chunks, list):
        raise ValueError("Invalid transcript_json: expected an object with a chunks array")

    try:
        if minute_summaries and isinstance(minute_summaries, list) and len(minute_summaries) > 0:
            if session_type == "meeting":
                # MOTM generation from full transcript
                full_text = "\n".join(c.get("text", "") for c in transcript_chunks)
                return summarize_motm(full_text)
            # Lecture: context-aware Cornell using minute summaries and transcript chunks
            return summarize_cornell_context_aware(transcript_chunks, minute_summaries)

        # No valid minute summaries available: fallback Cornell from full text (multipass for long transcripts)
        full_text = "\n".join(c.get("text", "") for c in transcript_chunks)
        return _summarize_text_multipass(full_text)

    except Exception as e:
        # Fail-safe fallback summary (avoids crashing when Ollama is unavailable)
        print(f"[WARN] Summary provider failed: {e}")
        return {
            "title": f"Fallback summary for {course_code or 'transcript'}",
            "key_concepts": [],
            "notes": [],
            "summary": [
                "Summary generation failed. Generated fallback from transcript chunks."
            ],
        }


def _split_text_for_ollama(full_text: str, max_chars: int = 28000):
    """Split a long transcript text into manageable chunks for Ollama."""
    if not full_text:
        return []
    if len(full_text) <= max_chars:
        return [full_text]

    words = full_text.split()
    chunks = []
    current = []
    current_len = 0

    for word in words:
        if current_len + len(word) + 1 > max_chars and current:
            chunks.append(" ".join(current))
            current = [word]
            current_len = len(word) + 1
        else:
            current.append(word)
            current_len += len(word) + 1

    if current:
        chunks.append(" ".join(current))

    return chunks


def _summarize_text_multipass(full_text: str) -> dict:
    """Summarize long transcript text in chunks and merge them safely."""
    from summarizer.summarizer import summarize_cornell, summarize_cornell_remote

    chunks = _split_text_for_ollama(full_text)
    if not chunks:
        raise ValueError("No transcript text to summarize")

    def _local_or_remote_summarize(text_to_summarize):
        try:
            # prefer remote GPU for longer inputs
            return summarize_cornell_remote(text_to_summarize)
        except Exception as e:
            print(f"[SUMMARIZER] Remote Cornell summarization failed: {e}. Falling back to local model.")
            return summarize_cornell(text_to_summarize)

    if len(chunks) == 1:
        return _local_or_remote_summarize(full_text)

    partial_summaries = []
    for idx, chunk in enumerate(chunks, start=1):
        print(f"[SUMMARIZER] multipass chunk {idx}/{len(chunks)} (len={len(chunk)} chars)")
        short = _local_or_remote_summarize(chunk)
        partial_summaries.append(" ".join(short.get("summary", [])))

    combined = " \n\n".join(partial_summaries)
    print("[SUMMARIZER] generating final summary from chunk partials")
    return _local_or_remote_summarize(combined)
