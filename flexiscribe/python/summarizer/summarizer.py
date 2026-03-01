import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from summarizer.ollama_client import generate_response
from summarizer.prompt_builder import build_minute_summary_prompt, build_cornell_prompt
from summarizer.json_utils import extract_json
from config import OLLAMA_MODEL


def summarize_minute(text, model=None):
    model = model or OLLAMA_MODEL
    return extract_json(generate_response(model, build_minute_summary_prompt(text)))


def summarize_cornell(text, model=None):
    model = model or OLLAMA_MODEL
    return extract_json(generate_response(model, build_cornell_prompt(text)))
