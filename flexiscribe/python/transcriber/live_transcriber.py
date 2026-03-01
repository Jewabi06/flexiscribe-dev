import queue
import time
import threading

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from summarizer.summarizer import summarize_minute, summarize_cornell
from utils.json_writer import write_json


def summarization_worker(
    text_queue: queue.Queue,
    stop_event: threading.Event,
    session,
):
    """
    Consumes transcribed text chunks, generates per-minute summaries,
    and produces a final Cornell summary when the session ends.

    Args:
        text_queue: Queue of transcribed text strings from whisper worker.
        stop_event: Threading event to signal stop.
        session: TranscriptionSession instance for state tracking.
    """
    try:
        while not stop_event.is_set() or not text_queue.empty():
            try:
                text = text_queue.get(timeout=1)
            except queue.Empty:
                continue

            session.current_minute += 1
            timestamp = time.strftime("%H:%M:%S")

            # Add chunk with timestamp
            chunk = {
                "minute": session.current_minute,
                "timestamp": timestamp,
                "text": text,
            }
            session.transcript_chunks.append(chunk)

            # Write transcript JSON to file (working copy)
            write_json(
                session.get_transcript_json(),
                session.transcript_path,
            )
            print(
                f"[TRANSCRIPT] Minute {session.current_minute}: "
                f"{text[:80]}..."
            )

            # Generate per-minute summary
            try:
                summary = summarize_minute(text)
                minute_summary = {
                    "minute": session.current_minute,
                    "timestamp": timestamp,
                    **summary,
                }
                session.minute_summaries.append(minute_summary)

                write_json(
                    session.get_summary_json(),
                    session.minute_summary_path,
                )
                print(
                    f"[SUMMARY] Minute {session.current_minute} summarized."
                )
            except Exception as e:
                print(
                    f"[ERROR] Minute summary failed for minute "
                    f"{session.current_minute}: {e}"
                )

        # --- Final Cornell summary ---
        if session.transcript_chunks:
            print("[INFO] Generating final Cornell summary...")
            full_text = "\n".join(
                c["text"] for c in session.transcript_chunks
            )
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
