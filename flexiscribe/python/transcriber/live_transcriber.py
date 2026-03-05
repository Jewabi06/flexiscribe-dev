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

from summarizer.summarizer import summarize_minute, summarize_cornell_from_summaries, summarize_motm
from utils.json_writer import write_json
from config import BUFFER_INTERVAL


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

        # ── Signal that all minute summaries are done ────────────────
        # The stop endpoint waits on this event so it can return the
        # transcript + minute summaries immediately without blocking on
        # the (much slower) final Cornell/MOTM generation.
        session.minutes_done.set()
        print(f"[INFO] minutes_done signalled — {len(session.minute_summaries)} summaries ready.")

        # ── Generate final summary from minute summaries ─────────────
        # Using pre-computed minute summaries as input is much faster
        # than feeding the entire raw transcript, especially for long
        # lectures (1-2+ hours).
        if session.minute_summaries:
            # Format minute summaries into a structured text block
            summaries_text = _format_minute_summaries(session.minute_summaries)

            if getattr(session, "session_type", "lecture") == "meeting":
                # Generate Minutes of the Meeting (MOTM) — uses raw transcript
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
                # Generate Cornell Notes from minute summaries
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
