"""
utils/gemini_client.py

The ONLY module allowed to import any third-party LLM SDK/HTTP call —
every AI agent calls generate_json() here instead of touching a provider
directly. Same isolation pattern as firebase/firebase_config.py: one file
owns every third-party client, everything else depends on a small
function signature that's trivial to mock in tests.

generate_json() walks settings.AI_PROVIDER_CHAIN (e.g. "gemini,groq") in
order and returns the first successful result. A provider is skipped
automatically if its API key isn't set — no config error, it just moves
to the next one. This exists because Gemini's free tier intermittently
returns 503 UNAVAILABLE under load; rather than a human flipping an env
var and redeploying mid-demo, the code now does that automatically,
per-request, with zero downtime.

Providers currently supported: "gemini", "groq", "cerebras", "openrouter".
Cerebras and OpenRouter are both OpenAI-compatible REST APIs, so they
share one small HTTP helper instead of pulling in another SDK each.
"""

import json

import requests

from config.settings import settings

_gemini_client = None
_groq_client = None


class GeminiClientError(Exception):
    """Raised when a single provider call fails or returns unparsable
    output. Name kept for backward compatibility with existing agent
    code — it now covers every provider, not just Gemini."""


def _strip_code_fences(text: str) -> str:
    """Some open-weight models wrap JSON in ```json fences despite being
    told not to — strip defensively before parsing, same fix applied
    across every non-Gemini provider below."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    return text


# ---------------------------------------------------------------------
# Gemini (google-genai)
# ---------------------------------------------------------------------
def _get_gemini_client(api_key: str | None = None):
    if api_key:
        # An override key is a distinct client, never cached on the
        # shared _gemini_client global — that global is specifically
        # for the default (no-override) case.
        from google import genai
        return genai.Client(api_key=api_key)
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client
    from google import genai
    _gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _gemini_client


def _generate_json_gemini(prompt: str, temperature: float, api_key: str | None = None) -> dict | list:
    from google.genai import types

    client = _get_gemini_client(api_key)
    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=temperature,
            response_mime_type="application/json",
        ),
    )
    raw_text = (response.text or "").strip()
    return json.loads(raw_text)


# ---------------------------------------------------------------------
# Groq (official SDK, OpenAI-compatible chat.completions)
# ---------------------------------------------------------------------
def _get_groq_client():
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    from groq import Groq
    _groq_client = Groq(api_key=settings.GROQ_API_KEY)
    return _groq_client


def _generate_json_groq(prompt: str, temperature: float) -> dict | list:
    client = _get_groq_client()
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        temperature=temperature,
        messages=[
            {"role": "system", "content": "You always respond with valid JSON only — no prose, no markdown code fences."},
            {"role": "user", "content": prompt},
        ],
    )
    raw_text = _strip_code_fences(response.choices[0].message.content or "")
    return json.loads(raw_text)


# ---------------------------------------------------------------------
# Cerebras + OpenRouter (both plain HTTP, OpenAI-compatible /chat/completions)
# ---------------------------------------------------------------------
def _generate_json_openai_compatible(
    base_url: str, api_key: str, model: str, prompt: str, temperature: float,
    extra_headers: dict | None = None,
) -> dict | list:
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)

    resp = requests.post(
        f"{base_url}/chat/completions",
        headers=headers,
        json={
            "model": model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": "You always respond with valid JSON only — no prose, no markdown code fences."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=30,
    )
    resp.raise_for_status()
    raw_text = _strip_code_fences(resp.json()["choices"][0]["message"]["content"] or "")
    return json.loads(raw_text)


def _generate_json_cerebras(prompt: str, temperature: float) -> dict | list:
    return _generate_json_openai_compatible(
        settings.CEREBRAS_BASE_URL, settings.CEREBRAS_API_KEY, settings.CEREBRAS_MODEL,
        prompt, temperature,
    )


def _generate_json_openrouter(prompt: str, temperature: float) -> dict | list:
    return _generate_json_openai_compatible(
        settings.OPENROUTER_BASE_URL, settings.OPENROUTER_API_KEY, settings.OPENROUTER_MODEL,
        prompt, temperature,
        # OpenRouter asks for these but doesn't require real values — harmless to include.
        extra_headers={"HTTP-Referer": "https://learnmatrix.onrender.com", "X-Title": "LearnMatrix"},
    )


_PROVIDER_NAMES = {
    "gemini": ("_generate_json_gemini", lambda: settings.GEMINI_API_KEY),
    "groq": ("_generate_json_groq", lambda: settings.GROQ_API_KEY),
    "cerebras": ("_generate_json_cerebras", lambda: settings.CEREBRAS_API_KEY),
    "openrouter": ("_generate_json_openrouter", lambda: settings.OPENROUTER_API_KEY),
}


def generate_json(prompt: str, temperature: float = 0.4, gemini_api_key: str | None = None) -> dict | list:
    """
    Try each provider in settings.AI_PROVIDER_CHAIN, in order, until one
    succeeds. Providers with no API key configured are skipped silently.
    Raises GeminiClientError only if every provider in the chain failed
    (or none had a key set) — the error message lists what was tried.

    gemini_api_key: optional override, used ONLY when the current
    provider in the chain is "gemini" — lets one caller (e.g. Assessment
    question generation) use a separate Gemini key/quota from every
    other agent, without needing its own copy of this whole function.
    Falls back to settings.GEMINI_API_KEY when not passed, same as
    before this parameter existed.

    Provider functions are looked up by name from this module's globals
    at call time (not captured as direct references at import time) so
    that unit tests can patch e.g. `gemini_client._generate_json_gemini`
    and have generate_json() actually pick up the patched version.
    """
    attempts = []
    for provider_name in settings.AI_PROVIDER_CHAIN:
        entry = _PROVIDER_NAMES.get(provider_name)
        if entry is None:
            attempts.append(f"{provider_name}: unknown provider, skipped")
            continue
        func_name, get_key = entry
        use_override = provider_name == "gemini" and gemini_api_key
        key = gemini_api_key if use_override else get_key()
        if not key:
            attempts.append(f"{provider_name}: no API key set, skipped")
            continue
        try:
            func = globals()[func_name]
            result = func(prompt, temperature, api_key=gemini_api_key) if use_override else func(prompt, temperature)
            print(f"[AI_PROVIDER] request served by: {provider_name}", flush=True)
            return result
        except Exception as exc:  # noqa: BLE001
            print(f"[AI_PROVIDER] {provider_name} failed: {exc}", flush=True)
            attempts.append(f"{provider_name}: {exc}")
            continue

    raise GeminiClientError(
        "All providers in AI_PROVIDER_CHAIN failed or were unavailable:\n"
        + "\n".join(f"  - {a}" for a in attempts)
    )


def generate_embedding(text: str) -> list[float]:
    """
    Generate embeddings using Gemini.
    """
    client = _get_gemini_client()

    response = client.models.embed_content(
        model="text-embedding-004",
        contents=text,
    )

    return response.embeddings[0].values
