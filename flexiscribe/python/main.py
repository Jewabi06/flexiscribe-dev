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

from config import OUTPUT_DIR, FRONTEND_URL, CALLBACK_SECRET
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
    session_type: Optional[str] = "lecture"  # "lecture" | "meeting"


class StopRequest(BaseModel):
    session_id: str
    transcription_id: Optional[str] = None  # DB record ID for async callback

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
            session_type=req.session_type or "lecture",
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
        "session_type": req.session_type or "lecture",
        "status": "running",
        "message": "Transcription started successfully",
    }


# ─── Stop transcription ──────────────────────────────────────────────────

@app.post("/transcribe/stop")
def stop_transcription(req: StopRequest):
    """
    Stop a running transcription session.

    Returns transcript + minute summaries immediately.  The final Cornell
    summary is generated asynchronously — when it finishes, FastAPI posts
    it to the Next.js callback endpoint so the reviewer (Lesson) is created
    without blocking the educator's stop action.
    """

    session = session_manager.get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "running":
        raise HTTPException(
            status_code=400,
            detail=f"Session is not running (status: {session.status})",
        )

    # Store DB record ID for the async callback
    if req.transcription_id:
        session.transcription_id = req.transcription_id

    session.status = "stopping"
    session.stop_event.set()

    # Wait for whisper to finish its current transcription + remaining buffer.
    # On CPU fallback, a single chunk can take 20-40 s (fp32) so allow enough time.
    print("[API] Waiting for whisper worker to finish...")
    if session.whisper_thread:
        session.whisper_thread.join(timeout=90)

    session.whisper_done.wait(timeout=30)
    print(f"[API] Whisper done. Live chunks: {len(session.live_chunks)}")

    # Wait for minute summaries to complete (NOT the final Cornell summary).
    # The summarizer processes remaining chunks then signals minutes_done
    # before starting the slower Cornell generation.
    print("[API] Waiting for minute summaries to complete...")
    session.minutes_done.wait(timeout=60)
    print(f"[API] Minute summaries done: {len(session.minute_summaries)} summaries.")

    # Build response with transcript + minute summaries (no final_summary yet)
    transcript_data = session.get_transcript_json()
    live_transcript_data = session.get_live_transcript_json()
    summary_data = session.get_summary_json()

    # Spawn background thread to wait for Cornell summary + post callback
    cb_thread = threading.Thread(
        target=_summary_callback_worker,
        args=(session,),
        daemon=True,
    )
    session.summary_callback_thread = cb_thread
    cb_thread.start()

    return {
        "session_id": session.session_id,
        "status": "stopping",  # not "completed" yet — Cornell still generating
        "course_code": session.course_code,
        "duration": session.duration_formatted,
        "transcript": transcript_data,
        "live_transcript": live_transcript_data,
        "minute_summaries": summary_data,
        "final_summary": None,  # will arrive asynchronously via callback
        "summary_pending": True,
        "file_status": session.file_status,
    }


# ─── Async summary callback worker ───────────────────────────────────────

def _summary_callback_worker(session: TranscriptionSession):
    """
    Background thread: waits for the summarizer to finish generating the
    final Cornell/MOTM summary, then POSTs it to the Next.js callback
    endpoint with retry logic.
    """
    try:
        # Wait for the summarizer thread to fully complete (Cornell generation)
        if session.summarizer_thread:
            session.summarizer_thread.join(timeout=600)  # generous for long lectures on CPU

        if not session.final_summary:
            print(f"[CALLBACK] No final summary for session {session.session_id} — skipping callback.")
            return

        if not session.transcription_id:
            print(f"[CALLBACK] No transcription_id for session {session.session_id} — skipping callback.")
            return

        import requests
        callback_url = f"{FRONTEND_URL}/api/transcribe/summary/callback"
        print(f"[CALLBACK] Final summary ready. Posting to {callback_url}...")
        payload = {
            "session_id": session.session_id,
            "transcription_id": session.transcription_id,
            "final_summary": session.get_final_summary_json(),
        }
        headers = {"Content-Type": "application/json"}
        if CALLBACK_SECRET:
            headers["x-callback-secret"] = CALLBACK_SECRET

        # Retry up to 3 times
        for attempt in range(3):
            try:
                resp = requests.post(callback_url, json=payload, headers=headers, timeout=30)
                if resp.ok:
                    print(f"[CALLBACK] Summary delivered successfully for session {session.session_id}.")
                    break
                else:
                    print(f"[CALLBACK] Attempt {attempt+1} failed ({resp.status_code}): {resp.text[:200]}")
                    if attempt < 2:
                        time.sleep(2 ** attempt)
            except Exception as e:
                print(f"[CALLBACK] Attempt {attempt+1} error: {e}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
        else:
            print(f"[CALLBACK] All attempts failed for session {session.session_id}.")

    except Exception as e:
        print(f"[CALLBACK] Error in summary callback worker: {e}")
        import traceback
        traceback.print_exc()


# ─── Poll summary status ─────────────────────────────────────────────────

@app.get("/transcribe/summary/{session_id}")
def get_summary_status(session_id: str):
    """
    Poll endpoint: check if the final summary is ready for a session.
    Returns the summary if available, or status 'pending'.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.final_summary:
        return {
            "status": "ready",
            "final_summary": session.get_final_summary_json(),
        }
    else:
        return {
            "status": "pending",
            "message": "Final summary is still being generated.",
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