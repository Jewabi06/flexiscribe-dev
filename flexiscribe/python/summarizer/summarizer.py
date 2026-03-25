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

def summarize_cornell_context_aware(
    transcript_chunks: list,
    minute_summaries: list,
    model=None,
) -> dict:
    """
    Multi-stage context-aware Cornell Notes generation.

    Uses the remote GPU-powered Ollama instance (OLLAMA_BASE_URL) with
    gemma3:4b for faster, higher-quality output — mirroring the approach
    used in quiz generation.

    Pipeline:
      1. Extract topics from the full transcript  (remote GPU)
      2. Format summaries text with topic context
      3. Generate Cornell Notes with completeness guarantees  (remote GPU)
      4. Validate and normalise output schema
    """
    model = model or OLLAMA_CORNELL_MODEL

    print(f"[SUMMARIZER] Using remote OLLAMA_BASE_URL with model {model}")

    # Stage 1 — topic extraction (remote GPU)
    topics = extract_topics(transcript_chunks, model, remote=True)
    main_topic = topics["main_topic"]
    subtopics = topics["subtopics"]
    print(f"[SUMMARIZER] Topic: {main_topic}")
    print(f"[SUMMARIZER] Subtopics: {subtopics}")

    # Stage 2 — build structured summaries text
    summaries_text = _format_summaries_for_cornell(minute_summaries)

    # Stage 3 — generate Cornell Notes with topic awareness (remote GPU)
    prompt = build_cornell_from_summaries_prompt(summaries_text, main_topic, subtopics)
    result = extract_json(
        generate_response_remote(model, prompt, profile="extended")
    )

    # Stage 4 — validate schema
    return validate_cornell_schema(result, main_topic)


def _format_summaries_for_cornell(minute_summaries: list) -> str:
    """Format minute-summary dicts into a structured text block."""
    parts = []
    for ms in minute_summaries:
        minute_num = ms.get("minute", "?")
        timestamp = ms.get("timestamp", "")
        summary = ms.get("summary", "")
        key_points = ms.get("key_points", [])

        block = f"Minute {minute_num} ({timestamp}):\nSummary: {summary}"
        if key_points:
            block += "\nKey points:\n" + "\n".join(f"- {kp}" for kp in key_points)
        parts.append(block)
    return "\n\n".join(parts)


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


def summarize_motm(transcript, model=None):
    model = model or OLLAMA_CORNELL_MODEL
    print(f"[SUMMARIZER] MOTM using remote OLLAMA_BASE_URL with model {model}")
    return extract_json(
        generate_response_remote(model, build_motm_prompt(transcript), profile="extended")
    )
