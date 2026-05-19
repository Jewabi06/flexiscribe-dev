"""
fLexiScribe FastAPI Backend
Handles live transcription sessions via Whisper + Ollama summarization.
"""
import os
import sys
import threading
import uuid
import time
import json
from pathlib import Path

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

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:False")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import requests

from config import OUTPUT_DIR, FRONTEND_URL, CALLBACK_SECRET, OLLAMA_BASE_URL, OLLAMA_CORNELL_MODEL
from session_manager import session_manager, TranscriptionSession
from transcriber.whisper_worker import whisper_worker
from transcriber.live_transcriber import summarization_worker, generate_summary_from_transcript_json, _generate_final_summary
from utils.json_writer import write_json
from session_persistence import list_all_session_metadata, delete_session_metadata, load_session_metadata

app = FastAPI(
    title="fLexiScribe Transcription API",
    description="Live transcription and summarization backend for fLexiScribe",
    version="1.0.0",
)

PENDING_CALLBACKS_DIR = Path(OUTPUT_DIR) / "pending_callbacks"
PENDING_CALLBACKS_DIR.mkdir(parents=True, exist_ok=True)
CALLBACK_JOB_LOCK = threading.Lock()

def _get_callback_job_path(session_id: str) -> Path:
    return PENDING_CALLBACKS_DIR / f"{session_id}.json"

def _save_pending_callback_job(job: dict):
    path = _get_callback_job_path(job["session_id"])
    temp_path = path.with_suffix(".tmp")
    try:
        temp_path.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)
        print(f"[CALLBACK] Persisted pending callback job for session {job['session_id']}")
    except Exception as e:
        print(f"[CALLBACK] Failed to persist callback job for session {job['session_id']}: {e}")

def _remove_pending_callback_job(session_id: str):
    path = _get_callback_job_path(session_id)
    try:
        if path.exists():
            path.unlink()
            print(f"[CALLBACK] Removed pending callback job for session {session_id}")
    except Exception as e:
        print(f"[CALLBACK] Failed to remove pending callback job {session_id}: {e}")

def _load_pending_callback_jobs() -> list[dict]:
    jobs = []
    for path in PENDING_CALLBACKS_DIR.glob("*.json"):
        try:
            jobs.append(json.loads(path.read_text(encoding="utf-8")))
        except Exception as e:
            print(f"[CALLBACK] Failed to read pending callback job {path}: {e}")
    return jobs

def _deliver_callback_job(job: dict) -> bool:
    import requests
    callback_url = f"{FRONTEND_URL}/api/transcribe/summary/callback"
    payload = {
        "session_id": job["session_id"],
        "transcription_id": job["transcription_id"],
        "final_summary": job["final_summary"],
    }
    headers = {"Content-Type": "application/json"}
    if CALLBACK_SECRET:
        headers["x-callback-secret"] = CALLBACK_SECRET

    with CALLBACK_JOB_LOCK:
        for attempt in range(3):
            try:
                resp = requests.post(callback_url, json=payload, headers=headers, timeout=30)
                if resp.ok:
                    print(f"[CALLBACK] Summary delivered successfully for session {job['session_id']}.")
                    _remove_pending_callback_job(job["session_id"])
                    return True
                else:
                    print(
                        f"[CALLBACK] Attempt {attempt + 1} failed ({resp.status_code}): {resp.text[:200]}"
                    )
            except Exception as e:
                print(f"[CALLBACK] Attempt {attempt + 1} error: {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)
        print(f"[CALLBACK] All attempts failed for session {job['session_id']}.")
        return False

def resume_pending_callbacks():
    jobs = _load_pending_callback_jobs()
    if jobs:
        print(f"[CALLBACK] Resuming {len(jobs)} pending callback job(s)...")
        for job in jobs:
            threading.Thread(target=_deliver_callback_job, args=(job,), daemon=True).start()
    else:
        print("[CALLBACK] No pending callback jobs found on startup.")

def warm_up_ollama():
    """Pre‑load the remote Ollama model to avoid first‑request timeout."""
    import requests
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": OLLAMA_CORNELL_MODEL,
        "prompt": "warmup",
        "stream": False
    }
    try:
        resp = requests.post(url, json=payload, timeout=120)
        if resp.status_code == 200:
            print("[STARTUP] Remote Ollama model warmed up.")
        else:
            print(f"[STARTUP] Ollama warm-up failed: {resp.status_code}")
    except Exception as e:
        print(f"[STARTUP] Ollama warm-up error: {e}")

