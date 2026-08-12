"""
routes/topic_quiz_routes.py

GET  /api/topic-quiz/<skill>/<topic>?uid=...  -> 10-question quiz (bank
     first, AI fills any shortfall). Student-facing, called when a
     learner hits "Next" after a topic's Key Takeaways / Resources.
     uid is required now — the quiz cache is PER STUDENT (see
     services/topic_quiz_bank_cache.py), not shared across everyone.

POST /api/topic-quiz/<skill>/<topic>/submit   -> scores the attempt,
     classifies the learner (Fast/Moderate/Slow), schedules the next
     revision date, and persists both the attempt and updated progress.

GET  /api/revisions/<uid>                     -> topics currently due for
     revision (NextReviewDate <= today) — backs the dashboard's
     "Upcoming Revisions" / "Due Today" card.
"""

from flask import Blueprint, request

from services.topic_quiz_service import get_topic_quiz, submit_topic_quiz, get_due_revisions, TopicQuizError
from utils.response_helper import success_response, error_response

topic_quiz_bp = Blueprint("topic_quiz", __name__)


@topic_quiz_bp.route("/topic-quiz/<skill>/<topic>", methods=["GET"])
def get_topic_quiz_route(skill, topic):
    uid = request.args.get("uid")
    if not uid:
        return error_response("uid query parameter is required.", status_code=400)
    try:
        quiz = get_topic_quiz(uid=uid, skill=skill, topic=topic)
        return success_response(data=quiz, message="Topic quiz ready.")
    except TopicQuizError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@topic_quiz_bp.route("/topic-quiz/<skill>/<topic>/submit", methods=["POST"])
def submit_topic_quiz_route(skill, topic):
    payload = request.get_json(silent=True) or {}
    uid = payload.get("uid")
    questions = payload.get("questions")
    answers = payload.get("answers")
    time_taken_seconds = payload.get("timeTakenSeconds", 0)

    if not uid:
        return error_response("uid is required.", status_code=400)
    if not isinstance(questions, list) or not questions:
        return error_response("questions (list, echoed back from the GET response) is required.", status_code=400)
    if not isinstance(answers, dict):
        return error_response("answers (object) is required.", status_code=400)

    try:
        result = submit_topic_quiz(
            uid=uid, skill=skill, topic=topic,
            questions=questions, answers=answers,
            time_taken_seconds=int(time_taken_seconds),
        )
        return success_response(data=result, message="Quiz submitted.")
    except TopicQuizError as exc:
        return error_response(str(exc), status_code=422)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@topic_quiz_bp.route("/revisions/<uid>", methods=["GET"])
def get_due_revisions_route(uid):
    try:
        due = get_due_revisions(uid=uid)
        return success_response(data=due, message=f"{len(due)} topic(s) due for revision.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
