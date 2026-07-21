"""
routes/learning_routes.py

GET  /api/learning/topic/<skill>/<topic>/<focusBand>  -> assembled Topic
    Package (AI-generated cached notes + curated links). Student-facing.

Admin CRUD for the small curated-links table (services/resource_repository.py),
same pattern as routes/admin_question_routes.py:

    GET    /api/admin/learning-resources           -> list (optional ?skill=&topic=)
    POST   /api/admin/learning-resources            -> add one
    DELETE /api/admin/learning-resources/<id>        -> remove one
"""

from flask import Blueprint, request

from services.learning_content_service import get_topic_package, LearningContentError
from services.resource_repository import add_resource, list_resources, delete_resource
from services.resource_review_service import (
    generate_pending_suggestions,
    get_pending_queue,
    verify_resource,
    reject_resource,
    ResourceReviewError,
)
from firebase.firebase_config import get_firestore_client
from utils.response_helper import success_response, error_response

learning_bp = Blueprint("learning", __name__)

VALID_RESOURCE_TYPES = ["documentation", "github"]


@learning_bp.route("/learning/topic/<skill>/<topic>/<focus_band>", methods=["GET"])
def get_topic_package_route(skill, topic, focus_band):
    try:
        package = get_topic_package(skill=skill, topic=topic, focus_band=focus_band)
        return success_response(data=package, message="Topic package loaded.")
    except LearningContentError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources", methods=["GET"])
def list_learning_resources_route():
    try:
        db = get_firestore_client()
        resources = list_resources(db, skill=request.args.get("skill"), topic=request.args.get("topic"))
        return success_response(data=resources, message="Resources fetched successfully.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources", methods=["POST"])
def add_learning_resource_route():
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    skill = payload.get("skill")
    topic = payload.get("topic")
    resource_type = payload.get("type")
    title = payload.get("title")
    url = payload.get("url")

    missing = [
        name for name, val in
        [("skill", skill), ("topic", topic), ("type", resource_type), ("title", title), ("url", url)]
        if not str(val or "").strip()
    ]
    if missing:
        return error_response(f"Missing required field(s): {missing}", status_code=400)
    if resource_type not in VALID_RESOURCE_TYPES:
        return error_response(f"'type' must be one of {VALID_RESOURCE_TYPES}.", status_code=400)

    try:
        db = get_firestore_client()
        resource = add_resource(db, skill, topic, resource_type, title, url)
        return success_response(data=resource, message="Resource added successfully.", status_code=201)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/<resource_id>", methods=["DELETE"])
def delete_learning_resource_route(resource_id):
    try:
        db = get_firestore_client()
        delete_resource(db, resource_id)
        return success_response(data=None, message="Resource deleted successfully.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/suggest", methods=["POST"])
def suggest_learning_resources_route():
    """
    AI suggests candidate resources for a skill/topic, saved as
    status="pending" — none visible to students until reviewed via
    the /verify or /reject routes below. See
    agents/resource_suggestion_agent.py for why this can't be trusted
    unsupervised.
    """
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    skill = payload.get("skill")
    topic = payload.get("topic")
    count = payload.get("count", 5)

    if not skill or not topic:
        return error_response("Request body must include 'skill' and 'topic'.", status_code=400)

    try:
        suggestions = generate_pending_suggestions(skill=skill, topic=topic, count=int(count))
        return success_response(
            data=suggestions,
            message=f"Generated {len(suggestions)} suggestion(s) for review.",
        )
    except ResourceReviewError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/pending", methods=["GET"])
def list_pending_resources_route():
    """The admin review queue — everything awaiting a verify/reject decision."""
    try:
        queue = get_pending_queue(skill=request.args.get("skill"), topic=request.args.get("topic"))
        return success_response(data=queue, message=f"{len(queue)} suggestion(s) awaiting review.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/<resource_id>/verify", methods=["PATCH"])
def verify_resource_route(resource_id):
    """Admin confirmed this link is real and good — now visible to students."""
    try:
        resource = verify_resource(resource_id)
        return success_response(data=resource, message="Resource verified and published.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/<resource_id>/reject", methods=["PATCH"])
def reject_resource_route(resource_id):
    """Admin confirmed this link is bad — kept, but never shown to students."""
    try:
        resource = reject_resource(resource_id)
        return success_response(data=resource, message="Resource rejected.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
