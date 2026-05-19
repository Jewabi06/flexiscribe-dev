"""
Timer-based summarisation worker — fully decoupled from Whisper and
non-blocking for per-minute summaries.
"""
import time
import threading
import json
from concurrent.futures import ThreadPoolExecutor, as_completed, Future
from typing import List

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from summarizer.summarizer import summarize_minute, summarize_cornell_context_aware, summarize_motm
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
    """Generate final Cornell/MOTM using remote Ollama with automatic retries (no fallback)."""
    from config import OLLAMA_CORNELL_MODEL
    print(f"[INFO] Generating final summary using remote model: {OLLAMA_CORNELL_MODEL}")

    max_attempts = 3
    for attempt in range(max_attempts):
        try:
            if getattr(session, "session_type", "lecture") == "meeting":
                print("[INFO] Generating Minutes of the Meeting (MOTM)...")
                full_text = "\n".join(c["text"] for c in session.transcript_chunks)
                motm = summarize_motm(full_text)
                session.final_summary = motm
                print(f"[INFO] MOTM generated successfully on attempt {attempt+1}")
                break
            else:
                print("[INFO] Generating context-aware Cornell summary...")
                cornell = summarize_cornell_context_aware(
                    session.transcript_chunks,
                    session.minute_summaries,
                )
                session.final_summary = cornell
                print(f"[INFO] Cornell summary generated successfully on attempt {attempt+1}")
                break
        except Exception as e:
            print(f"[ERROR] Final summary attempt {attempt+1} failed: {e}")
            if attempt == max_attempts - 1:
                # All attempts failed – store error, no callback
                session.final_summary_error = str(e)
                session.status = "error"
                from session_manager import session_manager
                session_manager.update_session_status(session.session_id, "error")
                print(f"[ERROR] Session {session.session_id} marked as error after {max_attempts} failed attempts.")
                return
            time.sleep(2 ** attempt)   # exponential backoff before retry

    session.status = "completed"
    from session_manager import session_manager
    session_manager.update_session_status(session.session_id, "completed")
    print(f"[INFO] Session {session.session_id} final status=completed.")

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
    """Generate a final Cornell/MOTM summary from transcriptJson and minute summaries (robust input handling)."""
    # Normalize transcript_json to a list of chunks
    chunks = None
    if isinstance(transcript_json, dict):
        chunks = transcript_json.get("chunks")
    if chunks is None and isinstance(transcript_json, list):
        chunks = transcript_json
    if chunks is None and isinstance(transcript_json, str):
        try:
            parsed = json.loads(transcript_json)
            if isinstance(parsed, dict):
                chunks = parsed.get("chunks")
            elif isinstance(parsed, list):
                chunks = parsed
        except json.JSONDecodeError:
            pass

    if not chunks or not isinstance(chunks, list):
        # Last resort: try to reconstruct from minute_summaries
        if minute_summaries:
            full_text = " ".join(ms.get("summary", "") for ms in minute_summaries)
            chunks = [{"text": full_text, "timestamp": ""}]
        else:
            raise ValueError(
                "Invalid transcript_json: expected an object with a 'chunks' array, "
                "a list of chunk objects, or a JSON string. No minute_summaries available."
            )

    # Ensure each chunk has at least 'text'
    normalized_chunks = []
    for c in chunks:
        if isinstance(c, str):
            normalized_chunks.append({"text": c, "timestamp": ""})
        elif isinstance(c, dict):
            if "text" not in c:
                c["text"] = ""
            if "timestamp" not in c:
                c["timestamp"] = ""
            normalized_chunks.append(c)
        else:
            continue

    if not normalized_chunks:
        raise ValueError("No valid text chunks found in transcript_json")

    if session_type == "meeting":
        full_text = "\n".join(c.get("text", "") for c in normalized_chunks)
        return summarize_motm(full_text)
    else:
        return summarize_cornell_context_aware(normalized_chunks, minute_summaries or [])