"""
utils/gemini_client.py

The ONLY module allowed to import google.genai — every AI agent calls
generate_json() here instead of touching the SDK directly. This is the
same isolation pattern as firebase/firebase_config.py: one file owns the
third-party client, everything else depends on a small function signature
that's trivial to mock in tests.

Uses the current `google-genai` SDK (the old `google-generativeai`
package is fully deprecated by Google as of this writing — see
https://github.com/google-gemini/deprecated-generative-ai-python).

generate_json() forces the model to return structured JSON (via
response_mime_type="application/json") and returns it already parsed, so
agents never hand-roll JSON extraction from a text blob.
"""

import json

from google import genai
from google.genai import types

from config.settings import settings

_client: genai.Client | None = None


class GeminiClientError(Exception):
    """Raised when Gemini cannot be reached or returns unparsable output."""


def _get_client() -> genai.Client:
    global _client
    if _client is not None:
        return _client
    if not settings.GEMINI_API_KEY:
        raise GeminiClientError(
            "GEMINI_API_KEY is not set. Add it to backend/.env (see .env.example)."
        )
    _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def generate_json(prompt: str, temperature: float = 0.4) -> dict | list:
    """
    Send `prompt` to Gemini and return the parsed JSON response.

    Raises GeminiClientError if the API call fails or the response is not
    valid JSON — callers (agents) decide whether to retry, never this
    function, so retry policy stays visible in agent code, not hidden here.
    """
    client = _get_client()

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=temperature,
                response_mime_type="application/json",
            ),
        )
    except Exception as exc:  # noqa: BLE001
        raise GeminiClientError(f"Gemini API call failed: {exc}") from exc

    raw_text = (response.text or "").strip()
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise GeminiClientError(
            f"Gemini did not return valid JSON: {exc}. Raw output: {raw_text[:500]}"
        ) from exc