def verify_remote_ollama():
    """Check that remote Ollama is reachable and has the required model."""
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=10)
        if resp.status_code == 200:
            models = resp.json().get("models", [])
            model_names = [m["name"] for m in models]
            if not any(OLLAMA_CORNELL_MODEL in name for name in model_names):
                print(f"[STARTUP] WARNING: Remote model {OLLAMA_CORNELL_MODEL} not found on server.")
            else:
                print(f"[STARTUP] Remote Ollama OK – model {OLLAMA_CORNELL_MODEL} available.")
        else:
            print(f"[STARTUP] WARNING: Cannot reach remote Ollama (status {resp.status_code})")
    except Exception as e:
        print(f"[STARTUP] WARNING: Remote Ollama unreachable: {e}")

def recover_interrupted_sessions():
    """Detect sessions that were running or stopping when backend crashed,
       mark them as interrupted or resume summarization."""
    for sid, meta in list_all_session_metadata().items():
        status = meta.get("status")
        if status in ("running", "stopping"):
            print(f"[RECOVERY] Found interrupted session {sid} with status {status}")
            if status == "running":
                session = TranscriptionSession(
                    session_id=sid,
                    course_code=meta["course_code"],
                    educator_id=meta["educator_id"],
                    session_type=meta["session_type"],
                )
                session.status = "interrupted"
                session.run_id = meta["run_id"]
                session.started_at = meta["started_at"]
                session.transcript_path = meta["transcript_path"]
                session.minute_summary_path = meta["minute_summary_path"]
                session.final_summary_path = meta["final_summary_path"]
                session.aggregated_transcript_path = meta.get("aggregated_transcript_path", "")
                session_manager._sessions[sid] = session
                delete_session_metadata(sid)
            elif status == "stopping":
                session = TranscriptionSession(
                    session_id=sid,
                    course_code=meta["course_code"],
                    educator_id=meta["educator_id"],
                    session_type=meta["session_type"],
                )
                session.status = "stopping"
                session.run_id = meta["run_id"]
                session.started_at = meta["started_at"]
                session.transcript_path = meta["transcript_path"]
                session.minute_summary_path = meta["minute_summary_path"]
                session.final_summary_path = meta["final_summary_path"]
                session.aggregated_transcript_path = meta.get("aggregated_transcript_path", "")
                if os.path.exists(session.minute_summary_path):
                    with open(session.minute_summary_path) as f:
                        data = json.load(f)
                        session.minute_summaries = data.get("summaries", [])
                agg_path = session.aggregated_transcript_path
                if os.path.exists(agg_path):
                    with open(agg_path) as f:
                        agg_data = json.load(f)
                        session.transcript_chunks = agg_data.get("chunks", [])
                else:
                    print(f"[RECOVERY] No aggregated file for {sid}, final summary may be incomplete.")
                session_manager._sessions[sid] = session
                def finish():
                    _generate_final_summary(session)
                threading.Thread(target=finish, daemon=True).start()
                delete_session_metadata(sid)

@app.on_event("startup")
def startup_events():
    resume_pending_callbacks()
    warm_up_ollama()
    recover_interrupted_sessions()
    verify_remote_ollama()

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
    session_type: Optional[str] = "lecture"

class StopRequest(BaseModel):
    session_id: str
    transcription_id: Optional[str] = None

class UploadConfirmRequest(BaseModel):
    session_id: str
    file_type: str

class RegenerateSummaryRequest(BaseModel):
    transcription_id: str
    transcript_json: dict
    minute_summaries: Optional[list] = None
    session_type: Optional[str] = "lecture"
    course_code: Optional[str] = ""

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

    t1 = threading.Thread(
        target=whisper_worker,
        args=(session.stop_event, session),
        daemon=True,
    )
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

# ─── Stop transcription (async final summary) ─────────────────────────────

