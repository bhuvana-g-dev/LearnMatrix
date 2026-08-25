"""
routes/audio_overview_routes.py

    POST /api/audio-overview/generate -> {text, label?, uid?, sessionId?}
        -> {title, script, audioDataUri, durationSeconds}

    POST /api/audio-overview/synthesize -> {script, title?}
        -> {audioDataUri}

Real, server-rendered NotebookLM-style Audio Overview: a two-host
podcast SCRIPT (agents/audio_overview_agent.py) turned into one actual
WAV audio file via Gemini's native multi-speaker TTS
(services/audio_overview_service.py) — replacing the old client-only
version that just fed a flat paragraph to the browser's
window.speechSynthesis with a single robotic voice.

/generate is the full pipeline (script + audio). When the request
includes both `uid` and `sessionId` (generated from inside an open
chat), the SCRIPT + title are also saved as a studio artifact under
that session (services/studio_repository.py) — same "reopen it later"
behavior as Mind Map/Slide Deck. The audio itself is NOT persisted
(a multi-minute WAV routinely exceeds Firestore's 1MiB document limit)
— reopening a saved Audio Overview calls /synthesize with that saved
script to re-render the audio on demand, at the cost of one TTS call
instead of a full script-writing LLM call.
"""

from flask import Blueprint, request

from firebase.firebase_config import get_firestore_client
from services import studio_repository
from services.audio_overview_service import (
    generate_audio_overview,
    synthesize_audio_for_script,
    AudioOverviewServiceError,
)
from utils.response_helper import success_response, error_response

audio_overview_bp = Blueprint("audio_overview", __name__)


@audio_overview_bp.route("/audio-overview/generate", methods=["POST"])
def generate_audio_overview_route():
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    text = payload.get("text")
    label = payload.get("label") or "this material"
    if not text or not text.strip():
        return error_response("Request body must include non-empty 'text'.", status_code=400)

    try:
        result = generate_audio_overview(text, label)
    except AudioOverviewServiceError as exc:
        return error_response(str(exc), status_code=422)

    uid, session_id = payload.get("uid"), payload.get("sessionId")
    if uid and session_id:
        db = get_firestore_client()
        # Script + title only (see module docstring) — NOT audioDataUri,
        # which would routinely blow past Firestore's 1MiB doc limit.
        studio_repository.save_artifact(
            db, uid, session_id, "audio",
            result.get("title") or "Audio Overview",
            {"title": result["title"], "script": result["script"]},
        )

    return success_response(data=result, message="Audio Overview generated.")


@audio_overview_bp.route("/audio-overview/synthesize", methods=["POST"])
def synthesize_audio_overview_route():
    """Re-renders audio for an ALREADY-WRITTEN script — used when a
    student reopens a previously-generated Audio Overview from Studio
    history (routes/studio_routes.py's GET returns the saved
    {title, script}, which has no audio attached — see module
    docstring)."""
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    script = payload.get("script")
    if not isinstance(script, list) or not script:
        return error_response("Request body must include a non-empty 'script' list.", status_code=400)

    try:
        audio_data_uri = synthesize_audio_for_script(script)
    except AudioOverviewServiceError as exc:
        return error_response(str(exc), status_code=422)

    return success_response(data={"audioDataUri": audio_data_uri}, message="Audio synthesized.")
