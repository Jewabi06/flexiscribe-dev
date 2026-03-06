"""
Systematic prompt builder for Ollama summarization.

Architecture
────────────
Prompts are assembled from reusable, declarative components instead of
monolithic f-strings.  Each component serves one purpose:

  ROLES        – LLM persona / system context
  SCHEMAS      – JSON output format definitions
  RULES        – Processing constraints (grouped by concern)
  FORMATTERS   – Content-formatting helpers

Pipeline stages (called by summarizer.py):
  1. TOPIC_EXTRACT    → Determine main topic + subtopics from transcript
  2. MINUTE_SUMMARY   → Context-aware per-minute summaries
  3. CORNELL_ASSEMBLY → Final Cornell Notes from summaries + topic map
"""

from summarizer.motm import build_motm_prompt  # noqa: F401

# ─── Reusable Components ─────────────────────────────────────────────────

ROLES = {
    "topic_analyst": (
        "You are a curriculum topic analyst. "
        "You identify the main subject and subtopics from lecture transcripts. "
        "You understand Taglish (Filipino/English code-switching)."
    ),
    "lecture_summarizer": (
        "You are a university lecture note-taker. "
        "You create accurate, context-aware summaries from lecture segments. "
        "You understand Taglish (Filipino/English code-switching)."
    ),
    "cornell_writer": (
        "You are an expert academic note creator using the Cornell Notes method. "
        "You produce comprehensive, sequential reviewers from lecture summaries. "
        "You understand Taglish (Filipino/English code-switching)."
    ),
}

SCHEMAS = {
    "topic_extraction": (
        '{{\n'
        '  "main_topic": "The overarching lecture subject",\n'
        '  "subtopics": ["Subtopic 1 in order discussed", "Subtopic 2"]\n'
        '}}'
    ),
    "minute_summary": (
        '{{\n'
        '  "summary": "2-3 sentence summary of this segment",\n'
        '  "key_points": ["Key point 1", "Key point 2", "Key point 3"]\n'
        '}}'
    ),
    "cornell_notes": (
        '{{\n'
        '  "title": "Descriptive lecture title",\n'
        '  "key_concepts": ["Concept 1", "Concept 2"],\n'
        '  "notes": [\n'
        '    {{\n'
        '      "term": "Term or concept name",\n'
        '      "definition": "Clear definition based on the lecture",\n'
        '      "example": "Example or application from the lecture"\n'
        '    }}\n'
        '  ],\n'
        '  "summary": ["Takeaway 1", "Takeaway 2", "Takeaway 3"]\n'
        '}}'
    ),
}

RULES = {
    "context_awareness": [
        "The main topic of this lecture is: {main_topic}.",
        "Current subtopics covered: {subtopics}.",
        "Keep all content relevant to the main topic.",
        "Exclude terms or nouns clearly unrelated to the lecture subject.",
    ],
    "completeness": [
        "Cover ALL topics discussed — do not skip any subtopic.",
        "Maintain the sequential order of topics as they were taught.",
        "Longer output is acceptable when it means complete coverage.",
        "Every concept mentioned in the summaries must appear in the output.",
    ],
    "accuracy": [
        "Base content ONLY on the provided text.",
        "Do not fabricate, infer, or add external information.",
        "Preserve technical terms and definitions exactly as presented.",
    ],
    "output_format": [
        "Return ONLY valid JSON — no markdown, no code fences, no extra text.",
        "Follow the schema exactly. Do not add or remove fields.",
    ],
}

# ─── Internal helpers ─────────────────────────────────────────────────────

def _format_rules(rule_keys: list, **kwargs) -> str:
    """Assemble selected rule-sets into a numbered list."""
    lines = []
    idx = 1
    for key in rule_keys:
        for rule in RULES[key]:
            lines.append(f"{idx}. {rule.format(**kwargs)}")
            idx += 1
    return "\n".join(lines)


def _format_schema(schema_key: str) -> str:
    return f"Output JSON schema:\n{SCHEMAS[schema_key]}"


def _build_topic_block(main_topic: str, subtopics: list) -> str:
    """Create the topic-map header injected into context-aware prompts."""
    if not main_topic:
        return ""
    st_lines = "\n".join(f"  - {st}" for st in (subtopics or []))
    return (
        f"Lecture Topic Map:\n"
        f"  Main Topic: {main_topic}\n"
        f"  Subtopics (in order):\n{st_lines}\n\n"
    )