@app.post("/transcribe/stop")
def stop_transcription(req: StopRequest):
    """
    Stop a running transcription session.
    Returns transcript + minute summaries immediately.
    Final summary is generated asynchronously and delivered via callback.
    """
    session = session_manager.get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "running":
        raise HTTPException(status_code=400, detail=f"Session not running (status: {session.status})")

    if req.transcription_id:
        session.transcription_id = req.transcription_id

    session.status = "stopping"
    session.stop_event.set()
    session_manager.update_session_status(session.session_id, "stopping")

    # --- Wait for whisper to finish processing remaining audio ---
    print("[API] Waiting for whisper worker to finish...")
    if session.whisper_thread:
        session.whisper_thread.join(timeout=90)
    session.whisper_done.wait(timeout=30)
    print(f"[API] Whisper done. Live chunks: {len(session.live_chunks)}")

    # --- Wait for minute summaries to complete (fast, no final summary) ---
    print("[API] Waiting for minute summaries to complete...")
    session.minutes_done.wait(timeout=60)
    print(f"[API] Minute summaries done: {len(session.minute_summaries)} summaries.")

    # --- Prepare response data (transcript + minute summaries) ---
    transcript_data = session.get_transcript_json()
    live_transcript_data = session.get_live_transcript_json()
    minute_summaries_data = session.get_summary_json()

    # --- Start background thread for final summary + callback ---
    def background_finalize():
        print("[API] Background finalisation thread started.")
        if session.summarizer_thread and session.summarizer_thread.is_alive():
            session.summarizer_thread.join(timeout=120)
        if not session.final_summary:
            _generate_final_summary(session)
        if session.transcription_id and session.final_summary:
            job = {
                "session_id": session.session_id,
                "transcription_id": session.transcription_id,
                "final_summary": session.final_summary,
            }
            _save_pending_callback_job(job)
            _deliver_callback_job(job)
        session.status = "completed" if session.final_summary else "error"
        session_manager.update_session_status(session.session_id, session.status)
        print(f"[API] Session {session.session_id} final status={session.status}.")

    threading.Thread(target=background_finalize, daemon=True).start()

    return {
        "session_id": session.session_id,
        "status": "stopping",
        "summary_pending": True,
        "message": "Transcript and minute summaries ready. Final summary will be delivered via callback.",
        "course_code": session.course_code,
        "duration": session.duration_formatted,
        "transcript": transcript_data,
        "live_transcript": live_transcript_data,
        "minute_summaries": minute_summaries_data,
        "file_status": session.file_status,
    }

# ─── Poll summary status (includes error details) ─────────────────────────

@app.get("/transcribe/summary/{session_id}")
def get_summary_status(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.final_summary:
        return {
            "status": "ready",
            "final_summary": session.get_final_summary_json(),
        }
    elif session.final_summary_error:
        return {
            "status": "error",
            "error": session.final_summary_error,
        }
    else:
        return {
            "status": "pending",
            "message": "Final summary is still being generated.",
        }

@app.post("/transcribe/summary/regenerate")
def regenerate_summary(req: RegenerateSummaryRequest):
    if not req.transcript_json:
        raise HTTPException(status_code=400, detail="transcript_json is required")
    try:
        final_summary = generate_summary_from_transcript_json(
            req.transcript_json,
            req.minute_summaries,
            req.session_type or "lecture",
            req.course_code or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {e}")
    return {"status": "success", "final_summary": final_summary, "transcription_id": req.transcription_id}

# ─── Session status / live data (includes error field) ────────────────────

@app.get("/transcribe/status/{session_id}")
def get_session_status(session_id: str):
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
        "final_summary_error": session.final_summary_error,
        "live_transcript": session.get_live_transcript_json(),
        "transcript": session.get_transcript_json(),
        "minute_summaries": session.get_summary_json(),
    }

@app.get("/transcribe/live/{session_id}")
def get_live_transcript(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    def event_stream():
        last_live_count = 0
        last_summary_count = 0
        yield ": connected\n\n"
        while session.status == "running":
            sent_data = False
            current_live = len(session.live_chunks)
            if current_live > last_live_count:
                new_chunks = session.live_chunks[last_live_count:]
                for chunk in new_chunks:
                    data = json.dumps({"type": "live_chunk", **chunk})
                    yield f"data: {data}\n\n"
                last_live_count = current_live
                sent_data = True
            current_summaries = len(session.minute_summaries)
            if current_summaries > last_summary_count:
                new_summaries = session.minute_summaries[last_summary_count:]
                for summary in new_summaries:
                    data = json.dumps({"type": "minute_summary", **summary})
                    yield f"data: {data}\n\n"
                last_summary_count = current_summaries
                sent_data = True
            if not sent_data:
                yield ": keepalive\n\n"
            time.sleep(1)
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
    session.cleanup_files()
    return {
        "message": "Files marked for deletion",
        "file_status": session.file_status,
    }

@app.get("/transcribe/pending-files")
def get_pending_files():
    return {"pending": session_manager.get_pending_files()}

@app.get("/transcribe/sessions")
def list_sessions():
    return {"sessions": session_manager.list_sessions()}

@app.delete("/transcribe/session/{session_id}")
def delete_session(session_id: str):
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