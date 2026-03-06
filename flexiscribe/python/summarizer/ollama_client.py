import ollama
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import OLLAMA_GPU_LAYERS

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
    Send prompt to Ollama with the specified generation profile.

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