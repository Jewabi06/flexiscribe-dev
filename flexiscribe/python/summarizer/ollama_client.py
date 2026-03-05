import ollama
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import OLLAMA_GPU_LAYERS

def generate_response(model: str, prompt: str) -> str:
    response = ollama.chat(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a JSON-only API that processes bilingual "
                    "Filipino/Tagalog and English (Taglish) lecture content. "
                    "You must return ONLY valid JSON. "
                    "No explanations. No markdown code fences. No extra text. "
                    "Output raw JSON only."
                )
            },
            {"role": "user", "content": prompt}
        ],
        options={
            "temperature": 0.3,  # Lower temperature for consistent JSON output
            "num_predict": 1024,  # Enough tokens for detailed summaries
            "num_gpu": OLLAMA_GPU_LAYERS,  # 0 = CPU-only, frees GPU for Whisper
        },
    )

    return response["message"]["content"].strip()