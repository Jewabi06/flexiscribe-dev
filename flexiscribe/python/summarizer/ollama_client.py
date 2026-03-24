import ollama
import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import OLLAMA_GPU_LAYERS, OLLAMA_BASE_URL

# ─── Generation Profiles ─────────────────────────────────────────────────
# Different tasks need different token budgets.
# Values are kept Jetson Orin Nano-friendly.
PROFILES = {
    "short": {                  # Topic extraction, minute summaries
        "temperature": 0.3,
        "num_predict": 1024,
        "num_gpu": OLLAMA_GPU_LAYERS,
    },
    "extended": {               # Full Cornell notes, MOTM (long lectures)
        "temperature": 0.3,
        "num_predict": 4096,
        "num_gpu": OLLAMA_GPU_LAYERS,
    },
}

# ─── System prompts per task type ─────────────────────────────────────────
SYSTEM_PROMPTS = {
    "json_api": (
        "You are a JSON-only API that processes bilingual "
        "Filipino/Tagalog and English (Taglish) lecture content. "
        "You must return ONLY valid JSON. "
        "No explanations. No markdown code fences. No extra text. "
        "Output raw JSON only."
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

    Args:
        model:   Ollama model name (e.g. 'gemma3:1b')
        prompt:  User prompt text
        profile: 'short' (1024 tokens) | 'extended' (4096 tokens)
        system:  Key from SYSTEM_PROMPTS
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
# Used for final Cornell Notes / MOTM generation after transcription stops.
# Connects to OLLAMA_BASE_URL (e.g. Google Cloud VM with GPU) for faster
# inference with gemma3:4b, mirroring the approach used in quiz generation.

_remote_client = None


def _get_remote_client():
    """Lazy-init a remote Ollama client pointing at OLLAMA_BASE_URL."""
    global _remote_client
    if _remote_client is None:
        _remote_client = ollama.Client(host=OLLAMA_BASE_URL)
        print(f"[OLLAMA] Remote client initialised → {OLLAMA_BASE_URL}")
    return _remote_client


def generate_response_remote(
    model: str,
    prompt: str,
    profile: str = "extended",
    system: str = "json_api",
    max_retries: int = 3,
) -> str:
    """
    Send prompt to the remote GPU-powered Ollama instance with retry logic.

    Used for final summary generation after transcription stops.
    The remote server (OLLAMA_BASE_URL) runs a larger model (e.g.
    gemma3:4b) on GPU for faster, higher-quality output.

    Args:
        model:   Ollama model name (e.g. 'gemma3:4b')
        prompt:  User prompt text
        profile: 'short' (1024 tokens) | 'extended' (4096 tokens)
        system:  Key from SYSTEM_PROMPTS
        max_retries: Number of retry attempts on failure
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
                time.sleep(2 ** attempt)  # exponential backoff
            else:
                print("[OLLAMA] All remote attempts failed, falling back to local model")
                # Fallback to local Ollama (if available)
                try:
                    return generate_response(model, prompt, profile, system)
                except Exception as local_e:
                    print(f"[OLLAMA] Local fallback also failed: {local_e}")
                    return ""  # final fallback empty string

    return ""  # should never reach here