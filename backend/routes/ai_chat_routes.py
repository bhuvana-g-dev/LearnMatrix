"""
routes/ai_chat_routes.py

AI Study Assistant chat routes. Registered in app.py the same way every
other blueprint is (url_prefix="/api"), so the full paths are:

    POST   /api/ai/chat                          -> send a message, get a grounded reply
                                                     (body: {uid, message, sessionId?, context?})
    GET    /api/ai/chat/<uid>/sessions           -> list this user's past conversations
    GET    /api/ai/chat/<uid>/sessions/<id>      -> load one conversation's full messages
    DELETE /api/ai/chat/<uid>/sessions/<id>      -> delete a conversation
    GET    /api/ai/chat/<uid>/sources            -> list this user's chat sources
    GET    /api/ai/chat/<uid>/sources/content    -> full text per source (Mind Map/Audio/PPT/Flashcards)
    POST   /api/ai/chat/<uid>/sources            -> upload a file (PDF/txt/md) as a source
    POST   /api/ai/chat/<uid>/sources/from-notes -> add existing Learning Hub notes as a source
    POST   /api/ai/chat/<uid>/sources/from-youtube -> add a YouTube video's transcript as a source
    POST   /api/ai/chat/<uid>/sources/from-text  -> add raw pasted text as a source
    DELETE /api/ai/chat/<uid>/sources/<id>       -> remove a source

Delegates everything to services/ai_chat_service.py — this file only
parses the request and shapes the response, same as every other route
module in this folder.
"""

from flask import Blueprint, request

from services.ai_chat_service import (
    send_message,
    list_chat_sessions,
    load_chat_session,
    delete_chat_session,
    add_upload_source,
    add_notes_source,
    add_youtube_source,
    add_text_source,
    list_sources,
    get_sources_content,
    delete_source,
    AIChatError,
    SourceError,
)
from config.settings import settings
from utils.response_helper import success_response, error_response
from utils.user_auth import require_owner, require_owner_body
from utils.rate_limiter import limiter

ai_chat_bp = Blueprint("ai_chat", __name__)


@ai_chat_bp.route("/ai/chat", methods=["POST"])
@limiter.limit("20 per minute")
@require_owner_body()
def send_chat_message_route():
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    uid = payload.get("uid")
    message = payload.get("message")
    session_id = payload.get("sessionId")  # omit/None -> a new conversation is created
    context = payload.get("context")  # optional {skill, topic}

    if not uid or not message:
        return error_response(
            "Request body must include 'uid' and 'message'.", status_code=400
        )

    try:
        result = send_message(uid=uid, message=message, session_id=session_id, context=context)
        return success_response(data=result, message="Reply generated.")
    except AIChatError as exc:
        return error_response(str(exc), status_code=422)


@ai_chat_bp.route("/ai/chat/<uid>/sessions", methods=["GET"])
@require_owner()
def list_chat_sessions_route(uid):
    sessions = list_chat_sessions(uid)
    return success_response(data={"sessions": sessions}, message="Chat sessions loaded.")


@ai_chat_bp.route("/ai/chat/<uid>/sessions/<session_id>", methods=["GET"])
@require_owner()
def get_chat_session_route(uid, session_id):
    history = load_chat_session(uid, session_id)
    return success_response(data={"history": history}, message="Conversation loaded.")


@ai_chat_bp.route("/ai/chat/<uid>/sessions/<session_id>", methods=["DELETE"])
@require_owner()
def delete_chat_session_route(uid, session_id):
    delete_chat_session(uid, session_id)
    return success_response(data=None, message="Conversation deleted.")


@ai_chat_bp.route("/ai/chat/<uid>/sources", methods=["GET"])
@require_owner()
def list_chat_sources_route(uid):
    sources = list_sources(uid)
    return success_response(data={"sources": sources}, message="Sources loaded.")


