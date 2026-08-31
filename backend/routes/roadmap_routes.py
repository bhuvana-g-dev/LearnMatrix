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

from services.roadmap_service import load_saved_roadmap, recompute_all_mastery
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


@roadmap_bp.route("/roadmap/<uid>/recompute", methods=["POST"])
@require_owner()
def recompute_roadmap_route(uid):
    """
    One-off "re-judge my existing progress under current mastery rules"
    endpoint — see services.roadmap_service.recompute_all_mastery's
    docstring for why this is needed on top of the automatic per-quiz
    recompute. Frontend calls this once from the Profile dashboard (see
    services/userProgressCache.js) so learners whose lessons/quizzes
    predate a mastery-logic change don't have to retake anything to see
    it reflected.
    """
    try:
        roadmap = recompute_all_mastery(uid)
        if roadmap is None:
            return success_response(
                data=None,
                message="No roadmap found for this user yet — take the diagnostic assessment first.",
            )
        return success_response(data=roadmap, message="Roadmap recomputed.")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled error in %s", request.path)
        return error_response(str(exc), status_code=500)
