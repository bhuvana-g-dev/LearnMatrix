"""
routes/studio_routes.py

    GET /api/studio/<uid>/<session_id> -> [{id, type, title, createdAt}, ...]
    GET /api/studio/<uid>/<session_id>/<artifact_id> -> {type, title, content, createdAt}

Lists/fetches Mind Map and Slide Deck artifacts already generated and
saved for one chat session (see services/studio_repository.py) — this
is what lets the AI Study Assistant show "already generated" cards for
a session (NotebookLM-Studio-panel style) instead of only ever
generating fresh, and lets clicking one reopen the exact saved content
with no further LLM call.

Saving an artifact happens in routes/mindmap_routes.py and
routes/slidedeck_routes.py's own generate endpoints (when the request
includes a session_id) — this module only reads.
"""

from flask import Blueprint

from firebase.firebase_config import get_firestore_client
from services import studio_repository
from utils.response_helper import success_response, error_response

studio_bp = Blueprint("studio", __name__)


@studio_bp.route("/studio/<uid>/<session_id>", methods=["GET"])
def list_studio_artifacts_route(uid, session_id):
    db = get_firestore_client()
    result = studio_repository.list_artifacts(db, uid, session_id)
    return success_response(data=result, message="Studio artifacts listed.")


@studio_bp.route("/studio/<uid>/<session_id>/<artifact_id>", methods=["GET"])
def get_studio_artifact_route(uid, session_id, artifact_id):
    db = get_firestore_client()
    artifact = studio_repository.get_artifact(db, uid, session_id, artifact_id)
    if artifact is None:
        return error_response("That item wasn't found — it may have been deleted.", status_code=404)
    return success_response(data=artifact, message="Studio artifact fetched.")
