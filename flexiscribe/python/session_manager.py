"""
Manages active transcription sessions.
Each session holds the state for one live transcription run.
"""
import threading
import time
import os
import json
from typing import Optional
from config import OUTPUT_DIR


class TranscriptionSession:
    """Represents a single live transcription session."""

    def __init__(self, session_id: str, course_code: str, educator_id: str, session_type: str = "lecture"):
        self.session_id = session_id
        self.course_code = course_code
        self.educator_id = educator_id
        self.session_type = session_type  # "lecture" | "meeting"
        self.run_id = time.strftime("%Y%m%d_%H%M%S")
        self.stop_event = threading.Event()
        self.whisper_done = threading.Event()  # Set when whisper finishes
        self.minutes_done = threading.Event()  # Set when minute summaries are complete (before Cornell)
        self.started_at = time.time()
        self.status = "running"  # running | stopping | completed | error
        self.transcription_id: Optional[str] = None  # DB record ID (set by stop endpoint)

        # Lock for thread-safe minute_summaries / transcript_chunks writes
        self.summary_lock = threading.Lock()

        # Live data accumulation
        self.live_chunks: list = []                # every ~3s for real-time display
        self.live_chunk_counter = 0
        # transcript_chunks: aggregated 60s text for per-minute summarization
        self.transcript_chunks: list = []
        # final_transcript_chunks: 10‑second chunks for final JSON output
        self.final_transcript_chunks: list = []    # <-- NEW
        self.minute_summaries: list = []
        self.final_summary: Optional[dict] = None
        self.current_minute = 0

        # File paths (under output/{course_code}/)
        self.output_dir = os.path.join(OUTPUT_DIR, course_code)
        self.transcript_path = os.path.join(
            self.output_dir, "transcripts",
            f"transcript_{self.run_id}.json"
        )
        self.minute_summary_path = os.path.join(
            self.output_dir, "minute_summaries",
            f"minute_summary_{self.run_id}.json"
        )
        self.final_summary_path = os.path.join(
            self.output_dir, "final_summaries",
            f"final_cornell_{self.run_id}.json"
        )

        # File status tracking
        self.file_status = {
            "transcript": "pending",
            "minute_summary": "pending",
            "final_summary": "pending",
        }

        # Thread references
        self.whisper_thread: Optional[threading.Thread] = None
        self.summarizer_thread: Optional[threading.Thread] = None
        self.summary_callback_thread: Optional[threading.Thread] = None

    @property
    def duration_seconds(self) -> float:
        return time.time() - self.started_at

    @property
    def duration_formatted(self) -> str:
        secs = int(self.duration_seconds)
        mins = secs // 60
        secs = secs % 60
        hrs = mins // 60
        mins = mins % 60
        if hrs > 0:
            return f"{hrs}h {mins}m {secs}s"
        return f"{mins}m {secs}s"
    
    def get_elapsed_timestamp(self, ref_time: float = None) -> str:
        """Get elapsed time from session start in MM:SS format (0-based)."""
        if ref_time is None:
            ref_time = time.time()
        elapsed = int(ref_time - self.started_at)
        mins = elapsed // 60
        secs = elapsed % 60
        return f"{mins:02d}:{secs:02d}"

    def get_transcript_json(self) -> dict:
        """Return the full transcript data (10‑second chunks) in JSON format."""
        return {
            "metadata": {
                "session_id": self.session_id,
                "run_id": self.run_id,
                "course_code": self.course_code,
                "educator_id": self.educator_id,
                "started_at": time.strftime(
                    "%Y-%m-%d %H:%M:%S",
                    time.localtime(self.started_at)
                ),
                "duration": self.duration_formatted,
            },
            "chunks": self.final_transcript_chunks,   # <-- now uses 10‑second chunks
        }

    def get_live_transcript_json(self) -> dict:
        """Return the live (3‑second) transcript data for real-time display."""
        return {
            "metadata": {
                "session_id": self.session_id,
                "run_id": self.run_id,
                "course_code": self.course_code,
                "duration": self.duration_formatted,
            },
            "chunks": self.live_chunks,
        }

    def get_summary_json(self) -> dict:
        """Return the minute summaries data in JSON format (thread-safe)."""
        with self.summary_lock:
            summaries_copy = list(self.minute_summaries)
        return {
            "metadata": {
                "session_id": self.session_id,
                "run_id": self.run_id,
                "course_code": self.course_code,
            },
            "summaries": summaries_copy,
        }

    def get_final_summary_json(self) -> Optional[dict]:
        """Return the final Cornell summary if available."""
        if self.final_summary:
            return {
                "metadata": {
                    "session_id": self.session_id,
                    "run_id": self.run_id,
                    "course_code": self.course_code,
                    "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                },
                **self.final_summary,
            }
        return None

    def mark_uploaded(self, file_type: str):
        if file_type in self.file_status:
            self.file_status[file_type] = "uploaded"

    def mark_for_deletion(self, file_type: str):
        if file_type in self.file_status:
            self.file_status[file_type] = "to_delete"

    def cleanup_files(self):
        file_map = {
            "transcript": self.transcript_path,
            "minute_summary": self.minute_summary_path,
            "final_summary": self.final_summary_path,
        }
        for file_type, path in file_map.items():
            if self.file_status.get(file_type) == "to_delete" and os.path.exists(path):
                try:
                    os.remove(path)
                    print(f"[CLEANUP] Deleted {path}")
                except OSError as e:
                    print(f"[CLEANUP] Failed to delete {path}: {e}")


class SessionManager:
    """Manages all active transcription sessions."""

    def __init__(self):
        self._sessions: dict[str, TranscriptionSession] = {}
        self._lock = threading.Lock()

    def create_session(
        self, session_id: str, course_code: str, educator_id: str, session_type: str = "lecture"
    ) -> TranscriptionSession:
        with self._lock:
            if session_id in self._sessions:
                raise ValueError(f"Session {session_id} already exists")
            session = TranscriptionSession(session_id, course_code, educator_id, session_type)
            self._sessions[session_id] = session
            return session

    def get_session(self, session_id: str) -> Optional[TranscriptionSession]:
        with self._lock:
            return self._sessions.get(session_id)

    def get_active_session_for_educator(
        self, educator_id: str
    ) -> Optional[TranscriptionSession]:
        with self._lock:
            for session in self._sessions.values():
                if (
                    session.educator_id == educator_id
                    and session.status in ("running", "stopping")
                ):
                    return session
        return None

    def remove_session(self, session_id: str):
        with self._lock:
            self._sessions.pop(session_id, None)

    def list_sessions(self) -> list[dict]:
        with self._lock:
            return [
                {
                    "session_id": s.session_id,
                    "course_code": s.course_code,
                    "educator_id": s.educator_id,
                    "status": s.status,
                    "duration": s.duration_formatted,
                    "chunks": len(s.final_transcript_chunks),
                }
                for s in self._sessions.values()
            ]

    def get_pending_files(self) -> list[dict]:
        pending = []
        with self._lock:
            for s in self._sessions.values():
                for file_type, status in s.file_status.items():
                    if status == "pending":
                        file_map = {
                            "transcript": s.transcript_path,
                            "minute_summary": s.minute_summary_path,
                            "final_summary": s.final_summary_path,
                        }
                        pending.append({
                            "session_id": s.session_id,
                            "file_type": file_type,
                            "path": file_map[file_type],
                            "course_code": s.course_code,
                        })
        return pending

session_manager = SessionManager()  # Global singleton