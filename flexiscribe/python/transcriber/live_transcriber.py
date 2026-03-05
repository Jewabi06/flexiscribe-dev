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

from summarizer.summarizer import summarize_minute, summarize_cornell_from_summaries, summarize_motm
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
    timestamp = time.strftime("%H:%M:%S")

    # ── Save transcript chunk immediately (fast, no Ollama) ───────
    chunk = {
        "minute": minute_counter,
        "timestamp": timestamp,
        "text": combined_text,
    }
    session.transcript_chunks.append(chunk)
    write_json(session.get_transcript_json(), session.transcript_path)
    print(f"[TRANSCRIPT] Minute {minute_counter}: {combined_text[:80]}...")

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
            else:
                print("[INFO] Generating final Cornell summary from minute summaries...")
                try:
                    cornell = summarize_cornell_from_summaries(summaries_text)
                    session.final_summary = cornell
                    write_json(
                        session.get_final_summary_json(),
                        session.final_summary_path,
                    )
                    print("[INFO] Final Cornell summary generated.")
                except Exception as e:
                    print(f"[ERROR] Final Cornell summary failed: {e}")
                    session.final_summary = {
                        "title": f"Lecture - {session.course_code}",
                        "key_concepts": [],
                        "notes": [{"term": "Summary", "definition": "Summary generation failed. Minute summaries available.", "example": ""}],
                        "summary": ["Review the per-minute summaries for details."],
                    }

        session.status = "completed"
        print(f"[INFO] Session {session.session_id} completed.")

    except Exception as e:
        session.status = "error"
        print(f"[ERROR] Summarization worker error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        executor.shutdown(wait=False)
