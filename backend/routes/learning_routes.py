"""
routes/learning_routes.py

GET  /api/learning/topic/<skill>/<topic>/<focusBand>  -> assembled Topic
    Package (AI-generated cached notes + resources, priority-ordered:
    admin-verified Firestore -> live YouTube fallback (video only) ->
    empty category). Student-facing.

Admin CRUD for the Resource Bank (services/resource_repository.py via
services/resource_review_service.py), same pattern as
routes/admin_question_routes.py:

    GET    /api/admin/learning-resources                 -> list (filters: skill, topic, type, difficulty, status)
    POST   /api/admin/learning-resources                 -> add one (status="verified", source="manual")
    PATCH  /api/admin/learning-resources/<id>              -> edit fields (title/url/type/skill/topic/difficulty/description)
    DELETE /api/admin/learning-resources/<id>              -> remove one
    PATCH  /api/admin/learning-resources/<id>/pin           -> {"pinned": bool}
    PATCH  /api/admin/learning-resources/<id>/enabled        -> {"enabled": bool}

AI/YouTube suggestion + review queue (services/resource_review_service.py):

    POST   /api/admin/learning-resources/suggest            -> AI-suggest non-video resources, saved as pending
    POST   /api/admin/learning-resources/suggest-youtube     -> real YouTube search, saved as pending
    GET    /api/admin/learning-resources/pending             -> the review queue
    PATCH  /api/admin/learning-resources/<id>/verify          -> pending -> verified
    PATCH  /api/admin/learning-resources/<id>/reject           -> pending -> rejected
"""

from flask import Blueprint, request

from config.settings import settings
from services.learning_content_service import get_topic_package, LearningContentError
from services.resource_repository import add_resource, list_resources, delete_resource
from services.resource_review_service import (
    generate_pending_suggestions,
    generate_youtube_suggestions,
    get_pending_queue,
    verify_resource,
    unverify_resource,
    reject_resource,
    edit_resource,
    pin_resource,
    set_resource_enabled,
    ResourceReviewError,
)
from firebase.firebase_config import get_firestore_client
from utils.response_helper import success_response, error_response

learning_bp = Blueprint("learning", __name__)

# Was hardcoded to ["documentation", "github"] — now the single shared
# list from config/settings.py (also used by resource_repository.py and
# resource_suggestion_agent.py) so adding a type is a one-line change,
# not a 3-file hunt.
VALID_RESOURCE_TYPES = settings.VALID_RESOURCE_TYPES
VALID_DIFFICULTIES = settings.VALID_TOPIC_DIFFICULTIES


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
    """List/search for the Resource Bank screen. All filters optional
    and additive (unchanged behavior when omitted, same as before this
    revision) — new ?type= and ?difficulty= filters added for the
    Resource Bank's filter bar."""
    try:
        db = get_firestore_client()
        resources = list_resources(
            db,
            skill=request.args.get("skill") or None,
            topic=request.args.get("topic") or None,
            status=request.args.get("status") or None,
            resource_type=request.args.get("type") or None,
            difficulty=request.args.get("difficulty") or None,
        )
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
    difficulty = payload.get("difficulty") or None
    description = payload.get("description", "")
    is_pinned = bool(payload.get("isPinned", False))

    missing = [
        name for name, val in
        [("skill", skill), ("topic", topic), ("type", resource_type), ("title", title), ("url", url)]
        if not str(val or "").strip()
    ]
    if missing:
        return error_response(f"Missing required field(s): {missing}", status_code=400)
    if resource_type not in VALID_RESOURCE_TYPES:
        return error_response(f"'type' must be one of {VALID_RESOURCE_TYPES}.", status_code=400)
    if difficulty is not None and difficulty not in VALID_DIFFICULTIES:
        return error_response(f"'difficulty' must be one of {VALID_DIFFICULTIES} or omitted.", status_code=400)

    try:
        db = get_firestore_client()
        resource = add_resource(
            db, skill, topic, resource_type, title, url,
            difficulty=difficulty, description=description, is_pinned=is_pinned,
        )
        return success_response(data=resource, message="Resource added successfully.", status_code=201)
    except ValueError as exc:
        return error_response(str(exc), status_code=400)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/<resource_id>", methods=["PATCH"])
def edit_learning_resource_route(resource_id):
    """General field edit — title/url/type/skill/topic/difficulty/
    description. Distinct from /verify and /reject below (those are
    the review-workflow status transition, kept narrow on purpose)."""
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)
    try:
        resource = edit_resource(resource_id, payload)
        return success_response(data=resource, message="Resource updated successfully.")
    except ValueError as exc:
        return error_response(str(exc), status_code=400)
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


@learning_bp.route("/admin/learning-resources/<resource_id>/pin", methods=["PATCH"])
def pin_learning_resource_route(resource_id):
    payload = request.get_json(silent=True) or {}
    try:
        resource = pin_resource(resource_id, bool(payload.get("pinned", True)))
        return success_response(data=resource, message="Resource pin status updated.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/<resource_id>/enabled", methods=["PATCH"])
def set_learning_resource_enabled_route(resource_id):
    payload = request.get_json(silent=True) or {}
    try:
        resource = set_resource_enabled(resource_id, bool(payload.get("enabled", True)))
        return success_response(data=resource, message="Resource visibility updated.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/suggest", methods=["POST"])
def suggest_learning_resources_route():
    """
    AI suggests candidate resources (documentation/article/github/pdf/
    cheatsheet/practice — NOT video, see agents/resource_suggestion_agent.py's
    UPDATE note) for a skill/topic, saved as status="pending" — none
    visible to students until reviewed via the /verify or /reject
    routes below.
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


@learning_bp.route("/admin/learning-resources/suggest-youtube", methods=["POST"])
def suggest_youtube_resources_route():
    """
    Real YouTube Data API v3 search for a skill/topic
    (services/youtube_service.py), saved as status="pending" for the
    same admin review gate as every other suggestion source. Returns a
    422 (not 500) when YOUTUBE_API_KEY isn't configured or the API
    call fails — an expected/handleable condition for the admin to see
    in the UI, not a server error.
    """
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    skill = payload.get("skill")
    topic = payload.get("topic")
    count = payload.get("count", 6)

    if not skill or not topic:
        return error_response("Request body must include 'skill' and 'topic'.", status_code=400)

    try:
        suggestions = generate_youtube_suggestions(skill=skill, topic=topic, count=int(count))
        return success_response(
            data=suggestions,
            message=f"Found {len(suggestions)} YouTube video(s) for review.",
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


@learning_bp.route("/admin/learning-resources/<resource_id>/unverify", methods=["PATCH"])
def unverify_resource_route(resource_id):
    """
    Pulls a verified resource back out of student view (status ->
    "pending") without marking it rejected — e.g. an admin decides a
    video isn't the right fit anymore but it isn't "wrong" either. Back
    in the review queue afterward, easy to re-verify later.
    """
    try:
        resource = unverify_resource(resource_id)
        return success_response(data=resource, message="Resource unverified and removed from student view.")
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
