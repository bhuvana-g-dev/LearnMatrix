"""
routes/lesson_routes.py

GET /api/lessons/<skill>/<topic>
    -> the ordered lesson list for a topic (generates + caches on first
       call, see services/lesson_service.get_lessons()).

GET /api/lessons/<skill>/<topic>/<lesson_title>/<focus_band>
    -> one lesson's actual content (theory + resources), reusing the
       existing get_topic_package() pipeline scoped to this lesson.
       lesson_title in the URL must be exactly one of the Titles
       returned by the list route above.
"""

from flask import Blueprint

from services.lesson_service import get_lessons, get_lesson_content, LessonServiceError
from services.learning_content_service import LearningContentError
from utils.response_helper import success_response, error_response

lesson_bp = Blueprint("lesson", __name__)


@lesson_bp.route("/lessons/<skill>/<topic>", methods=["GET"])
def get_lessons_route(skill, topic):
    try:
        lessons = get_lessons(skill=skill, topic=topic)
        return success_response(
            data={"skill": skill, "topic": topic, "lessons": lessons},
            message=f"{len(lessons)} lesson(s) for {skill} / {topic}.",
        )
    except LessonServiceError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@lesson_bp.route("/lessons/<skill>/<topic>/<lesson_title>/<focus_band>", methods=["GET"])
def get_lesson_content_route(skill, topic, lesson_title, focus_band):
    try:
        package = get_lesson_content(skill=skill, topic=topic, lesson_title=lesson_title, focus_band=focus_band)
        return success_response(data=package, message="Lesson content ready.")
    except LearningContentError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
