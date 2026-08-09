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
    list_sources,
    get_sources_content,
    delete_source,
    AIChatError,
    SourceError,
)
from utils.response_helper import success_response, error_response

ai_chat_bp = Blueprint("ai_chat", __name__)


@ai_chat_bp.route("/ai/chat", methods=["POST"])
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
def list_chat_sessions_route(uid):
    sessions = list_chat_sessions(uid)
    return success_response(data={"sessions": sessions}, message="Chat sessions loaded.")


@ai_chat_bp.route("/ai/chat/<uid>/sessions/<session_id>", methods=["GET"])
def get_chat_session_route(uid, session_id):
    history = load_chat_session(uid, session_id)
    return success_response(data={"history": history}, message="Conversation loaded.")


@ai_chat_bp.route("/ai/chat/<uid>/sessions/<session_id>", methods=["DELETE"])
def delete_chat_session_route(uid, session_id):
    delete_chat_session(uid, session_id)
    return success_response(data=None, message="Conversation deleted.")


@ai_chat_bp.route("/ai/chat/<uid>/sources", methods=["GET"])
def list_chat_sources_route(uid):
    sources = list_sources(uid)
    return success_response(data={"sources": sources}, message="Sources loaded.")


@ai_chat_bp.route("/ai/chat/<uid>/sources/content", methods=["GET"])
def get_chat_sources_content_route(uid):
    """Full text per source (not just titles) — used by Mind Map,
    Audio Overview, PPT, and Flashcards' "From Sources" mode, instead
    of the fixed roadmap-topic notes."""
    content = get_sources_content(uid)
    return success_response(data={"sources": content}, message="Source content loaded.")


@ai_chat_bp.route("/ai/chat/<uid>/sources", methods=["POST"])
def upload_chat_source_route(uid):
    """multipart/form-data with a single 'file' field — a PDF, .txt, or
    .md the student wants the assistant grounded on."""
    if "file" not in request.files:
        return error_response("Request must include a 'file' field.", status_code=400)

    file = request.files["file"]
    if not file.filename:
        return error_response("No file selected.", status_code=400)

    try:
        result = add_upload_source(uid, file.filename, file.stream)
        return success_response(data=result, message="Source added.")
    except SourceError as exc:
        return error_response(str(exc), status_code=422)


@ai_chat_bp.route("/ai/chat/<uid>/sources/from-notes", methods=["POST"])
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


@ai_chat_bp.route("/ai/chat/<uid>/sources/<source_id>", methods=["DELETE"])
def delete_chat_source_route(uid, source_id):
    delete_source(uid, source_id)
    return success_response(data=None, message="Source removed.")
