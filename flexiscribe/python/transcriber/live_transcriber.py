"""
Timer-based summarisation worker — decoupled from the Whisper pipeline.

Instead of reading from a shared queue (which couples latency to the
summariser), this worker **polls session.live_chunks on a fixed timer**.
Every BUFFER_INTERVAL seconds (default 60 s) it collects all new 10 s
chunks since the last summary, combines them, and asks Ollama for a
per-minute summary.

When the session stops it waits for the whisper_done event (so the
final audio chunk is captured), processes any remaining text, then
generates the Cornell notes summary.

Ollama is configured with ``num_gpu = 0`` (CPU-only) so the GPU stays
free for Whisper — this eliminates the main source of contention on
Jetson Orin Nano.
"""

import time
import threading

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from summarizer.summarizer import summarize_minute, summarize_cornell
from utils.json_writer import write_json
from config import BUFFER_INTERVAL


def _process_new_chunks(session, last_processed_idx, minute_counter):
    """
    Collect new live_chunks since last_processed_idx, combine their text,
    generate a per-minute summary, and persist both.

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

    # Append aggregated 60 s text to transcript_chunks (for DB)
    chunk = {
        "minute": minute_counter,
        "timestamp": timestamp,
        "text": combined_text,
    }
    session.transcript_chunks.append(chunk)
    write_json(session.get_transcript_json(), session.transcript_path)
    print(f"[TRANSCRIPT] Minute {minute_counter}: {combined_text[:80]}...")

    # Generate per-minute summary (runs on CPU — no GPU contention)
    try:
        summary = summarize_minute(combined_text)
        minute_summary = {
            "minute": minute_counter,
            "timestamp": timestamp,
            **summary,
        }
        session.minute_summaries.append(minute_summary)
        write_json(session.get_summary_json(), session.minute_summary_path)
        print(f"[SUMMARY] Minute {minute_counter} summarized.")
    except Exception as e:
        print(f"[ERROR] Minute summary failed for minute {minute_counter}: {e}")

    return new_idx, minute_counter


def summarization_worker(stop_event: threading.Event, session):
    """
    Timer-based summarisation: every BUFFER_INTERVAL seconds, collect new
    live_chunks, combine their text, and generate a per-minute summary.
    """
    last_processed_idx = 0  # index into session.live_chunks
    minute_counter = 0

    try:
        # ── Main loop: wait BUFFER_INTERVAL or until stop ─────────────
        while not stop_event.is_set():
            # wait() returns True if the event was set (stop), False on timeout
            stopped = stop_event.wait(timeout=BUFFER_INTERVAL)

            if stopped:
                break  # handle remaining chunks below

            last_processed_idx, minute_counter = _process_new_chunks(
                session, last_processed_idx, minute_counter,
            )

        # ── After stop: wait for whisper to finish final audio ────────
        # The whisper worker sets whisper_done after processing its last
        # audio buffer.  We MUST wait for this or we lose the final chunk.
        print("[INFO] Summarizer waiting for whisper_done...")
        got_it = session.whisper_done.wait(timeout=60)
        if got_it:
            print("[INFO] Whisper done — processing remaining chunks.")
        else:
            print("[WARN] whisper_done timed out after 60 s — processing what we have.")

        # Collect any chunks added since the last cycle
        last_processed_idx, minute_counter = _process_new_chunks(
            session, last_processed_idx, minute_counter,
        )

        # ── Generate final Cornell summary ────────────────────────────
        if session.transcript_chunks:
            print("[INFO] Generating final Cornell summary...")
            full_text = "\n".join(c["text"] for c in session.transcript_chunks)
            try:
                cornell = summarize_cornell(full_text)
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
                    "cue_questions": [],
                    "notes": ["Summary generation failed. Raw text available."],
                    "summary": full_text[:500],
                }

        session.status = "completed"
        print(f"[INFO] Session {session.session_id} completed.")

    except Exception as e:
        session.status = "error"
        print(f"[ERROR] Summarization worker error: {e}")
        import traceback
        traceback.print_exc()
