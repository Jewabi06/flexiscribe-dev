from summarizer.motm import build_motm_prompt  # noqa: F401


def build_minute_summary_prompt(text: str) -> str:
    return f"""
You are summarizing a university lecture segment. The text may be in Filipino/Tagalog, English, or a mix of both (Taglish). Preserve the language style of the original — if the lecture uses Taglish, summarize in English.

Return ONLY valid JSON with no extra text:
{{
  "summary": "A concise 2-3 sentence summary of this segment",
  "key_points": ["Key point 1", "Key point 2", "Key point 3"]
}}

Lecture segment:
{text}
"""


def build_cornell_prompt(text: str) -> str:
    return f"""
Create a comprehensive Cornell Notes summary of this full lecture. The text may be in Filipino/Tagalog, English, or a mix of both (Taglish). Write the summary preserving the language style used in the lecture.

Return ONLY valid JSON with no extra text:
{{
  "title": "A descriptive title for the lecture topic",
  "cue_questions": ["Question 1 about key concept", "Question 2", "Question 3"],
  "notes": ["Important note or concept 1", "Important note 2", "Important note 3"],
  "summary": "A comprehensive 3-5 sentence summary of the entire lecture"
}}

Full lecture transcript:
{text}
"""
