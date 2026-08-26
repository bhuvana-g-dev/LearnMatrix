"""
routes/slidedeck_routes.py

    GET  /api/slidedeck/premium-status -> {available}
    POST /api/slidedeck/generate -> {text, label?, uid?, sessionId?}
        -> {title, summary, sections, keyTakeaways}
    POST /api/slidedeck/generate-premium -> {text, label?, format?}
        -> binary pptx/pdf file (Gamma-generated)

Proxies to SlideDeckAgent. Used by the AI Study Assistant's Slide Deck
"Type" mode to show an in-app preview (numbered slide list + slide
canvas, Gamma/NotebookLM style) BEFORE the student downloads a file —
the exact same JSON this route returns is what routes/ppt_routes.py's
"from-content" pptx/pdf endpoints turn into a file, so what's
previewed is exactly what downloads.

When the request includes both `uid` and `sessionId` (i.e. generated
from inside an open chat), the result is also saved as a studio
artifact under that session (see services/studio_repository.py) so it
shows up as an "already generated" card next time that chat is
reopened — without `uid`/`sessionId` it's generated and returned but
not saved, same as before.

/generate-premium is a SEPARATE, opt-in path (see services/gamma_service.py):
instead of our own SlideDeckAgent + python-pptx renderer, the text is
sent straight to Gamma's Generate API and Gamma designs/renders the
whole deck. Only offered when GAMMA_API_KEY is configured
(services/gamma_service.is_configured()) — /premium-status lets the
frontend know whether to even show this option, so an unconfigured
deployment behaves exactly as it did before Gamma was added.
"""

import logging

from flask import Blueprint, request, send_file

from firebase.firebase_config import get_firestore_client
from services.slide_deck_service import generate_deck_content, SlideDeckServiceError
from services import studio_repository, gamma_service
from services.gamma_service import GammaServiceError
from services.ppt_service import _safe_filename
from utils.response_helper import success_response, error_response

logger = logging.getLogger(__name__)

slidedeck_bp = Blueprint("slidedeck", __name__)


@slidedeck_bp.route("/slidedeck/premium-status", methods=["GET"])
def slidedeck_premium_status_route():
    return success_response(data={"available": gamma_service.is_configured()}, message="Premium status.")


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
    except SlideDeckServiceError as exc:
        return error_response(str(exc), status_code=422)

    uid, session_id = payload.get("uid"), payload.get("sessionId")
    if uid and session_id:
        # Best-effort save — see routes/mindmap_routes.py for why this
        # must not turn an already-generated deck into a 500.
        try:
            db = get_firestore_client()
            studio_repository.save_artifact(db, uid, session_id, "slidedeck", result.get("title") or "Slide Deck", result)
        except Exception:
            logger.exception("slidedeck: failed to save studio artifact for uid=%s session=%s", uid, session_id)

    return success_response(data=result, message="Slide deck generated.")


@slidedeck_bp.route("/slidedeck/generate-premium", methods=["POST"])
def generate_slidedeck_premium_route():
    """Premium path — Gamma designs and renders the deck server-side;
    this returns the finished file directly (no in-app preview step,
    unlike /generate above, since Gamma's output isn't our editable
    {sections: [...]} JSON shape)."""
    if not gamma_service.is_configured():
        return error_response("Premium slide decks aren't enabled on this server.", status_code=403)

    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    text = payload.get("text")
    label = payload.get("label") or "this topic"
    export_as = payload.get("format") or "pptx"
    if not text or not text.strip():
        return error_response("Request body must include non-empty 'text'.", status_code=400)
    if export_as not in ("pptx", "pdf"):
        return error_response("'format' must be 'pptx' or 'pdf'.", status_code=400)

    try:
        file_bytes, gamma_url = gamma_service.generate_deck_file(text, label, export_as=export_as)
    except GammaServiceError as exc:
        return error_response(str(exc), status_code=422)

    filename = f"{_safe_filename(label)}_gamma_deck.{export_as}"
    mimetype = (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        if export_as == "pptx"
        else "application/pdf"
    )
    from io import BytesIO
    response = send_file(BytesIO(file_bytes), as_attachment=True, download_name=filename, mimetype=mimetype)
    if gamma_url:
        # Exposed as a header rather than in the JSON envelope since
        # this endpoint streams a binary file — the frontend can read
        # it via response.headers to also offer an "Open in Gamma" link.
        response.headers["X-Gamma-Url"] = gamma_url
    return response
