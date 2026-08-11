"""
routes/ppt_routes.py

    GET  /api/study-summary/topic/<skill>/<topic>/<focus_band>/pptx -> from Learning Hub notes
    GET  /api/study-summary/sources/<uid>/pptx                     -> from uploaded/linked sources
    GET  /api/study-summary/chat/<uid>/<session_id>/pptx           -> from one chat session
    POST /api/study-summary/custom/pptx                            -> from typed text, {text} body

    GET  /api/study-summary/topic/<skill>/<topic>/<focus_band>/pdf  -> same 4 sources, .pdf instead
    GET  /api/study-summary/sources/<uid>/pdf
    GET  /api/study-summary/chat/<uid>/<session_id>/pdf
    POST /api/study-summary/custom/pdf

The pptx and pdf routes are generated from the exact same underlying
notes shape (see services/ppt_service.py's build_deck_sections), so the
two formats never show different content — only a different file type.

None of these return the usual {success, data, message} JSON envelope
— they stream a binary file, since that's what the frontend's download
button expects (response_helper's envelope is for JSON API responses,
not file downloads). On failure they fall back to the JSON error
envelope so the frontend can still surface a message.
"""

from flask import Blueprint, request, send_file

from services.ppt_service import (
    generate_study_summary_pptx,
    generate_sources_summary_pptx,
    generate_chat_summary_pptx,
    generate_custom_text_pptx,
    build_pptx_from_deck_content,
    PptServiceError,
)
from services.pdf_service import (
    generate_study_summary_pdf,
    generate_sources_summary_pdf,
    generate_chat_summary_pdf,
    generate_custom_text_pdf,
    build_pdf_from_deck_content,
    PdfServiceError,
)
from utils.response_helper import error_response

ppt_bp = Blueprint("ppt", __name__)


def _send_file(file_bytes, filename, mimetype):
    return send_file(file_bytes, as_attachment=True, download_name=filename, mimetype=mimetype)


def _send_pptx(file_bytes, filename):
    return _send_file(file_bytes, filename, "application/vnd.openxmlformats-officedocument.presentationml.presentation")


def _send_pdf(file_bytes, filename):
    return _send_file(file_bytes, filename, "application/pdf")


# ---------------------------------------------------------------------------
# PPTX
# ---------------------------------------------------------------------------

@ppt_bp.route("/study-summary/topic/<skill>/<topic>/<focus_band>/pptx", methods=["GET"])
def download_topic_pptx_route(skill, topic, focus_band):
    try:
        file_bytes, filename = generate_study_summary_pptx(skill, topic, focus_band)
    except PptServiceError as exc:
        return error_response(str(exc), status_code=422)
    return _send_pptx(file_bytes, filename)


@ppt_bp.route("/study-summary/sources/<uid>/pptx", methods=["GET"])
def download_sources_pptx_route(uid):
    try:
        file_bytes, filename = generate_sources_summary_pptx(uid)
    except PptServiceError as exc:
        return error_response(str(exc), status_code=422)
    return _send_pptx(file_bytes, filename)


@ppt_bp.route("/study-summary/chat/<uid>/<session_id>/pptx", methods=["GET"])
def download_chat_pptx_route(uid, session_id):
    try:
        file_bytes, filename = generate_chat_summary_pptx(uid, session_id)
    except PptServiceError as exc:
        return error_response(str(exc), status_code=422)
    return _send_pptx(file_bytes, filename)


@ppt_bp.route("/study-summary/custom/pptx", methods=["POST"])
def download_custom_pptx_route():
    """POST (not GET, unlike the other three) since the typed text is
    the request body, not something that fits cleanly in a URL."""
    payload = request.get_json(silent=True) or {}
    try:
        file_bytes, filename = generate_custom_text_pptx(payload.get("text", ""))
    except PptServiceError as exc:
        return error_response(str(exc), status_code=422)
    return _send_pptx(file_bytes, filename)


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

@ppt_bp.route("/study-summary/topic/<skill>/<topic>/<focus_band>/pdf", methods=["GET"])
def download_topic_pdf_route(skill, topic, focus_band):
    try:
        file_bytes, filename = generate_study_summary_pdf(skill, topic, focus_band)
    except PdfServiceError as exc:
        return error_response(str(exc), status_code=422)
    return _send_pdf(file_bytes, filename)


@ppt_bp.route("/study-summary/sources/<uid>/pdf", methods=["GET"])
def download_sources_pdf_route(uid):
    try:
        file_bytes, filename = generate_sources_summary_pdf(uid)
    except PdfServiceError as exc:
        return error_response(str(exc), status_code=422)
    return _send_pdf(file_bytes, filename)


@ppt_bp.route("/study-summary/chat/<uid>/<session_id>/pdf", methods=["GET"])
def download_chat_pdf_route(uid, session_id):
    try:
        file_bytes, filename = generate_chat_summary_pdf(uid, session_id)
    except PdfServiceError as exc:
        return error_response(str(exc), status_code=422)
    return _send_pdf(file_bytes, filename)


@ppt_bp.route("/study-summary/custom/pdf", methods=["POST"])
def download_custom_pdf_route():
    payload = request.get_json(silent=True) or {}
    try:
        file_bytes, filename = generate_custom_text_pdf(payload.get("text", ""))
    except PdfServiceError as exc:
        return error_response(str(exc), status_code=422)
    return _send_pdf(file_bytes, filename)


# ---------------------------------------------------------------------------
# "From content" — builds a file directly from an already-generated deck
# (the same {title, summary, sections, keyTakeaways} JSON
# routes/slidedeck_routes.py returned for the in-app preview) with no
# further LLM call, so the downloaded file always matches exactly what
# the student previewed on screen.
# ---------------------------------------------------------------------------

def _safe_filename_from_notes(notes: dict) -> str:
    from services.ppt_service import _safe_filename
    return _safe_filename(notes.get("title") or "custom")


@ppt_bp.route("/study-summary/custom/pptx-from-content", methods=["POST"])
def download_custom_pptx_from_content_route():
    payload = request.get_json(silent=True) or {}
    notes = payload.get("notes")
    if not notes or not isinstance(notes, dict):
        return error_response("Request body must include a 'notes' object.", status_code=400)
    try:
        file_bytes = build_pptx_from_deck_content(notes, subtitle="Study Summary")
    except Exception as exc:  # pragma: no cover — build step has no domain-specific error type
        return error_response(f"Couldn't build the slide deck: {exc}", status_code=422)
    return _send_pptx(file_bytes, f"{_safe_filename_from_notes(notes)}_study_summary.pptx")


@ppt_bp.route("/study-summary/custom/pdf-from-content", methods=["POST"])
def download_custom_pdf_from_content_route():
    payload = request.get_json(silent=True) or {}
    notes = payload.get("notes")
    if not notes or not isinstance(notes, dict):
        return error_response("Request body must include a 'notes' object.", status_code=400)
    try:
        file_bytes = build_pdf_from_deck_content(notes, subtitle="Study Summary")
    except Exception as exc:  # pragma: no cover
        return error_response(f"Couldn't build the slide deck: {exc}", status_code=422)
    return _send_pdf(file_bytes, f"{_safe_filename_from_notes(notes)}_study_summary.pdf")
