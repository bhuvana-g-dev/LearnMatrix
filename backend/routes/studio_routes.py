"""
routes/studio_routes.py

    GET  /api/studio/<uid>/<session_id> -> [{id, type, title, createdAt}, ...]
    GET  /api/studio/<uid>/<session_id>/<artifact_id> -> {type, title, content, createdAt}
    POST /api/studio/<uid>/<session_id> -> {type, title, content} -> {id}

Lists/fetches/saves Mind Map, Slide Deck, Flashcards, and Audio
Overview artifacts already generated for one chat session (see
services/studio_repository.py) — this is what lets the AI Study
Assistant show "already generated" cards for a session (NotebookLM-
Studio-panel style) instead of only ever generating fresh, and lets
clicking one reopen the exact saved content with no further LLM call.

Mind Map and Slide Deck save themselves as a side effect of their own
generate endpoints (routes/mindmap_routes.py, routes/slidedeck_routes.py)
when the request includes a session_id. Flashcards and Audio Overview
don't have that same "one backend call already knows the session"
shape — Flashcards has its own uid-scoped repository (not session-
scoped) and Audio Overview is built entirely client-side from
already-loaded sources/chat text — so the frontend calls this
module's POST endpoint directly for those two instead.
"""

from flask import Blueprint, request

from firebase.firebase_config import get_firestore_client
from services import studio_repository
from utils.response_helper import success_response, error_response
from utils.user_auth import require_owner

studio_bp = Blueprint("studio", __name__)


@studio_bp.route("/studio/<uid>/<session_id>", methods=["GET"])
@require_owner()
def list_studio_artifacts_route(uid, session_id):
    db = get_firestore_client()
    result = studio_repository.list_artifacts(db, uid, session_id)
    return success_response(data=result, message="Studio artifacts listed.")


@studio_bp.route("/studio/<uid>/<session_id>/<artifact_id>", methods=["GET"])
@require_owner()
def get_studio_artifact_route(uid, session_id, artifact_id):
    db = get_firestore_client()
    artifact = studio_repository.get_artifact(db, uid, session_id, artifact_id)
    if artifact is None:
        return error_response("That item wasn't found — it may have been deleted.", status_code=404)
    return success_response(data=artifact, message="Studio artifact fetched.")


@studio_bp.route("/studio/<uid>/<session_id>", methods=["POST"])
@require_owner()
def save_studio_artifact_route(uid, session_id):
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    artifact_type = payload.get("type")
    content = payload.get("content")
    if not artifact_type or not isinstance(content, dict):
        return error_response("Request body must include 'type' and an object 'content'.", status_code=400)

    title = payload.get("title") or artifact_type.title()
    db = get_firestore_client()
    artifact_id = studio_repository.save_artifact(db, uid, session_id, artifact_type, title, content)
    return success_response(data={"id": artifact_id}, message="Studio artifact saved.")
