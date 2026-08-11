"""
routes/slidedeck_routes.py

    POST /api/slidedeck/generate -> {text, label?} -> {title, summary, sections, keyTakeaways}

Stateless — nothing is persisted, this just proxies to SlideDeckAgent.
Used by the AI Study Assistant's Slide Deck "Type" mode to show an
in-app preview (numbered slide list + slide canvas, Gamma/NotebookLM
style) BEFORE the student downloads a file — the exact same JSON this
route returns is what routes/ppt_routes.py's "from-content" pptx/pdf
endpoints turn into a file, so what's previewed is exactly what
downloads.
"""

from flask import Blueprint, request

from services.slide_deck_service import generate_deck_content, SlideDeckServiceError
from utils.response_helper import success_response, error_response

slidedeck_bp = Blueprint("slidedeck", __name__)


@slidedeck_bp.route("/slidedeck/generate", methods=["POST"])
def generate_slidedeck_route():
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    text = payload.get("text")
    label = payload.get("label") or "this topic"
    if not text or not text.strip():
        return error_response("Request body must include non-empty 'text'.", status_code=400)

    try:
        result = generate_deck_content(text, label)
        return success_response(data=result, message="Slide deck generated.")
    except SlideDeckServiceError as exc:
        return error_response(str(exc), status_code=422)
