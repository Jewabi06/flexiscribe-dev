import json
import re
import json_repair  # pip install json-repair

def repair_json(text: str) -> str:
    """Attempt to fix common JSON errors using json_repair library."""
    try:
        # json_repair can fix unquoted keys, trailing commas, etc.
        repaired_obj = json_repair.repair_json(text, return_objects=False)
        return repaired_obj
    except Exception:
        # Fallback to manual regex fixes
        text = re.sub(r"```json\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"```", "", text)
        text = text.replace("\u201c", '"').replace("\u201d", '"')
        text = re.sub(r"[\x00-\x1f]", " ", text)
        text = re.sub(r",\s*([}\]])", r"\1", text)          # remove trailing commas
        text = re.sub(r"([{,])\s*([a-zA-Z0-9_]+)\s*:", r'\1"\2":', text)  # quote keys
        return text

def extract_json(model_output: str):
    """Safely extract JSON from model output with aggressive repair."""
    text = model_output.strip()
    repaired = repair_json(text)
    
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        # Try to locate the outermost JSON object
        match = re.search(r"\{[\s\S]*\}", repaired)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        print("[WARN] Failed to parse JSON, returning minimal valid structure.")
        return {"title": "Untitled", "key_concepts": [], "notes": [], "summary": []}

def validate_cornell_schema(data: dict, fallback_title: str = "Lecture Notes") -> dict:
    """Enforce exact Cornell schema, never return empty notes/summary."""
    if not isinstance(data, dict):
        data = {}
    
    result = {}
    result["title"] = str(data.get("title", fallback_title))
    
    # key_concepts
    raw_kc = data.get("key_concepts", [])
    if isinstance(raw_kc, list):
        result["key_concepts"] = [str(c) for c in raw_kc if c]
    else:
        result["key_concepts"] = [str(raw_kc)] if raw_kc else []
    
    # notes
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
    
    # summary
    raw_sum = data.get("summary", [])
    if isinstance(raw_sum, list):
        result["summary"] = [str(s) for s in raw_sum if s]
    elif isinstance(raw_sum, str):
        sentences = [s.strip() for s in raw_sum.split(".") if s.strip()]
        result["summary"] = sentences if sentences else [raw_sum]
    else:
        result["summary"] = [str(raw_sum)] if raw_sum else []
    
    # GUARANTEE non‑empty notes & summary using minute summaries as fallback
    if not result["notes"] and not result["key_concepts"]:
        # This should never happen if we later inject fallback, but keep as safety
        result["notes"] = [{"term": "No concepts extracted", "definition": "Check transcript", "example": ""}]
    if not result["summary"]:
        result["summary"] = ["No summary generated."]
    
    return result