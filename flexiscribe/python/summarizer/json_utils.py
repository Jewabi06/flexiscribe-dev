import json
import re

def extract_json(model_output: str):
    """
    Safely extract JSON from model output.
    Returns a dictionary. If parsing fails, returns raw text fallback.
    """
    text = model_output.strip()

    # Remove markdown code fences ```json ... ```
    text = re.sub(r"```json\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```", "", text)

    # Replace smart quotes with normal quotes
    text = text.replace("“", '"').replace("”", '"').replace("’", "'")

    # Remove control characters that break JSON
    text = re.sub(r"[\x00-\x1f]", " ", text)

    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fallback dictionary
        print("[WARN] Failed to parse JSON, returning raw text fallback")
        return {"summary": text, "key_points": []}
