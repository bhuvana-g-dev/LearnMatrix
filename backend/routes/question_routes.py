"""
routes/question_routes.py

GET /api/questions              -> all Active questions, every skill
GET /api/questions?skill=Python -> Active questions for one skill

This route (and everything it calls) NEVER reads Excel. It only reads
Firestore via services/question_service.py -> services/question_repository.py.
Only scripts/upload_questions.py is allowed to open an .xlsx file.
"""

from flask import Blueprint, request
from services.question_service import get_questions
from utils.response_helper import success_response, error_response

question_bp = Blueprint("questions", __name__)


@question_bp.route("/questions", methods=["GET"])
def get_questions_route():
    skill = request.args.get("skill")

    try:
        questions = get_questions(skill)
        return success_response(
            data=questions, message="Questions fetched successfully."
        )
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
