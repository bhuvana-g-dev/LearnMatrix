"""
routes/admin_question_routes.py

Admin Panel routes for Question Bank management. Registered in app.py the
same way every other blueprint is (url_prefix="/api"), so the full paths
are:

    GET   /api/admin/questions                -> list (search/filter, any Status)
    POST  /api/admin/questions                 -> create
    PUT   /api/admin/questions/<question_id>   -> update
    PATCH /api/admin/questions/<question_id>/status -> soft delete / reactivate
    POST  /api/admin/questions/extract-pdf     -> parse an uploaded PDF into
                                                   candidate rows (nothing is
                                                   saved by this route)

Like every other route module, this one only parses the request and
delegates to services/admin_question_service.py — no Firestore/pandas/PDF
logic lives here.
"""

from flask import Blueprint, request

from services.admin_question_service import (
    AdminQuestionError,
    get_questions_for_admin,
    create_question,
    update_question,
    set_question_status,
)
from utils.pdf_question_extractor import extract_questions_from_pdf, PdfExtractionError
from utils.response_helper import success_response, error_response

admin_question_bp = Blueprint("admin_questions", __name__)


@admin_question_bp.route("/admin/questions", methods=["GET"])
def list_questions_route():
    try:
        questions = get_questions_for_admin(
            skill=request.args.get("skill"),
            difficulty=request.args.get("difficulty"),
            status=request.args.get("status"),
            search=request.args.get("search"),
        )
        return success_response(data=questions, message="Questions fetched successfully.")
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@admin_question_bp.route("/admin/questions", methods=["POST"])
def create_question_route():
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    try:
        question = create_question(payload)
        return success_response(data=question, message="Question created successfully.", status_code=201)
    except AdminQuestionError as exc:
        return error_response(str(exc), status_code=400)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@admin_question_bp.route("/admin/questions/<question_id>", methods=["PUT"])
def update_question_route(question_id):
    payload = request.get_json(silent=True)
    if not payload:
        return error_response("Request body must be JSON.", status_code=400)

    try:
        question = update_question(question_id, payload)
        return success_response(data=question, message="Question updated successfully.")
    except AdminQuestionError as exc:
        return error_response(str(exc), status_code=400)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@admin_question_bp.route("/admin/questions/<question_id>/status", methods=["PATCH"])
def set_question_status_route(question_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("Status") or payload.get("status")

    if not status:
        return error_response("Request body must include 'Status'.", status_code=400)

    try:
        question = set_question_status(question_id, status)
        return success_response(data=question, message="Question status updated successfully.")
    except AdminQuestionError as exc:
        return error_response(str(exc), status_code=400)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)


@admin_question_bp.route("/admin/questions/extract-pdf", methods=["POST"])
def extract_pdf_route():
    """
    Accepts a multipart/form-data upload with a single file field named
    'file'. Returns candidate question rows for the admin to review and
    complete (QuestionID, Skill, Difficulty, QuestionType, Status)
    before saving each one via POST /api/admin/questions. Nothing is
    written to Firestore by this route.
    """
    if "file" not in request.files:
        return error_response("No file uploaded. Expected form field 'file'.", status_code=400)

    file = request.files["file"]
    if not file.filename.lower().endswith(".pdf"):
        return error_response("Only .pdf files are supported.", status_code=400)

    try:
        extracted = extract_questions_from_pdf(file.stream)
        return success_response(
            data=extracted,
            message=f"Extracted {len(extracted)} candidate question(s). Review before saving.",
        )
    except PdfExtractionError as exc:
        return error_response(str(exc), status_code=400)
    except Exception as exc:  # noqa: BLE001
        return error_response(str(exc), status_code=500)
