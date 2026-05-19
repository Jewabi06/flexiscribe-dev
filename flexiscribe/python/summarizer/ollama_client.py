import ollama
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import OLLAMA_GPU_LAYERS, OLLAMA_BASE_URL, OLLAMA_MODEL

# ─── Generation Profiles ─────────────────────────────────────────────────
PROFILES = {
    "short": {                  # Topic extraction, minute summaries
        "temperature": 0.2,
        "num_predict": 1024,
        "num_gpu": OLLAMA_GPU_LAYERS,
    },
    "extended": {               # Full Cornell notes, MOTM (long lectures)
        "temperature": 0.1,
        "num_predict": 6000,
        "num_gpu": OLLAMA_GPU_LAYERS,
    },
}

# ─── System prompts per task type ─────────────────────────────────────────
SYSTEM_PROMPTS = {
    "json_api": (
        "You are a JSON-only API that processes bilingual Filipino/Tagalog and English (Taglish) lecture content.\n"
        "You must return ONLY valid JSON – no markdown, no code fences, no extra text, no explanations.\n"
        "The output must conform EXACTLY to this schema:\n"
        "{\n"
        '  "title": "string",\n'
        '  "key_concepts": ["string"],\n'
        '  "notes": [\n'
        '    {"term": "string", "definition": "string", "example": "string"}\n'
        '  ],\n'
        '  "summary": ["string"]\n'
        "}\n"
        "Do not add, remove, or rename any fields. Output raw JSON only."
    ),
    "topic_analyst": (
        "You are a curriculum analyst. Identify topics from "
        "bilingual Filipino/English lecture transcripts. "
        "Return ONLY valid JSON."
    ),
}

def generate_response(
    model: str,
    prompt: str,
    profile: str = "short",
    system: str = "json_api",
) -> str:
    """
    Send prompt to local Ollama with the specified generation profile.
    """
    options = PROFILES.get(profile, PROFILES["short"])
    system_prompt = SYSTEM_PROMPTS.get(system, SYSTEM_PROMPTS["json_api"])

    response = ollama.chat(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        options=options,
    )
    return response["message"]["content"].strip()

# ─── Remote GPU-powered Ollama client ─────────────────────────────────────
_remote_client = None

def _get_remote_client():
    """Lazy-init a remote Ollama client pointing at OLLAMA_BASE_URL."""
    global _remote_client
    if _remote_client is None:
        _remote_client = ollama.Client(host=OLLAMA_BASE_URL, timeout=120)  # increased timeout
        print(f"[OLLAMA] Remote client initialised → {OLLAMA_BASE_URL}")
    return _remote_client

def generate_response_remote(
    model: str,
    prompt: str,
    profile: str = "extended",
    system: str = "json_api",
    max_retries: int = 3,
    initial_delay: float = 3.0,
) -> str:
    """
    Send prompt to the remote GPU-powered Ollama instance with retry logic.
    Raises RuntimeError if all retries fail – NO FALLBACK TO LOCAL MODEL.
    """
    options = PROFILES.get(profile, PROFILES["extended"])
    system_prompt = SYSTEM_PROMPTS.get(system, SYSTEM_PROMPTS["json_api"])

    client = _get_remote_client()

    for attempt in range(max_retries):
        try:
            response = client.chat(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                options=options,
            )
            return response["message"]["content"].strip()
        except Exception as e:
            print(f"[OLLAMA] Remote call attempt {attempt+1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                delay = min(initial_delay * (2 ** attempt), 20.0)
                time.sleep(delay)
            else:
                print("[OLLAMA] Remote unavailable. Raising error – no fallback to local model.")
                raise RuntimeError(
                    f"Remote Ollama at {OLLAMA_BASE_URL} failed after {max_retries} attempts. "
                    f"Check network and server status. Model: {model}"
                )
    return ""  # never reached