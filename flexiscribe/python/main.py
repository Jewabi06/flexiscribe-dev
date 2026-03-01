"""
fLexiScribe FastAPI Backend
Handles live transcription sessions via Whisper + Ollama summarization.

On Jetson Orin Nano, uses NVIDIA's Jetson-specific PyTorch build for
GPU-accelerated Whisper inference (sm_87 compute capability).
"""
import os
import sys
import threading
import uuid
import time
import json

# Ensure libcusparseLt is findable before importing torch (via config)
_cusparse_path = os.path.expanduser(
    "~/.local/lib/python3.10/site-packages/nvidia/cusparselt/lib"
)
if os.path.isdir(_cusparse_path):
    os.environ.setdefault("LD_LIBRARY_PATH", "")
    if _cusparse_path not in os.environ["LD_LIBRARY_PATH"]:
        os.environ["LD_LIBRARY_PATH"] = (
            _cusparse_path + ":" + os.environ["LD_LIBRARY_PATH"]
        )
    import ctypes
    try:
        ctypes.CDLL(os.path.join(_cusparse_path, "libcusparseLt.so.0"))
    except OSError:
        pass

# Jetson Orin NVML workaround — must be set before torch import
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:False")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from config import OUTPUT_DIR, FRONTEND_URL
from session_manager import session_manager, TranscriptionSession
from transcriber.whisper_worker import whisper_worker
from transcriber.live_transcriber import summarization_worker
from utils.json_writer import write_json

app = FastAPI(
    title="fLexiScribe Transcription API",
    description="Live transcription and summarization backend for fLexiScribe",
    version="1.0.0",
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request / Response models ───────────────────────────────────────────

class StartRequest(BaseModel):
    course_code: str
    educator_id: str
    title: Optional[str] = None


class StopRequest(BaseModel):
    session_id: str

class UploadConfirmRequest(BaseModel):
    session_id: str
    file_type: str  # "transcript" | "minute_summary" | "final_summary" | "all"


class SessionStatusResponse(BaseModel):
    session_id: str
    course_code: str
    educator_id: str
    status: str
    duration: str
    chunks_count: int
    summaries_count: int
    has_final_summary: bool


# ─── Health check ─────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"service": "fLexiScribe Transcription API", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


# ─── Start transcription ─────────────────────────────────────────────────

@app.post("/transcribe/start")
def start_transcription(req: StartRequest):
    """Start a new live transcription session."""

    # Check if educator already has an active session
    existing = session_manager.get_active_session_for_educator(req.educator_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Educator already has an active transcription session",
                "session_id": existing.session_id,
            },
        )

    session_id = str(uuid.uuid4())

    try:
        session = session_manager.create_session(
            session_id=session_id,
            course_code=req.course_code,
            educator_id=req.educator_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # Start whisper worker thread
    t1 = threading.Thread(
        target=whisper_worker,
        args=(session.stop_event, session),
        daemon=True,
    )

    # Start summarization worker thread
    t2 = threading.Thread(
        target=summarization_worker,
        args=(session.stop_event, session),
        daemon=True,
    )

    session.whisper_thread = t1
    session.summarizer_thread = t2

    t1.start()
    t2.start()

    print(f"[API] Transcription started: session={session_id}, course={req.course_code}")

    return {
        "session_id": session_id,
        "course_code": req.course_code,
        "status": "running",
        "message": "Transcription started successfully",
    }


# ─── Stop transcription ──────────────────────────────────────────────────

@app.post("/transcribe/stop")
def stop_transcription(req: StopRequest):
    """Stop a running transcription session and return final data."""

    session = session_manager.get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "running":
        raise HTTPException(
            status_code=400,
            detail=f"Session is not running (status: {session.status})",
        )

    session.status = "stopping"
    session.stop_event.set()

    # Wait for whisper to finish its current transcription + remaining buffer.
    # On Jetson with GPU, a single transcribe() call takes ~2-3 s for 10 s audio.
    # We wait for whisper_done event (more reliable than thread.join timeout).
    print("[API] Waiting for whisper worker to finish...")
    if session.whisper_thread:
        session.whisper_thread.join(timeout=15)

    # Double-check: wait for the whisper_done event in case the thread is still
    # cleaning up.  This ensures we capture the very last chunk.
    session.whisper_done.wait(timeout=10)
    print(f"[API] Whisper done. Live chunks: {len(session.live_chunks)}")

    # Wait for summarizer: processes remaining chunks + generates Cornell
    # summary via Ollama on CPU, which can take 30-60 s for longer lectures.
    # We give it generous time since the frontend handles the delay.
    print("[API] Waiting for summarizer to finish...")
    if session.summarizer_thread:
        session.summarizer_thread.join(timeout=120)

    print(f"[API] Stop complete. Status: {session.status}")

    # Build response with all data
    transcript_data = session.get_transcript_json()
    live_transcript_data = session.get_live_transcript_json()
    summary_data = session.get_summary_json()
    final_summary = session.get_final_summary_json()

    return {
        "session_id": session.session_id,
        "status": session.status,
        "course_code": session.course_code,
        "duration": session.duration_formatted,
        "transcript": transcript_data,
        "live_transcript": live_transcript_data,
        "minute_summaries": summary_data,
        "final_summary": final_summary,
        "file_status": session.file_status,
    }


# ─── Session status / live data ──────────────────────────────────────────

@app.get("/transcribe/status/{session_id}")
def get_session_status(session_id: str):
    """Get current status and live data for a session."""

    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session.session_id,
        "course_code": session.course_code,
        "educator_id": session.educator_id,
        "status": session.status,
        "duration": session.duration_formatted,
        "live_chunks_count": len(session.live_chunks),
        "chunks_count": len(session.transcript_chunks),
        "summaries_count": len(session.minute_summaries),
        "has_final_summary": session.final_summary is not None,
        "live_transcript": session.get_live_transcript_json(),
        "transcript": session.get_transcript_json(),
        "minute_summaries": session.get_summary_json(),
    }


