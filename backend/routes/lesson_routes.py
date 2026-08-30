"""
routes/learning_routes.py

GET  /api/learning/topic/<skill>/<topic>/<focusBand>  -> assembled Topic
    Package (AI-generated cached notes + resources). Notes are keyed on
    (skill, topic, focusBand); resources are keyed on (skill, focusBand)
    only — see services/resource_repository.py's module docstring for
    why resources dropped the topic dimension. Student-facing.

GET  /api/learning/path/<skill>/<topic>  -> the caller's full learning
    path for that skill/topic: one Topic Package per band, in order,
    per services/learning_path.py (band sequence decided by the
    learner's initial-assessment current_level from their saved
    roadmap, NOT by topic-quiz mastery). Requires a Firebase ID token
    (Authorization: Bearer <token>) — uid is derived from the verified
    token via utils/learner_auth.require_learner, never accepted as a
    URL/query/body param, so a caller can only ever fetch their own
    path.

Admin CRUD for the Resource Bank (services/resource_repository.py via
services/resource_review_service.py), same pattern as
routes/admin_question_routes.py:

    GET    /api/admin/learning-resources                 -> list (filters: skill, band, type, status)
    POST   /api/admin/learning-resources                 -> add one (status="verified", source="manual")
    PATCH  /api/admin/learning-resources/<id>              -> edit fields (title/url/type/skill/band/description)
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

from flask import Blueprint, g, request

from config.settings import settings
from services.learning_content_service import get_topic_package, LearningContentError
from services.learning_path import build_learning_path, LearningPathError
from services.resource_repository import add_resource, list_resources, delete_resource
from utils.learner_auth import require_learner
from services.resource_review_service import (
    generate_pending_suggestions,
    generate_youtube_suggestions,
    generate_and_auto_verify,
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
from utils.admin_auth import require_admin
from utils.response_helper import success_response, error_response

learning_bp = Blueprint("learning", __name__)

# Was hardcoded to ["documentation", "github"] — now the single shared
# list from config/settings.py (also used by resource_repository.py and
# resource_suggestion_agent.py) so adding a type is a one-line change,
# not a 3-file hunt.
VALID_RESOURCE_TYPES = settings.VALID_RESOURCE_TYPES
VALID_RESOURCE_BANDS = settings.VALID_RESOURCE_BANDS
VALID_RESOURCE_CATEGORIES = settings.VALID_RESOURCE_CATEGORIES


@learning_bp.route("/learning/topic/<skill>/<topic>/<focus_band>", methods=["GET"])
def get_topic_package_route(skill, topic, focus_band):
    try:
        package = get_topic_package(skill=skill, topic=topic, focus_band=focus_band)
        return success_response(data=package, message="Topic package loaded.")
    except LearningContentError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/learning/path/<skill>/<topic>", methods=["GET"])
@require_learner
def get_learning_path_route(skill, topic):
    """uid comes ONLY from the verified token (flask.g.learner["uid"],
    set by require_learner) — never from the URL, query string, or
    body, so a caller can't request another learner's path."""
    uid = g.learner["uid"]
    try:
        path = build_learning_path(uid=uid, skill=skill, topic=topic)
        return success_response(data=path, message="Learning path loaded.")
    except LearningPathError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources", methods=["GET"])
@require_admin
def list_learning_resources_route():
    """List/search for the Resource Bank screen. All filters optional
    and additive (unchanged behavior when omitted) — ?band= replaces the
    old ?topic=/?difficulty= filters.

    ?status= accepts either one value ("verified") or a comma-separated
    list ("verified,rejected") — the latter is how the Resource Bank's
    main table asks for "verified + rejected, never pending" in a
    single Firestore query instead of over-fetching (see
    services/resource_repository.py's list_resources() docstring)."""
    try:
        db = get_firestore_client()
        status_param = request.args.get("status") or None
        status_filter = status_param.split(",") if status_param and "," in status_param else status_param
        resources = list_resources(
            db,
            skill=request.args.get("skill") or None,
            band=request.args.get("band") or None,
            status=status_filter,
            resource_type=request.args.get("type") or None,
            category=request.args.get("category") or None,
        )
        return success_response(data=resources, message="Resources fetched successfully.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources", methods=["POST"])
@require_admin
def add_learning_resource_route():
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    skill = payload.get("skill")
    band = payload.get("band")
    resource_type = payload.get("type")
    title = payload.get("title")
    url = payload.get("url")
    description = payload.get("description", "")
    is_pinned = bool(payload.get("isPinned", False))
    category = payload.get("category") or None  # "practice" | "reference" | None -> type-based default

    missing = [
        name for name, val in
        [("skill", skill), ("band", band), ("type", resource_type), ("title", title), ("url", url)]
        if not str(val or "").strip()
    ]
    if missing:
        return error_response(f"Missing required field(s): {missing}", status_code=400)
    if resource_type not in VALID_RESOURCE_TYPES:
        return error_response(f"'type' must be one of {VALID_RESOURCE_TYPES}.", status_code=400)
    if band not in VALID_RESOURCE_BANDS:
        return error_response(f"'band' must be one of {VALID_RESOURCE_BANDS}.", status_code=400)
    if category is not None and category not in VALID_RESOURCE_CATEGORIES:
        return error_response(f"'category' must be one of {VALID_RESOURCE_CATEGORIES} or omitted.", status_code=400)

    try:
        db = get_firestore_client()
        resource = add_resource(
            db, skill, band, resource_type, title, url,
            description=description, is_pinned=is_pinned, category=category,
        )
        return success_response(data=resource, message="Resource added successfully.", status_code=201)
    except ValueError as exc:
        return error_response(str(exc), status_code=400)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/<resource_id>", methods=["PATCH"])
@require_admin
def edit_learning_resource_route(resource_id):
    """General field edit — title/url/type/skill/band/description.
    Distinct from /verify and /reject below (those are the
    review-workflow status transition, kept narrow on purpose)."""
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
@require_admin
def delete_learning_resource_route(resource_id):
    try:
        db = get_firestore_client()
        delete_resource(db, resource_id)
        return success_response(data=None, message="Resource deleted successfully.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/<resource_id>/pin", methods=["PATCH"])
@require_admin
def pin_learning_resource_route(resource_id):
    payload = request.get_json(silent=True) or {}
    try:
        resource = pin_resource(resource_id, bool(payload.get("pinned", True)))
        return success_response(data=resource, message="Resource pin status updated.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/<resource_id>/enabled", methods=["PATCH"])
@require_admin
def set_learning_resource_enabled_route(resource_id):
    payload = request.get_json(silent=True) or {}
    try:
        resource = set_resource_enabled(resource_id, bool(payload.get("enabled", True)))
        return success_response(data=resource, message="Resource visibility updated.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/suggest", methods=["POST"])
@require_admin
def suggest_learning_resources_route():
    """
    AI suggests candidate resources (documentation/article/github/pdf/
    cheatsheet/practice — NOT video, see agents/resource_suggestion_agent.py's
    UPDATE note) for a skill/band, saved as status="pending" — none
    visible to students until reviewed via the /verify or /reject
    routes below.
    """
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    skill = payload.get("skill")
    band = payload.get("band")
    count = payload.get("count", 5)

    if not skill or not band:
        return error_response("Request body must include 'skill' and 'band'.", status_code=400)
    if band not in VALID_RESOURCE_BANDS:
        return error_response(f"'band' must be one of {VALID_RESOURCE_BANDS}.", status_code=400)

    try:
        suggestions = generate_pending_suggestions(skill=skill, band=band, count=int(count))
        return success_response(
            data=suggestions,
            message=f"Generated {len(suggestions)} suggestion(s) for review.",
        )
    except ResourceReviewError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/suggest-youtube", methods=["POST"])
@require_admin
def suggest_youtube_resources_route():
    """
    Real YouTube Data API v3 search for a skill/band
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
    band = payload.get("band")
    count = payload.get("count", 6)

    if not skill or not band:
        return error_response("Request body must include 'skill' and 'band'.", status_code=400)
    if band not in VALID_RESOURCE_BANDS:
        return error_response(f"'band' must be one of {VALID_RESOURCE_BANDS}.", status_code=400)

    try:
        suggestions = generate_youtube_suggestions(skill=skill, band=band, count=int(count))
        return success_response(
            data=suggestions,
            message=f"Found {len(suggestions)} YouTube video(s) for review.",
        )
    except ResourceReviewError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/bulk-generate-and-verify", methods=["POST"])
@require_admin
def bulk_generate_and_verify_route():
    """
    One-click 'fill this in' for the Resource Bank — generates AND
    immediately verifies both article/GitHub/practice-type resources
    and real YouTube videos for one (skill, band) in a single call,
    skipping the pending-review queue entirely (see
    resource_review_service.generate_and_auto_verify()'s docstring for
    why that trade-off is deliberate here).

    Body: {skill, band, verifiedBy, articleCount?, videoCount?}
    verifiedBy is whatever identity string the admin panel has for the
    logged-in admin (see hooks/useAdminAuth.js — currently admin.email)
    — required, since an empty verifiedBy would make the audit trail
    meaningless.
    """
    payload = request.get_json(silent=True) or {}
    skill = payload.get("skill")
    band = payload.get("band")
    verified_by = payload.get("verifiedBy")
    article_count = payload.get("articleCount", 5)
    video_count = payload.get("videoCount", 4)

    missing = [k for k, v in [("skill", skill), ("band", band), ("verifiedBy", verified_by)] if not v]
    if missing:
        return error_response(f"Missing required field(s): {missing}", status_code=400)
    if band not in VALID_RESOURCE_BANDS:
        return error_response(f"'band' must be one of {VALID_RESOURCE_BANDS}.", status_code=400)

    try:
        result = generate_and_auto_verify(
            skill=skill, band=band, verified_by=verified_by,
            article_count=int(article_count), video_count=int(video_count),
        )
        total = len(result["articles"]) + len(result["videos"])
        return success_response(
            data=result,
            message=f"Generated and verified {total} resource(s) for {skill} ({band}).",
        )
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/pending", methods=["GET"])
@require_admin
def list_pending_resources_route():
    """The admin review queue — everything awaiting a verify/reject decision."""
    try:
        queue = get_pending_queue(skill=request.args.get("skill"), band=request.args.get("band"))
        return success_response(data=queue, message=f"{len(queue)} suggestion(s) awaiting review.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/<resource_id>/verify", methods=["PATCH"])
@require_admin
def verify_resource_route(resource_id):
    """Admin confirmed this link is real and good — now visible to students."""
    payload = request.get_json(silent=True) or {}
    try:
        resource = verify_resource(resource_id, verified_by=payload.get("verifiedBy", ""))
        return success_response(data=resource, message="Resource verified and published.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@learning_bp.route("/admin/learning-resources/<resource_id>/unverify", methods=["PATCH"])
@require_admin
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
@require_admin
def reject_resource_route(resource_id):
    """Admin confirmed this link is bad — kept, but never shown to students."""
    try:
        resource = reject_resource(resource_id)
        return success_response(data=resource, message="Resource rejected.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
