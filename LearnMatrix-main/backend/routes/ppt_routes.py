"""
routes/ppt_routes.py

    GET /api/study-summary/topic/<skill>/<topic>/<focus_band>/pptx -> from Learning Hub notes
    GET /api/study-summary/sources/<uid>/pptx                     -> from uploaded/linked sources
    GET /api/study-summary/chat/<uid>/<session_id>/pptx           -> from one chat session

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
    PptServiceError,
)
from utils.response_helper import error_response

ppt_bp = Blueprint("ppt", __name__)


def _send_pptx(file_bytes, filename):
    return send_file(
        file_bytes,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )


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
