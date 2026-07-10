"""
models/question_model.py

Canonical shape of a Question, mirroring the Firestore document structure
exactly:

    questions/{QuestionID}
        QuestionID, Skill, Topic, Difficulty, QuestionType, Question,
        OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation,
        Status, CreatedAt, UpdatedAt

CreatedAt/UpdatedAt are deliberately NOT part of `from_excel_row()` — they
are server-managed timestamps, injected only by
services/question_repository.py at upsert time. This is the one place the
"Excel never controls timestamps" rule is enforced structurally rather than
by convention.
"""

from dataclasses import dataclass, asdict, field
from typing import Optional

from config.settings import settings


@dataclass
class Question:
    QuestionID: str
    Skill: str
    Topic: str
    Difficulty: str
    QuestionType: str
    Question: str
    OptionA: str
    OptionB: str
    OptionC: str
    OptionD: str
    CorrectAnswer: str
    Explanation: str
    Status: str = settings.STATUS_ACTIVE

    # Added for the Admin Panel. Excel rows never carried a Role, only
    # Skill, so this defaults to "" for anything imported from .xlsx and is
    # populated going forward for questions created/edited via the admin form.
    Role: str = ""

    # Server-managed. None until services/question_repository.py sets them.
    CreatedAt: Optional[object] = field(default=None)
    UpdatedAt: Optional[object] = field(default=None)

    @staticmethod
    def from_excel_row(row: dict) -> "Question":
        """
        Build a Question from a raw Excel row dict. Blank/missing Status
        defaults to Active — an empty Status cell should not silently hide
        a question from quizzes.
        """
        raw_status = row.get("Status")
        raw_status = str(raw_status).strip() if raw_status not in (None, "") else ""
        status = raw_status if raw_status else settings.STATUS_ACTIVE

        return Question(
            QuestionID=str(row.get("QuestionID")).strip(),
            Skill=row.get("Skill"),
            Topic=row.get("Topic"),
            Difficulty=row.get("Difficulty"),
            QuestionType=row.get("QuestionType"),
            Question=row.get("Question"),
            OptionA=row.get("OptionA"),
            OptionB=row.get("OptionB"),
            OptionC=row.get("OptionC"),
            OptionD=row.get("OptionD"),
            CorrectAnswer=row.get("CorrectAnswer"),
            Explanation=row.get("Explanation"),
            Status=status,
        )

    @staticmethod
    def from_admin_payload(payload: dict) -> "Question":
        """
        Build a Question from an Admin Panel form submission (JSON body of
        POST/PUT /api/admin/questions). Unlike from_excel_row(), Topic and
        Explanation are optional here since the admin form does not collect
        them — they default to "" rather than raising.
        """
        raw_status = payload.get("Status")
        raw_status = str(raw_status).strip() if raw_status not in (None, "") else ""
        status = raw_status if raw_status else settings.STATUS_ACTIVE

        return Question(
            QuestionID=str(payload.get("QuestionID")).strip(),
            Role=payload.get("Role", ""),
            Skill=payload.get("Skill"),
            Topic=payload.get("Topic", ""),
            Difficulty=payload.get("Difficulty"),
            QuestionType=payload.get("QuestionType"),
            Question=payload.get("Question"),
            OptionA=payload.get("OptionA"),
            OptionB=payload.get("OptionB"),
            OptionC=payload.get("OptionC"),
            OptionD=payload.get("OptionD"),
            CorrectAnswer=payload.get("CorrectAnswer"),
            Explanation=payload.get("Explanation", ""),
            Status=status,
        )

    def to_upload_dict(self) -> dict:
        """
        Fields sourced from Excel, WITHOUT CreatedAt/UpdatedAt — the
        repository layer adds those depending on insert-vs-update.
        """
        data = asdict(self)
        data.pop("CreatedAt", None)
        data.pop("UpdatedAt", None)
        return data

    def to_dict(self) -> dict:
        return asdict(self)
