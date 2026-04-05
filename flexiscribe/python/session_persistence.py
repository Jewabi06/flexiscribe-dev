import json
import os
from pathlib import Path
from typing import Dict, Optional
from config import OUTPUT_DIR

PERSIST_DIR = Path(OUTPUT_DIR) / ".session_state"
PERSIST_DIR.mkdir(parents=True, exist_ok=True)

def save_session_metadata(session_id: str, data: dict):
    path = PERSIST_DIR / f"{session_id}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def load_session_metadata(session_id: str) -> Optional[dict]:
    path = PERSIST_DIR / f"{session_id}.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return None

def delete_session_metadata(session_id: str):
    path = PERSIST_DIR / f"{session_id}.json"
    if path.exists():
        path.unlink()

def list_all_session_metadata() -> Dict[str, dict]:
    sessions = {}
    for p in PERSIST_DIR.glob("*.json"):
        sid = p.stem
        sessions[sid] = load_session_metadata(sid)
    return sessions