@app.get("/transcribe/live/{session_id}")
def get_live_transcript(session_id: str):
    """
    Server-Sent Events stream for live transcript updates.
    The frontend can subscribe to this for real-time display.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    def event_stream():
        last_live_count = 0
        last_summary_count = 0

        # Send an immediate keepalive so the client knows the connection is open
        yield ": connected\n\n"

        while session.status == "running":
            sent_data = False

            # Stream new live chunks (every ~10s) for real-time display
            current_live = len(session.live_chunks)
            if current_live > last_live_count:
                new_chunks = session.live_chunks[last_live_count:]
                for chunk in new_chunks:
                    data = json.dumps({"type": "live_chunk", **chunk})
                    yield f"data: {data}\n\n"
                last_live_count = current_live
                sent_data = True

            # Stream new minute summaries as they complete
            current_summaries = len(session.minute_summaries)
            if current_summaries > last_summary_count:
                new_summaries = session.minute_summaries[last_summary_count:]
                for summary in new_summaries:
                    data = json.dumps({"type": "minute_summary", **summary})
                    yield f"data: {data}\n\n"
                last_summary_count = current_summaries
                sent_data = True

            # Send a keepalive comment if no real data was sent this tick,
            # so proxies / browsers don't close the idle connection.
            if not sent_data:
                yield ": keepalive\n\n"

            time.sleep(1)

        # Send final event
        yield f"event: done\ndata: {json.dumps({'status': session.status, 'duration': session.duration_formatted})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ─── File management ─────────────────────────────────────────────────────

@app.post("/transcribe/upload-confirm")
def confirm_upload(req: UploadConfirmRequest):
    """
    Called by frontend after successfully saving JSON to database.
    Marks local files for deletion.
    """
    session = session_manager.get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if req.file_type == "all":
        for ft in ["transcript", "minute_summary", "final_summary"]:
            session.mark_uploaded(ft)
            session.mark_for_deletion(ft)
    else:
        session.mark_uploaded(req.file_type)
        session.mark_for_deletion(req.file_type)

    # Attempt cleanup
    session.cleanup_files()

    return {
        "message": "Files marked for deletion",
        "file_status": session.file_status,
    }


@app.get("/transcribe/pending-files")
def get_pending_files():
    """List files that haven't been uploaded to the database yet."""
    return {"pending": session_manager.get_pending_files()}


@app.get("/transcribe/sessions")
def list_sessions():
    """List all transcription sessions."""
    return {"sessions": session_manager.list_sessions()}


# ─── Cleanup completed sessions ──────────────────────────────────────────

@app.delete("/transcribe/session/{session_id}")
def delete_session(session_id: str):
    """Remove a completed session from memory."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == "running":
        raise HTTPException(
            status_code=400, detail="Cannot delete a running session"
        )
    session_manager.remove_session(session_id)
    return {"message": f"Session {session_id} removed"}


# ─── Entry point ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    print("[INFO] Starting fLexiScribe FastAPI backend...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
