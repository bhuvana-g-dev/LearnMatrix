"""
routes/mindmap_routes.py

    POST /api/mindmap/generate -> {text, label?, uid?, sessionId?}
        -> {title, branches: [{label, detail}]}

Proxies to MindMapAgent. When the request includes both `uid` and
`sessionId` (i.e. the student generated this from inside an open chat),
the result is also saved as a studio artifact under that session (see
services/studio_repository.py) so it shows up as an "already
generated" card next time they open that chat, NotebookLM-Studio-panel
style — without `uid`/`sessionId` (Sources/Type modes with no active
chat) it's generated and returned but not saved, same as before.
"""

from flask import Blueprint, request

from firebase.firebase_config import get_firestore_client
from services.mindmap_service import generate_mindmap, MindMapServiceError
from services import studio_repository
from utils.response_helper import success_response, error_response
from utils.user_auth import require_owner_body
from utils.rate_limiter import limiter

mindmap_bp = Blueprint("mindmap", __name__)


@mindmap_bp.route("/mindmap/generate", methods=["POST"])
@limiter.limit("15 per minute")
@require_owner_body()
def generate_mindmap_route():
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    text = payload.get("text")
    label = payload.get("label") or "this material"
    if not text or not text.strip():
        return error_response("Request body must include non-empty 'text'.", status_code=400)

    try:
        result = generate_mindmap(text, label)
    except MindMapServiceError as exc:
        return error_response(str(exc), status_code=422)

    uid, session_id = payload.get("uid"), payload.get("sessionId")
    if uid and session_id:
        db = get_firestore_client()
        studio_repository.save_artifact(db, uid, session_id, "mindmap", result.get("title") or "Mind Map", result)

    return success_response(data=result, message="Mind map generated.")
