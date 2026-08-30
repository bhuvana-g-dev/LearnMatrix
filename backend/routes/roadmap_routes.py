"""
routes/roadmap_routes.py

GET /api/roadmap/<uid> -> the user's saved roadmap, or null if they
                           haven't generated one yet.

Separate from ai_assessment_routes.py deliberately — this is a plain
Firestore read (services/roadmap_service.load_saved_roadmap), not an AI
agent action, so it doesn't belong under the /ai/ path prefix pattern
those routes use.
"""

import logging

from flask import Blueprint, request

from services.roadmap_service import load_saved_roadmap
from utils.response_helper import success_response, error_response
from utils.user_auth import require_owner

logger = logging.getLogger(__name__)

roadmap_bp = Blueprint("roadmap", __name__)


@roadmap_bp.route("/roadmap/<uid>", methods=["GET"])
@require_owner()
def get_roadmap_route(uid):
    try:
        roadmap = load_saved_roadmap(uid)
        if roadmap is None:
            return success_response(
                data=None,
                message="No roadmap found for this user yet — take the diagnostic assessment first.",
            )
        return success_response(data=roadmap, message="Roadmap loaded.")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in %s", request.path)
        return error_response(str(exc), status_code=500)
