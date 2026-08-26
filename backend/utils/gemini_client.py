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
returns 503 UNAVAILABLE or 429 rate-limited under load; rather than a
human flipping an env var and redeploying mid-demo, the code now does
that automatically, per-request, with zero downtime.

Within the "gemini" step specifically, there's an OPTIONAL second
rotation layer: a caller can pass gemini_key_pool=[...] to generate_json()
to have extra keys tried, in order, before Gemini as a whole is
considered failed and the chain moves on to groq/cerebras/openrouter.
This is opt-in per call, NOT a global setting every feature shares —
only the diagnostic assessment currently passes one
(settings.GEMINI_API_KEYS_POOL_ASSESSMENT), since it's the heaviest AI
feature and giving every other feature the same pool would mean
assessment is competing with everything else for its own headroom.
See _gemini_key_candidates() below — and its docstring for why each
pool key needs to be from a SEPARATE Google Cloud project to actually
help (Gemini's free-tier quota is per-project, not per-key).

Providers currently supported: "gemini", "groq", "cerebras", "openrouter".
Cerebras and OpenRouter are both OpenAI-compatible REST APIs, so they
share one small HTTP helper instead of pulling in another SDK each.
"""

import json
import logging

import requests

from config.settings import settings

logger = logging.getLogger(__name__)

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
# BUG FIX (found via a "timeout of 60000ms exceeded" the user hit on
# slide-deck generation): the google-genai SDK has its OWN internal
# retry loop for 429/5xx errors — up to 4 attempts with delays that can
# grow to 60s each (see Google's retry-strategy docs). Our AI_PROVIDER
# chain above already IS the retry/failover strategy (gemini -> groq ->
# cerebras -> openrouter), so leaving the SDK's internal retries on
# means a single rate-limited Gemini call can silently eat the entire
# 60s frontend timeout by itself, before generate_json() ever gets to
# try the next provider — exactly what the log showed (a 429 with a
# ~54s server-suggested retry delay, then the request just hanging).
# attempts=1 makes a failing Gemini call fail fast so the chain below
# actually gets a chance to run within the caller's timeout budget.
_GEMINI_HTTP_OPTIONS = None


def _gemini_http_options():
    global _GEMINI_HTTP_OPTIONS
    if _GEMINI_HTTP_OPTIONS is None:
        from google.genai import types
        _GEMINI_HTTP_OPTIONS = types.HttpOptions(
            timeout=20_000,  # ms — fail fast, don't eat the frontend's 60s budget
            retry_options=types.HttpRetryOptions(attempts=1),
        )
    return _GEMINI_HTTP_OPTIONS


def _get_gemini_client(api_key: str | None = None):
    if api_key:
        # An override key is a distinct client, never cached on the
        # shared _gemini_client global — that global is specifically
        # for the default (no-override) case.
        from google import genai
        return genai.Client(api_key=api_key, http_options=_gemini_http_options())
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client
    from google import genai
    _gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options=_gemini_http_options())
    return _gemini_client


# Multi-speaker TTS rendering (generate_speech_audio below) is a
# fundamentally longer call than a text/JSON generation call — it has
# to render actual audio for an entire 8-26 line podcast script, not
# just return a short block of text. Sharing the 20s "fail fast" JSON
# timeout above was causing genuine in-progress TTS calls to be killed
# with httpx.ReadTimeout before Gemini could finish. This client is
# kept separate (own longer timeout, own cache) so JSON generation
# elsewhere keeps failing fast while TTS gets the room it actually
# needs.
_GEMINI_TTS_HTTP_OPTIONS = None
_gemini_tts_client = None


def _gemini_tts_http_options():
    global _GEMINI_TTS_HTTP_OPTIONS
    if _GEMINI_TTS_HTTP_OPTIONS is None:
        from google.genai import types
        _GEMINI_TTS_HTTP_OPTIONS = types.HttpOptions(
            timeout=100_000,  # ms — audio rendering genuinely takes longer than a JSON call;
            # kept under the frontend's AUDIO_OVERVIEW_TIMEOUT_MS / AUDIO_SYNTHESIZE_TIMEOUT_MS
            # (see frontend/src/services/audioOverviewService.js) so a slow-but-succeeding
            # TTS call isn't cut off client-side before this server-side timeout would even fire.
            retry_options=types.HttpRetryOptions(attempts=1),
        )
    return _GEMINI_TTS_HTTP_OPTIONS


def _get_gemini_tts_client(api_key: str | None = None):
    if api_key:
        from google import genai
        return genai.Client(api_key=api_key, http_options=_gemini_tts_http_options())
    global _gemini_tts_client
    if _gemini_tts_client is not None:
        return _gemini_tts_client
    from google import genai
    _gemini_tts_client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options=_gemini_tts_http_options())
    return _gemini_tts_client


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


def _gemini_key_candidates(override_key: str | None, key_pool: list[str] | None) -> list[str]:
    """
    Builds the ordered list of Gemini keys to try for one call: the key
    that would normally be used first (an override like
    GEMINI_API_KEY_ASSESSMENT if one was passed, else the plain
    GEMINI_API_KEY), then every key in key_pool as a fallback rotation,
    skipping any duplicate already in the list.

    key_pool is None/empty for every caller by default — it's an
    explicit opt-in (see generate_json()'s gemini_key_pool param), NOT
    a global setting every feature automatically shares. The diagnostic
    assessment is the only current caller that passes one
    (settings.GEMINI_API_KEYS_POOL_ASSESSMENT, from
    agents/question_generation_agent.py) — chat, flashcards, notes,
    mind maps, slide decks, and topic quizzes all still get exactly one
    key attempt before falling to groq/cerebras/openrouter, same as
    before this rotation feature existed.

    IMPORTANT: rotating keys only helps if each key is from a SEPARATE
    Google Cloud project — Gemini's free-tier quota is tracked per
    project, so two keys from the same project share one quota and
    trying the second one after the first gets rate-limited just fails
    again immediately.
    """
    keys: list[str] = []
    primary = override_key or settings.GEMINI_API_KEY
    if primary:
        keys.append(primary)
    for pool_key in (key_pool or []):
        if pool_key and pool_key not in keys:
            keys.append(pool_key)
    return keys


def _generate_json_gemini_with_rotation(
    prompt: str,
    temperature: float,
    override_key: str | None,
    key_pool: list[str] | None,
    attempts_log: list[str],
) -> dict | list:
    """
    Tries every candidate key from _gemini_key_candidates() in order,
    returning the first success. Raises GeminiClientError (with every
    key's failure appended to attempts_log for the caller's error
    message) only if ALL of them failed — that's what tells generate_json()
    to give up on "gemini" as a provider and move to the next one in
    AI_PROVIDER_CHAIN.
    """
    candidates = _gemini_key_candidates(override_key, key_pool)
    if not candidates:
        attempts_log.append("gemini: no API key set, skipped")
        raise GeminiClientError("gemini: no API key set")

    last_exc: Exception | None = None
    for i, key in enumerate(candidates):
        try:
            result = _generate_json_gemini(prompt, temperature, api_key=key)
            if i > 0:
                print(f"[AI_PROVIDER] gemini succeeded on rotation key #{i + 1}/{len(candidates)}", flush=True)
            return result
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            print(f"[AI_PROVIDER] gemini key #{i + 1}/{len(candidates)} failed: {exc}", flush=True)
            attempts_log.append(f"gemini (key #{i + 1}/{len(candidates)}): {exc}")
            continue

    raise GeminiClientError(f"gemini: all {len(candidates)} key(s) failed, last error: {last_exc}")


# ---------------------------------------------------------------------
# Gemini image generation (services/image_service.py's generate_ai_image)
# ---------------------------------------------------------------------
def generate_image(prompt: str, api_key: str | None = None) -> bytes | None:
    """Best-effort creative image generation via Gemini's image-capable
    model (settings.GEMINI_IMAGE_MODEL). Returns raw image bytes, or
    None on ANY failure — missing key, unsupported model, safety block,
    network hiccup, empty response. Callers (image_service.py) fall
    back to a Pexels stock photo whenever this returns None, so an
    image-gen outage never breaks deck generation."""
    if not (api_key or settings.GEMINI_API_KEY) or not prompt or not prompt.strip():
        return None
    try:
        from google.genai import types

        client = _get_gemini_client(api_key)
        response = client.models.generate_content(
            model=settings.GEMINI_IMAGE_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
        )
        for candidate in getattr(response, "candidates", None) or []:
            parts = getattr(getattr(candidate, "content", None), "parts", None) or []
            for part in parts:
                inline_data = getattr(part, "inline_data", None)
                if inline_data is not None and getattr(inline_data, "data", None):
                    return inline_data.data
        return None
    except Exception:
        return None


# ---------------------------------------------------------------------
# Gemini speech generation (services/audio_overview_service.py's
# generate_podcast_audio) — real two-voice Audio Overview narration,
# NotebookLM-style, replacing the old browser-only window.speechSynthesis
# reading a single flat script.
# ---------------------------------------------------------------------
def _wrap_pcm_as_wav(pcm_bytes: bytes, sample_rate: int = 24000, channels: int = 1, bits_per_sample: int = 16) -> bytes:
    """Gemini's TTS models return raw headerless PCM (16-bit signed,
    little-endian, mono, 24kHz) — this prepends a standard 44-byte WAV
    header so the bytes are directly playable by a browser <audio>
    element / data: URI, without needing ffmpeg or any audio library
    as a dependency."""
    import struct

    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8
    data_size = len(pcm_bytes)
    header = b"RIFF" + struct.pack("<I", 36 + data_size) + b"WAVE"
    header += b"fmt " + struct.pack("<IHHIIHH", 16, 1, channels, sample_rate, byte_rate, block_align, bits_per_sample)
    header += b"data" + struct.pack("<I", data_size)
    return header + pcm_bytes


def generate_speech_audio(
    script_turns: list[dict],
    speaker_voice_map: dict[str, str],
    api_key: str | None = None,
) -> bytes | None:
    """Renders a multi-speaker conversation script into ONE real WAV
    audio file via Gemini's native TTS model (settings.GEMINI_TTS_MODEL).

    script_turns: [{"speaker": "Host A", "line": "..."}, ...] — speaker
    names here must be the exact keys used in speaker_voice_map (max 2
    distinct speakers; Gemini's multi-speaker TTS supports up to 2).

    Returns complete WAV file bytes ready to be base64-encoded into a
    data: URI (same "generate bytes, caller decides how to ship them"
    contract as generate_image above), or None on ANY failure — missing
    key, unsupported model, safety block, empty response, more than 2
    distinct speakers, network hiccup. Callers should treat None as
    "Audio Overview generation failed" and surface a clear error rather
    than silently degrading, since (unlike a slide's illustration) the
    audio IS the deliverable here.
    """
    if not (api_key or settings.GEMINI_API_KEY) or not script_turns:
        return None
    speakers = list(dict.fromkeys(turn.get("speaker", "") for turn in script_turns if turn.get("speaker")))
    if not speakers or len(speakers) > 2:
        return None
    if any(name not in speaker_voice_map for name in speakers):
        return None

    transcript = "\n".join(f"{turn['speaker']}: {turn['line']}" for turn in script_turns if turn.get("line"))
    if not transcript.strip():
        return None

    try:
        from google.genai import types

        client = _get_gemini_tts_client(api_key)
        speaker_configs = [
            types.SpeakerVoiceConfig(
                speaker=name,
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=speaker_voice_map[name])
                ),
            )
            for name in speakers
        ]
        response = client.models.generate_content(
            model=settings.GEMINI_TTS_MODEL,
            contents=transcript,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(speaker_voice_configs=speaker_configs)
                ),
            ),
        )
        for candidate in getattr(response, "candidates", None) or []:
            parts = getattr(getattr(candidate, "content", None), "parts", None) or []
            for part in parts:
                inline_data = getattr(part, "inline_data", None)
                if inline_data is not None and getattr(inline_data, "data", None):
                    return _wrap_pcm_as_wav(inline_data.data)
        logger.warning("generate_speech_audio: no inline audio data in Gemini TTS response (%r)", response)
        return None
    except Exception:
        logger.exception("generate_speech_audio: Gemini TTS call failed")
        return None


# ---------------------------------------------------------------------
# Groq (official SDK, OpenAI-compatible chat.completions)
# ---------------------------------------------------------------------
def _get_groq_client():
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    from groq import Groq
    # Same reasoning as _gemini_http_options above: our own provider
    # chain is the retry strategy, so the SDK's own internal retries
    # (which would otherwise also eat into the frontend's timeout
    # budget before ever reaching cerebras/openrouter) are turned off.
    _groq_client = Groq(api_key=settings.GROQ_API_KEY, max_retries=0, timeout=20.0)
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
        timeout=20,  # matches the fail-fast budget on gemini/groq above — this can be provider #3 or #4 in the chain, so it can't afford 30s on its own
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
    # NOTE: "gemini" is NOT in this dict — it's special-cased in
    # generate_json() to go through _generate_json_gemini_with_rotation()
    # instead, since it (uniquely) supports trying multiple keys.
    "groq": ("_generate_json_groq", lambda: settings.GROQ_API_KEY),
    "cerebras": ("_generate_json_cerebras", lambda: settings.CEREBRAS_API_KEY),
    "openrouter": ("_generate_json_openrouter", lambda: settings.OPENROUTER_API_KEY),
}


def generate_json(
    prompt: str,
    temperature: float = 0.4,
    gemini_api_key: str | None = None,
    gemini_key_pool: list[str] | None = None,
) -> dict | list:
    """
    Try each provider in settings.AI_PROVIDER_CHAIN, in order, until one
    succeeds. Providers with no API key configured are skipped silently.
    Raises GeminiClientError only if every provider in the chain failed
    (or none had a key set) — the error message lists what was tried.

    The "gemini" step is special: it doesn't just try one key. See
    _generate_json_gemini_with_rotation() — if gemini_key_pool is given,
    it's walked as a fallback rotation before Gemini as a whole is
    considered failed and the chain moves to groq/cerebras/openrouter.
    gemini_key_pool is None by default, so most callers behave exactly
    as before this feature existed (one Gemini key attempt, then
    straight to the next provider). Only the diagnostic assessment
    passes one currently (settings.GEMINI_API_KEYS_POOL_ASSESSMENT, via
    agents/question_generation_agent.py) — deliberately NOT shared with
    chat/flashcards/notes/etc., since assessment generation is the
    heaviest AI feature and giving everything else access to the same
    pool would mean it's competing with assessment for its own headroom.

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
        if provider_name == "gemini":
            try:
                result = _generate_json_gemini_with_rotation(
                    prompt, temperature, gemini_api_key, gemini_key_pool, attempts
                )
                print("[AI_PROVIDER] request served by: gemini", flush=True)
                return result
            except GeminiClientError:
                continue

        entry = _PROVIDER_NAMES.get(provider_name)
        if entry is None:
            attempts.append(f"{provider_name}: unknown provider, skipped")
            continue
        func_name, get_key = entry
        key = get_key()
        if not key:
            attempts.append(f"{provider_name}: no API key set, skipped")
            continue
        try:
            func = globals()[func_name]
            result = func(prompt, temperature)
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
