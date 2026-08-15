"""
routes/certificate_routes.py

GET /api/certificates/<uid> -> the student's current certificate (for
                                 whatever career path their active
                                 roadmap is for), or null if they
                                 haven't started one yet.

Every call re-checks live roadmap completion and flips an in_progress
certificate to completed automatically — see
services/certificate_service.get_certificate_with_live_status for why
that's safe to do on every read instead of needing a separate
"complete" endpoint.
"""

from flask import Blueprint

from services.certificate_service import get_certificate_with_live_status
from utils.response_helper import success_response, error_response

certificate_bp = Blueprint("certificate", __name__)


@certificate_bp.route("/certificates/<uid>", methods=["GET"])
def get_certificate_route(uid):
    try:
        certificate = get_certificate_with_live_status(uid)
        if certificate is None:
            return success_response(
                data=None,
                message="No certificate yet — start a career path to begin one.",
            )
        return success_response(data=certificate, message="Certificate loaded.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