# ═══════════════════════════════════════════════════════════════════════════
# Stage 1 — Topic Extraction
# ═══════════════════════════════════════════════════════════════════════════

def build_topic_extraction_prompt(transcript_sample: str) -> str:
    """
    Phase 1: Extract main topic and ordered subtopics.
    Uses a representative sample (beginning + end) for efficiency.
    """
    rules = _format_rules(["accuracy", "output_format"])
    schema = _format_schema("topic_extraction")
    return (
        "Analyze this lecture transcript and identify:\n"
        "1. The main topic/subject of the entire lecture\n"
        "2. All subtopics discussed, in chronological order\n\n"
        f"Rules:\n{rules}\n\n"
        f"{schema}\n\n"
        f"Transcript:\n{transcript_sample}"
    )


# ═══════════════════════════════════════════════════════════════════════════
# Stage 2 — Per-Minute Summary (context-aware)
# ═══════════════════════════════════════════════════════════════════════════

def build_minute_summary_prompt(
    text: str,
    main_topic: str = "",
    subtopics: list = None,
) -> str:
    """
    Phase 2: Summarise one minute of lecture audio.
    When *main_topic* is provided, the prompt includes context so the
    model filters irrelevant content and stays on-topic.
    """
    context_block = ""
    if main_topic:
        subtopics_str = ", ".join(subtopics or [])
        context_rules = _format_rules(
            ["context_awareness"],
            main_topic=main_topic,
            subtopics=subtopics_str,
        )
        context_block = f"Context:\n{context_rules}\n\n"

    rules = _format_rules(["accuracy", "output_format"])
    schema = _format_schema("minute_summary")
    return (
        f"{context_block}"
        "Summarize this lecture segment.\n\n"
        f"Rules:\n{rules}\n\n"
        f"{schema}\n\n"
        f"Segment:\n{text}"
    )


# ═══════════════════════════════════════════════════════════════════════════
# Stage 3 — Cornell Notes Assembly (from minute summaries)
# ═══════════════════════════════════════════════════════════════════════════

def build_cornell_from_summaries_prompt(
    summaries_text: str,
    main_topic: str = "",
    subtopics: list = None,
) -> str:
    """
    Phase 3: Assemble comprehensive Cornell Notes.
    Uses the topic map from Phase 1 to guarantee completeness.
    """
    topic_block = _build_topic_block(main_topic, subtopics)
    rules = _format_rules(["completeness", "accuracy", "output_format"])
    schema = _format_schema("cornell_notes")
    return (
        f"{topic_block}"
        "Create comprehensive Cornell Notes from these per-minute lecture summaries.\n\n"
        f"Critical requirements:\n{rules}\n\n"
        "Formatting:\n"
        "- Group notes by subtopic, in the order they were taught.\n"
        "- Each note MUST have term, definition, and example.\n"
        "- key_concepts: list ALL important terms/concepts from the lecture.\n"
        "- summary: list sequential takeaway points covering the entire lecture.\n\n"
        f"{schema}\n\n"
        f"Per-minute summaries:\n{summaries_text}"
    )


# ═══════════════════════════════════════════════════════════════════════════
# Fallback — Cornell Notes directly from full transcript
# ═══════════════════════════════════════════════════════════════════════════

def build_cornell_prompt(
    text: str,
    main_topic: str = "",
    subtopics: list = None,
) -> str:
    """Generate Cornell Notes directly from raw transcript text."""
    topic_block = _build_topic_block(main_topic, subtopics)
    rules = _format_rules(["completeness", "accuracy", "output_format"])
    schema = _format_schema("cornell_notes")
    return (
        f"{topic_block}"
        "Create comprehensive Cornell Notes from this lecture transcript.\n\n"
        f"Critical requirements:\n{rules}\n\n"
        "Formatting:\n"
        "- Group notes by subtopic, in order of appearance.\n"
        "- Each note: term, definition, example.\n"
        "- key_concepts: ALL important terms.\n"
        "- summary: sequential takeaways covering the full lecture.\n\n"
        f"{schema}\n\n"
        f"Transcript:\n{text}"
    )
