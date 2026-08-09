"""
routes/mindmap_routes.py

    POST /api/mindmap/generate -> {text, label?} -> {title, branches: [{label, detail}]}

Stateless — nothing is persisted, this just proxies to MindMapAgent.
Used by the AI Study Assistant's Mind Map card for all three of its
modes (Sources / Chat / Type) — the frontend assembles the raw text
for whichever mode was picked, and always sends it through this same
endpoint for a consistent, LLM-structured breakdown.
"""

from flask import Blueprint, request

from services.mindmap_service import generate_mindmap, MindMapServiceError
from utils.response_helper import success_response, error_response

mindmap_bp = Blueprint("mindmap", __name__)


@mindmap_bp.route("/mindmap/generate", methods=["POST"])
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
        return success_response(data=result, message="Mind map generated.")
    except MindMapServiceError as exc:
        return error_response(str(exc), status_code=422)
