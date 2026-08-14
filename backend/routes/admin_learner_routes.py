"""
routes/admin_learner_routes.py

Admin-only Learner Intelligence routes. Thin — all the join/aggregation
logic lives in services/learner_intelligence_service.py, which itself
reads the EXISTING topic_quiz_progress / topic_quiz_attempts collections
(no new Firestore collection needed for this).

    GET /api/admin/learners
        Filterable list for the Learner Intelligence search table.
        Query params (all optional): email, skill, topic, learnerType.

    GET /api/admin/learners/profile
        One learner's full skill-wise breakdown + WHY they were
        classified Fast/Moderate/Slow per skill. Query param: email
        (required).
"""

from flask import Blueprint, request

from services.learner_intelligence_service import get_dashboard_summary, get_student_profile, list_learners
from utils.admin_auth import require_admin
from utils.response_helper import error_response, success_response

admin_learner_bp = Blueprint("admin_learners", __name__)


@admin_learner_bp.route("/admin/learners/summary", methods=["GET"])
@require_admin
def dashboard_summary_route():
    try:
        summary = get_dashboard_summary()
        return success_response(data=summary, message="Dashboard summary fetched successfully.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@admin_learner_bp.route("/admin/learners", methods=["GET"])
@require_admin
def list_learners_route():
    try:
        rows = list_learners(
            email=request.args.get("email"),
            skill=request.args.get("skill"),
            topic=request.args.get("topic"),
            learner_type=request.args.get("learnerType"),
        )
        return success_response(data=rows, message=f"{len(rows)} record(s) found.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@admin_learner_bp.route("/admin/learners/profile", methods=["GET"])
@require_admin
def student_profile_route():
    email = request.args.get("email")
    if not email:
        return error_response("Query param 'email' is required.", status_code=400)

    try:
        profile = get_student_profile(email)
        if profile is None:
            return error_response(f"No user found for email '{email}'.", status_code=404)
        return success_response(data=profile, message="Learner profile fetched successfully.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
