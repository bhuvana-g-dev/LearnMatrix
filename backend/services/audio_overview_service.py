"""
services/audio_overview_service.py

Orchestrates the real (server-rendered) Audio Overview feature:

    1. AudioOverviewAgent turns raw source/chat/typed text into a
       two-host podcast SCRIPT (agents/audio_overview_agent.py).
    2. utils/gemini_client.py's generate_speech_audio() renders that
       script into one real WAV audio file via Gemini's native
       multi-speaker TTS model.
    3. The audio bytes are base64-encoded into a "data:audio/wav;..."
       URI — same "generate bytes, ship as a data URI the frontend can
       drop straight into an <audio>/<img> element" pattern already
       used by services/image_service.py's AI-generated slide images.

Deliberately NOT cached in Firestore the way notes/questions are
(services/notes_repository.py etc.) — a multi-minute WAV file is
routinely several MB, well past Firestore's 1MiB document limit. What
DOES get persisted (via services/studio_repository.py, same as Mind
Map/Slide Deck) is the small SCRIPT + title only; reopening a saved
Audio Overview calls synthesize_audio_for_script() below to re-render
the audio from that saved script — no second LLM call, only a second
(cheap, deterministic) TTS call.
"""

import base64

from agents.audio_overview_agent import AudioOverviewAgent, AudioOverviewAgentError
from config.settings import settings
from utils.gemini_client import generate_speech_audio

# Average spoken pace for a natural back-and-forth conversation — used
# only as a fallback duration estimate for the frontend progress bar
# BEFORE the browser has loaded the actual audio's real duration off
# its metadata (which is always used once available/more accurate).
WORDS_PER_MINUTE = 150


class AudioOverviewServiceError(Exception):
    pass


def _speaker_voice_map() -> dict[str, str]:
    return {
        "Host A": settings.AUDIO_OVERVIEW_HOST_A_VOICE,
        "Host B": settings.AUDIO_OVERVIEW_HOST_B_VOICE,
    }


def _estimate_seconds(script: list[dict]) -> int:
    word_count = sum(len(turn.get("line", "").split()) for turn in script)
    return max(20, round((word_count / WORDS_PER_MINUTE) * 60))


def _audio_data_uri(wav_bytes: bytes) -> str:
    return f"data:audio/wav;base64,{base64.b64encode(wav_bytes).decode('ascii')}"


# Exposed (not prefixed) since routes/audio_overview_routes.py and
# routes/studio_routes.py both need to convert between the data URI shape
# the frontend expects and the raw WAV bytes services/audio_storage.py
# uploads/downloads.
audio_data_uri = _audio_data_uri


def wav_bytes_from_data_uri(data_uri: str) -> bytes | None:
    """Reverses _audio_data_uri() — used right after generation so the
    freshly-rendered audio can also be uploaded to Storage without a
    second TTS call. Returns None if the string isn't a data URI."""
    if not data_uri or not data_uri.startswith("data:audio/wav;base64,"):
        return None
    try:
        return base64.b64decode(data_uri.split(",", 1)[1])
    except Exception:
        return None


def generate_audio_overview(text: str, label: str = "this material") -> dict:
    """Full pipeline: text -> script -> audio. Returns
    {title, script, audioDataUri, durationSeconds}. Raises
    AudioOverviewServiceError if EITHER stage fails — unlike
    image_service.py's graceful image-generation fallback, there's no
    fallback for Audio Overview: the audio IS the deliverable, so a
    TTS failure has to surface as a clear error, not a silently
    degraded result."""
    try:
        agent = AudioOverviewAgent()
        result = agent.run(text=text, label=label)
    except AudioOverviewAgentError as exc:
        raise AudioOverviewServiceError(f"Couldn't write the Audio Overview script: {exc}") from exc

    title, script = result["title"], result["script"]
    audio_data_uri = synthesize_audio_for_script(script)

    return {
        "title": title,
        "script": script,
        "audioDataUri": audio_data_uri,
        "durationSeconds": _estimate_seconds(script),
    }


def synthesize_audio_for_script(script: list[dict]) -> str:
    """Renders an ALREADY-WRITTEN script into audio and returns a
    data:audio/wav URI — the re-render path used both by
    generate_audio_overview() above and by reopening a saved Studio
    artifact (see routes/audio_overview_routes.py), so a student never
    pays the script-writing LLM cost twice for the same episode."""
    if not script:
        raise AudioOverviewServiceError("No script to synthesize.")
    wav_bytes = generate_speech_audio(script, _speaker_voice_map())
    if not wav_bytes:
        raise AudioOverviewServiceError(
            "Couldn't generate the podcast audio right now — the speech model may be "
            "unavailable or rate-limited. Please try again in a moment."
        )
    return _audio_data_uri(wav_bytes)
