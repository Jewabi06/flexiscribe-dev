"""
Context-aware summarisation pipeline.

Stages:
  1. extract_topics()                  – identify main-topic + subtopics
  2. summarize_minute()                – per-minute with topic context
  3. summarize_cornell_context_aware() – final Cornell from summaries + topic map
  4. validate_cornell_schema()         – guarantee consistent JSON shape
"""

import sys
import os
import time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from summarizer.ollama_client import generate_response, generate_response_remote
from summarizer.prompt_builder import (
    build_topic_extraction_prompt,
    build_minute_summary_prompt,
    build_cornell_from_summaries_prompt,
    build_cornell_prompt,
    build_motm_prompt,
)
from summarizer.json_utils import extract_json, validate_cornell_schema
from config import OLLAMA_MODEL, OLLAMA_CORNELL_MODEL

# ═══════════════════════════════════════════════════════════════════════════
# Stage 1 — Topic Extraction
# ═══════════════════════════════════════════════════════════════════════════

def extract_topics(chunks: list, model=None, remote=False) -> dict:
    """
    Analyse transcript chunks to determine the main topic and subtopics.
    Uses a representative sample (first 5 + last 3 chunks) for speed.

    When remote=True, uses the GPU-powered OLLAMA_BASE_URL for faster inference.
    """
    model = model or OLLAMA_MODEL

    sample = chunks[:5] + chunks[-3:] if len(chunks) > 8 else chunks
    sample_text = "\n".join(
        f"[{c.get('timestamp', '')}] {c.get('text', '')}" for c in sample
    )

    prompt = build_topic_extraction_prompt(sample_text)
    gen_fn = generate_response_remote if remote else generate_response
    result = extract_json(
        gen_fn(model, prompt, profile="short", system="topic_analyst")
    )
    return {
        "main_topic": result.get("main_topic", "Unknown Topic"),
        "subtopics": result.get("subtopics", []),
    }

# ═══════════════════════════════════════════════════════════════════════════
# Stage 2 — Per-Minute Summary
# ═══════════════════════════════════════════════════════════════════════════

def summarize_minute(text, model=None, main_topic="", subtopics=None):
    """Generate a per-minute summary, optionally with topic context."""
    model = model or OLLAMA_MODEL
    prompt = build_minute_summary_prompt(text, main_topic, subtopics)
    return extract_json(generate_response(model, prompt))

# ═══════════════════════════════════════════════════════════════════════════
# Stage 3 — Context-Aware Cornell Notes (primary entry-point)
# ═══════════════════════════════════════════════════════════════════════════

def _format_summaries_for_cornell(minute_summaries: list, max_chars: int = 12000) -> str:
    """Format minute summary dicts into a structured text block, truncated."""
    parts = []
    total = 0
    for ms in minute_summaries:
        minute_num = ms.get("minute", "?")
        timestamp = ms.get("timestamp", "")
        summary = ms.get("summary", "")[:300]          # cap each summary
        key_points = ms.get("key_points", [])[:3]     # limit key points
        block = f"Minute {minute_num} ({timestamp}):\nSummary: {summary}"
        if key_points:
            block += "\nKey points:\n" + "\n".join(f"- {kp[:100]}" for kp in key_points)
        if total + len(block) > max_chars:
            break
        parts.append(block)
        total += len(block)
    return "\n\n".join(parts)

def summarize_cornell_context_aware(
    transcript_chunks: list,
    minute_summaries: list,
    model=None,
    max_retries=3,
) -> dict:
    """Generate final Cornell Notes using remote GPU model with automatic retries."""
    model = model or OLLAMA_CORNELL_MODEL
    print(f"[SUMMARIZER] Generating final summary using remote model: {model}")

    # Validate input
    if not transcript_chunks or not isinstance(transcript_chunks, list):
        raise ValueError("transcript_chunks must be a non‑empty list")
    for chunk in transcript_chunks:
        if not isinstance(chunk, dict) or "text" not in chunk:
            raise ValueError("Each chunk must be a dict with a 'text' field")

    topics = extract_topics(transcript_chunks, model, remote=True)
    main_topic = topics["main_topic"]
    subtopics = topics["subtopics"]
    summaries_text = _format_summaries_for_cornell(minute_summaries)

    last_error = None
    for attempt in range(max_retries):
        prompt = build_cornell_from_summaries_prompt(summaries_text, main_topic, subtopics)
        try:
            raw = generate_response_remote(model, prompt, profile="extended")
            data = extract_json(raw)
            validated = validate_cornell_schema(data, main_topic)
            if validated.get("notes") or validated.get("key_concepts"):
                print(f"[SUMMARIZER] Success on attempt {attempt+1}")
                return validated
            else:
                last_error = "Empty or invalid JSON structure returned by Ollama"
                print(f"[SUMMARIZER] Attempt {attempt+1}: {last_error}, retrying...")
        except Exception as e:
            last_error = str(e)
            print(f"[SUMMARIZER] Attempt {attempt+1} failed: {last_error}, retrying...")
        if attempt < max_retries - 1:
            time.sleep(2 ** attempt)   # exponential backoff: 1s, 2s, 4s
            summaries_text += "\n\n[CRITICAL] Previous output was invalid. Return ONLY valid JSON matching the exact schema."

    # All retries exhausted – raise error (no fallback)
    raise RuntimeError(
        f"Ollama summarization failed after {max_retries} attempts. "
        f"Last error: {last_error}"
    )

def summarize_motm(transcript, model=None):
    """Generate Minutes of the Meeting using remote GPU model with automatic retries."""
    model = model or OLLAMA_CORNELL_MODEL
    print(f"[SUMMARIZER] MOTM using remote model {model}")
    max_retries = 3
    last_error = None
    for attempt in range(max_retries):
        try:
            result = extract_json(
                generate_response_remote(model, build_motm_prompt(transcript), profile="extended")
            )
            # Basic validation: must have agendas or meeting_title
            if result.get("agendas") or result.get("meeting_title"):
                print(f"[SUMMARIZER] MOTM success on attempt {attempt+1}")
                return result
            else:
                last_error = "Invalid MOTM structure"
                print(f"[SUMMARIZER] MOTM attempt {attempt+1}: {last_error}, retrying...")
        except Exception as e:
            last_error = str(e)
            print(f"[SUMMARIZER] MOTM attempt {attempt+1} failed: {last_error}, retrying...")
        if attempt < max_retries - 1:
            time.sleep(2 ** attempt)
    raise RuntimeError(f"MOTM summarization failed after {max_retries} attempts: {last_error}")

# ═══════════════════════════════════════════════════════════════════════════
# Legacy / fallback functions (backward compatible)
# ═══════════════════════════════════════════════════════════════════════════

def summarize_cornell(text, model=None):
    """Cornell Notes directly from full text (no topic context)."""
    model = model or OLLAMA_MODEL
    result = extract_json(
        generate_response(model, build_cornell_prompt(text), profile="extended")
    )
    return validate_cornell_schema(result)

def summarize_cornell_remote(text, model=None):
    """Cornell Notes using remote GPU-powered Ollama backend."""
    model = model or OLLAMA_CORNELL_MODEL
    result = extract_json(
        generate_response_remote(model, build_cornell_prompt(text), profile="extended")
    )
    return validate_cornell_schema(result)

def summarize_cornell_from_summaries(summaries_text, model=None):
    """Cornell Notes from pre-formatted summaries text (no topic context)."""
    model = model or OLLAMA_MODEL
    result = extract_json(
        generate_response(
            model, build_cornell_from_summaries_prompt(summaries_text), profile="extended"
        )
    )
    return validate_cornell_schema(result)