"""
Timer-based summarisation worker — fully decoupled from Whisper and
non-blocking for per-minute summaries.
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
from config import BUFFER_INTERVAL, SUMMARY_MAX_WORKERS, OLLAMA_CORNELL_MODEL

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
    timestamp = session.get_elapsed_timestamp()

    chunk = {
        "minute": minute_counter,
        "timestamp": timestamp,
        "text": combined_text,
    }
    session.transcript_chunks.append(chunk)
    write_json(session.get_transcript_json(), session.transcript_path)
    aggregated_data = {
        "metadata": {
            "session_id": session.session_id,
            "run_id": session.run_id,
        },
        "chunks": session.transcript_chunks,
    }
    write_json(aggregated_data, session.aggregated_transcript_path)
    print(f"[TRANSCRIPT] Minute {minute_counter} at {timestamp}: {combined_text[:80]}...")

    future = executor.submit(
        _summarize_minute_task, session, combined_text, minute_counter, timestamp,
    )
    futures.append(future)
    print(f"[SUMMARY] Minute {minute_counter} queued for background summarization.")

    return new_idx, minute_counter

def _generate_final_summary(session):
    """Generate final Cornell/MOTM and trigger callback if transcription_id exists."""
    from config import OLLAMA_CORNELL_MODEL
    print(f"[INFO] Generating final summary using remote model: {OLLAMA_CORNELL_MODEL}")
    successful_final_summary = False

    # --- (existing fallback logic remains unchanged) ---
    if not session.minute_summaries and session.transcript_chunks:
        print("[INFO] No minute summaries found; building from transcript chunks.")
        for idx, chunk in enumerate(session.transcript_chunks, 1):
            session.minute_summaries.append({
                "minute": idx,
                "timestamp": chunk.get("timestamp", ""),
                "summary": chunk.get("text", "")[:500],
                "key_points": []
            })

    if session.minute_summaries:
        summaries_text = _format_minute_summaries(session.minute_summaries)

        if getattr(session, "session_type", "lecture") == "meeting":
            print("[INFO] Generating Minutes of the Meeting (MOTM)...")
            full_text = "\n".join(c["text"] for c in session.transcript_chunks)
            try:
                motm = summarize_motm(full_text)
                if motm and (motm.get("agendas") or motm.get("meeting_title")):
                    session.final_summary = motm
                    successful_final_summary = True
                else:
                    raise ValueError("Empty MOTM result")
            except Exception as e:
                print(f"[ERROR] MOTM generation failed: {e}")
                session.final_summary = {
                    "meeting_title": f"Meeting - {session.course_code}",
                    "date": "Not specified",
                    "time": "Not specified",
                    "agendas": [],
                    "next_meeting": "To be announced",
                    "prepared_by": "To be determined",
                }
                successful_final_summary = True
        else:
            print("[INFO] Generating context-aware Cornell summary...")
            try:
                cornell = summarize_cornell_context_aware(
                    session.transcript_chunks,
                    session.minute_summaries,
                )
                if cornell and (cornell.get("notes") or cornell.get("key_concepts")):
                    session.final_summary = cornell
                    successful_final_summary = True
                else:
                    raise ValueError("Empty Cornell result")
            except Exception as e:
                print(f"[ERROR] Final Cornell summary failed: {e}")
                # Fallback Cornell (simplified)
                fallback_notes = []
                fallback_concepts = set()
                for ms in session.minute_summaries:
                    minute_num = ms.get("minute")
                    summary_text = ms.get("summary", "")
                    key_points = ms.get("key_points", [])
                    if summary_text:
                        fallback_notes.append({
                            "term": f"Minute {minute_num}",
                            "definition": summary_text,
                            "example": " ".join(key_points[:2]) if key_points else ""
                        })
                    for kp in key_points:
                        words = kp.split()[:4]
                        if words:
                            fallback_concepts.add(" ".join(words))
                session.final_summary = {
                    "title": f"Lecture - {session.course_code}",
                    "key_concepts": list(fallback_concepts)[:20],
                    "notes": fallback_notes,
                    "summary": [f"Minute {ms.get('minute')}: {ms.get('summary', '')[:200]}" 
                               for ms in session.minute_summaries if ms.get('summary')]
                }
                successful_final_summary = True
    else:
        print("[INFO] No minute summaries or transcript chunks available; creating minimal summary.")
        session.final_summary = {
            "title": f"Lecture - {session.course_code}",
            "key_concepts": [],
            "notes": [{"term": "No content", "definition": "No transcript was captured.", "example": ""}],
            "summary": ["No transcript available to summarize."],
        }
        successful_final_summary = True

    session.status = "completed" if successful_final_summary else "error"
    from session_manager import session_manager
    session_manager.update_session_status(session.session_id, session.status)
    print(f"[INFO] Session {session.session_id} final status={session.status}.")

    # ─── Trigger callback if transcription_id exists ─────────────────
    if session.transcription_id and session.final_summary:
        try:
            from main import _save_pending_callback_job, _deliver_callback_job
            job = {
                "session_id": session.session_id,
                "transcription_id": session.transcription_id,
                "final_summary": session.final_summary,
            }
            _save_pending_callback_job(job)
            _deliver_callback_job(job)
        except Exception as e:
            print(f"[ERROR] Failed to trigger callback: {e}")

def summarization_worker(stop_event: threading.Event, session):
    """
    Timer-based summarisation with non-blocking per-minute summaries.
    """
    last_processed_idx = 0
    minute_counter = 0
    futures: List[Future] = []

    executor = ThreadPoolExecutor(
        max_workers=SUMMARY_MAX_WORKERS,
        thread_name_prefix="minute-summary",
    )

    try:
        while not stop_event.is_set():
            stopped = stop_event.wait(timeout=BUFFER_INTERVAL)
            if stopped:
                break
            last_processed_idx, minute_counter = _collect_and_submit(
                session, last_processed_idx, minute_counter, executor, futures,
            )

        print("[INFO] Summarizer waiting for whisper_done...")
        got_it = session.whisper_done.wait(timeout=60)
        if got_it:
            print("[INFO] Whisper done — processing remaining chunks.")
        else:
            print("[WARN] whisper_done timed out after 60 s — processing what we have.")

        last_processed_idx, minute_counter = _collect_and_submit(
            session, last_processed_idx, minute_counter, executor, futures,
        )

        pending = [f for f in futures if not f.done()]
        if pending:
            print(f"[INFO] Waiting for {len(pending)} in-flight minute summaries...")
        for f in as_completed(futures):
            try:
                f.result()
            except Exception as e:
                print(f"[ERROR] Summary future raised: {e}")
        print(f"[INFO] All minute summaries complete: {len(session.minute_summaries)} summaries.")

        session.minutes_done.set()
        print(f"[INFO] minutes_done signalled — {len(session.minute_summaries)} summaries ready.")

        _generate_final_summary(session)

    except Exception as e:
        session.status = "error"
        from session_manager import session_manager
        session_manager.update_session_status(session.session_id, "error")
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
    transcript_chunks = transcript_json.get("chunks") if isinstance(transcript_json, dict) else None
    if transcript_chunks is None or not isinstance(transcript_chunks, list):
        raise ValueError("Invalid transcript_json: expected an object with a chunks array")
    try:
        if minute_summaries and isinstance(minute_summaries, list) and len(minute_summaries) > 0:
            if session_type == "meeting":
                full_text = "\n".join(c.get("text", "") for c in transcript_chunks)
                return summarize_motm(full_text)
            return summarize_cornell_context_aware(transcript_chunks, minute_summaries)
        full_text = "\n".join(c.get("text", "") for c in transcript_chunks)
        return _summarize_text_multipass(full_text)
    except Exception as e:
        print(f"[ERROR] Summary generation failed after all retries: {e}")
        raise RuntimeError(f"Summarization failed: {e}") from e

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