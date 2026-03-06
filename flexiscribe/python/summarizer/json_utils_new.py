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
    text = text.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'")

    # Remove control characters that break JSON
    text = re.sub(r"[\x00-\x1f]", " ", text)

    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to locate the outermost JSON object in the text
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        print("[WARN] Failed to parse JSON, returning raw text fallback")
        return {"summary": text, "key_points": []}


def validate_cornell_schema(data: dict, fallback_title: str = "Lecture Notes") -> dict:
    """
    Normalise Ollama output to the canonical Cornell Notes schema:

        {
            "title":        str,
            "key_concepts": [str, ...],
            "notes":        [{"term": str, "definition": str, "example": str}, ...],
            "summary":      [str, ...]
        }

    Any deviation (wrong types, missing fields, flat strings) is coerced
    so downstream consumers always receive a consistent shape.
    """
    result = {}

    # title
    result["title"] = str(data.get("title", fallback_title))

    # key_concepts - list[str]
    raw_kc = data.get("key_concepts", [])
    if isinstance(raw_kc, list):
        result["key_concepts"] = [str(c) for c in raw_kc if c]
    else:
        result["key_concepts"] = [str(raw_kc)] if raw_kc else []

    # notes - list[{term, definition, example}]
    raw_notes = data.get("notes", [])
    normalised = []
    if isinstance(raw_notes, list):
        for note in raw_notes:
            if isinstance(note, dict):
                normalised.append({
                    "term": str(note.get("term", "")),
                    "definition": str(note.get("definition", "")),
                    "example": str(note.get("example", "")),
                })
            elif isinstance(note, str):
                normalised.append({"term": note, "definition": "", "example": ""})
    result["notes"] = normalised

    # summary - list[str]
    raw_sum = data.get("summary", [])
    if isinstance(raw_sum, list):
        result["summary"] = [str(s) for s in raw_sum if s]
    elif isinstance(raw_sum, str):
        sentences = [s.strip() for s in raw_sum.split(".") if s.strip()]
        result["summary"] = sentences if sentences else [raw_sum]
    else:
        result["summary"] = [str(raw_sum)] if raw_sum else []

    return result