@ai_chat_bp.route("/ai/chat/<uid>/sources/content", methods=["GET"])
@require_owner()
def get_chat_sources_content_route(uid):
    """Full text per source (not just titles) — used by Mind Map,
    Audio Overview, PPT, and Flashcards' "From Sources" mode, instead
    of the fixed roadmap-topic notes."""
    content = get_sources_content(uid)
    return success_response(data={"sources": content}, message="Source content loaded.")


@ai_chat_bp.route("/ai/chat/<uid>/sources", methods=["POST"])
@limiter.limit("20 per hour")
@require_owner()
def upload_chat_source_route(uid):
    """multipart/form-data with a single 'file' field — a PDF, .txt, or
    .md the student wants the assistant grounded on."""
    if "file" not in request.files:
        return error_response("Request must include a 'file' field.", status_code=400)

    file = request.files["file"]
    if not file.filename:
        return error_response("No file selected.", status_code=400)

    # Flask's global MAX_CONTENT_LENGTH already stops anything bigger
    # than that outright, but chat sources have their own, usually
    # tighter, limit — check it here for a specific, friendly message
    # instead of letting an oversized-but-under-the-global-cap file
    # reach extract_text() and get fully read into memory first.
    file.stream.seek(0, 2)  # SEEK_END
    size_bytes = file.stream.tell()
    file.stream.seek(0)
    max_bytes = settings.CHAT_SOURCE_MAX_FILE_MB * 1024 * 1024
    if size_bytes > max_bytes:
        return error_response(
            f"File is too large — the limit for chat sources is "
            f"{settings.CHAT_SOURCE_MAX_FILE_MB}MB.",
            status_code=413,
        )

    try:
        result = add_upload_source(uid, file.filename, file.stream)
        return success_response(data=result, message="Source added.")
    except SourceError as exc:
        return error_response(str(exc), status_code=422)


@ai_chat_bp.route("/ai/chat/<uid>/sources/from-notes", methods=["POST"])
@limiter.limit("20 per hour")
@require_owner()
def add_notes_source_route(uid):
    """Adds an already-generated Learning Hub notes entry (see
    services/notes_repository.py) as a chat source — no file upload
    involved, just references existing skill/topic/focusBand notes."""
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    skill = payload.get("skill")
    topic = payload.get("topic")
    focus_band = payload.get("focusBand")
    if not skill or not topic or not focus_band:
        return error_response(
            "Request body must include 'skill', 'topic', and 'focusBand'.",
            status_code=400,
        )

    try:
        result = add_notes_source(uid, skill, topic, focus_band)
        return success_response(data=result, message="Source added.")
    except SourceError as exc:
        return error_response(str(exc), status_code=422)


@ai_chat_bp.route("/ai/chat/<uid>/sources/from-youtube", methods=["POST"])
@limiter.limit("20 per hour")
@require_owner()
def add_youtube_source_route(uid):
    """Adds a YouTube video's transcript as a chat source — NotebookLM-
    style "paste a link" alongside file upload and Learning Hub notes."""
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    url = payload.get("url")
    if not url:
        return error_response("Request body must include 'url'.", status_code=400)

    try:
        result = add_youtube_source(uid, url)
        return success_response(data=result, message="Source added.")
    except SourceError as exc:
        return error_response(str(exc), status_code=422)


@ai_chat_bp.route("/ai/chat/<uid>/sources/from-text", methods=["POST"])
@limiter.limit("20 per hour")
@require_owner()
def add_text_source_route(uid):
    """Adds raw pasted text as a chat source — NotebookLM's "Copied
    text" option alongside file upload, YouTube, and Learning Hub
    notes."""
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    text = payload.get("text")
    title = payload.get("title")
    if not text or not text.strip():
        return error_response("Request body must include 'text'.", status_code=400)

    try:
        result = add_text_source(uid, text, title)
        return success_response(data=result, message="Source added.")
    except SourceError as exc:
        return error_response(str(exc), status_code=422)


@ai_chat_bp.route("/ai/chat/<uid>/sources/<source_id>", methods=["DELETE"])
@require_owner()
def delete_chat_source_route(uid, source_id):
    delete_source(uid, source_id)
    return success_response(data=None, message="Source removed.")
