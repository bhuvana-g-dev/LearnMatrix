"""
routes/admin_lesson_routes.py

Admin CRUD (read + delete only — same "generated, never hand-authored"
rule as routes/generated_content_routes.py) for the cached lesson-plan
list (services/lesson_service.py / services/lesson_repository.py's
`lesson_plans` collection).

This is deliberately its OWN route file/collection, not folded into
generated_content_routes.py: a topic has one lesson_plans doc (the
ordered Title list), completely separate from the learning_notes docs
that back each lesson's actual content. Deleting a learning_notes entry
does NOT delete this doc, and vice versa — an admin who wants a topic's
lesson list to regenerate (e.g. after reseeding syllabus data, or to
pick up a fixed LessonPlannerAgent prompt) needs THIS delete, not the
Generated Content one.

    GET    /api/admin/lesson-plans                 -> list (filters: skill, topic)
    DELETE /api/admin/lesson-plans/<skill>/<topic>  -> remove; next
        learner request for get_lessons(skill, topic) regenerates a
        fresh ordered lesson list and re-caches it under the same doc
        id (see services/lesson_service.py) — no other change needed.
"""

from flask import Blueprint, request

from services.lesson_service import list_lesson_plans, delete_lessons, LessonServiceError
from utils.response_helper import success_response, error_response

admin_lesson_bp = Blueprint("admin_lesson", __name__)


@admin_lesson_bp.route("/admin/lesson-plans", methods=["GET"])
def list_lesson_plans_route():
    try:
        items = list_lesson_plans(
            skill=request.args.get("skill") or None,
            topic=request.args.get("topic") or None,
        )
        return success_response(data=items, message=f"{len(items)} lesson plan(s) found.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@admin_lesson_bp.route("/admin/lesson-plans/<skill>/<topic>", methods=["DELETE"])
def delete_lesson_plan_route(skill, topic):
    try:
        delete_lessons(skill=skill, topic=topic)
        return success_response(data=None, message="Lesson plan deleted. It will regenerate on next request.")
    except LessonServiceError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
