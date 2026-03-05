from summarizer.motm import build_motm_prompt  # noqa: F401


def build_minute_summary_prompt(text: str) -> str:
    return f"""
You are summarizing a university lecture segment. The text may be in Filipino/Tagalog, English, or a mix of both (Taglish). Preserve the language style of the original — if the lecture uses Taglish, summarize in English.

IMPORTANT — Uniqueness rules:
- Vary your wording and sentence structure each time you generate a summary.
- Do NOT repeat identical phrases or sentences from any prior output.
- Produce a fresh, original summary that captures the essence of the lesson without copying previous responses.
- All key points must still be covered accurately and remain faithful to the lecture content.

Return ONLY valid JSON with no extra text:
{{
  "summary": "A concise 2-3 sentence summary of this segment",
  "key_points": ["Key point 1", "Key point 2", "Key point 3"]
}}

Lecture segment:
{text}
"""


def build_cornell_from_summaries_prompt(summaries_text: str) -> str:
    return f"""
Create a comprehensive Cornell Notes reviewer from these per-minute lecture summaries.
The text may be in Filipino/Tagalog, English, or a mix of both (Taglish).
Write all content preserving the language style used in the lecture.

Rules:
- All content must be factually based on the summaries provided.
- Organize by topic in the order they appear.
- Cover all major topics — ensure every significant concept appears in the reviewer.
- Merge related key points from different minutes into cohesive notes.

Uniqueness rules:
- Vary your wording, sentence structure, and phrasing.
- The output must be a fresh, original reviewer that faithfully captures the lesson.
- All key concepts and terms must still be fully covered and accurate.

Return ONLY valid JSON with no extra text:
{{
  "title": "A descriptive title for the lecture topic",
  "key_concepts": ["Important keyword or concept 1", "Important keyword or concept 2"],
  "notes": [
    {{
      "term": "Term or concept name",
      "definition": "Clear definition of the term based on the lecture",
      "example": "An example or application mentioned or implied in the lecture"
    }}
  ],
  "summary": ["Concise takeaway point 1", "Concise takeaway point 2", "Concise takeaway point 3"]
}}

Per-minute lecture summaries:
{summaries_text}
"""


def build_cornell_prompt(text: str) -> str:
    return f"""
Create a comprehensive Cornell Notes reviewer from this full lecture transcript. The text may be in Filipino/Tagalog, English, or a mix of both (Taglish). Write all content preserving the language style used in the lecture.

Rules:
- All content must be factually based on the lecture text only.
- Organize by topic in the order they appear in the transcript.
- Cover all major topics — ensure every significant concept from the transcript appears in the reviewer.

Uniqueness rules:
- Vary your wording, sentence structure, and phrasing each time you generate a reviewer.
- Avoid repeating identical phrases or paragraphs from any prior output.
- The output must be a fresh, original reviewer that faithfully captures the lesson without copying previous responses.
- All key concepts and terms must still be fully covered and accurate.

Return ONLY valid JSON with no extra text:
{{
  "title": "A descriptive title for the lecture topic",
  "key_concepts": ["Important keyword or concept 1", "Important keyword or concept 2"],
  "notes": [
    {{
      "term": "Term or concept name",
      "definition": "Clear definition of the term based on the lecture",
      "example": "An example or application mentioned or implied in the lecture"
    }}
  ],
  "summary": ["Concise takeaway point 1", "Concise takeaway point 2", "Concise takeaway point 3"]
}}

Full lecture transcript:
{text}
"""
