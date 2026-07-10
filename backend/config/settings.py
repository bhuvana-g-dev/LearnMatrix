"""
config/settings.py

Single source of truth for every configurable value in the backend.
No file outside this module should call os.getenv() directly — this keeps
every "magic string" (paths, ports, origins) in one auditable place, and
means .env is the only thing that changes between dev / staging / prod.
"""

import os
from dotenv import load_dotenv

# Load variables from backend/.env into the process environment.
# Must run before any of the values below are read.
load_dotenv()


class Settings:
    # --- Flask ---
    FLASK_ENV: str = os.getenv("FLASK_ENV", "development")
    DEBUG: bool = os.getenv("FLASK_DEBUG", "True") == "True"
    PORT: int = int(os.getenv("PORT", 5000))

    # --- CORS ---
    # The React dev server origin. Comma-separated if you later add more.
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173"
    ).split(",")

    # --- Firebase ---
    # Path to the service account JSON. The file itself is never committed;
    # only this path is configured.
    FIREBASE_SERVICE_ACCOUNT_PATH: str = os.getenv(
        "FIREBASE_SERVICE_ACCOUNT_PATH", "firebase/serviceAccountKey.json"
    )

    # --- Question Bank (Excel = import source ONLY, never read at runtime) ---
    # Folder scanned for *.xlsx files by scripts/upload_questions.py.
    # Adding a new subject later means dropping a file here — never touching
    # this settings file or any route/service code.
    QUESTION_BANK_DIR: str = os.getenv("QUESTION_BANK_DIR", "QuestionBank")

    # Columns every Question Bank Excel file must contain. QuestionID is the
    # permanent, human-assigned key (PY001, JS001, ...) and becomes the
    # Firestore document ID — it must never change once assigned.
    REQUIRED_QUESTION_COLUMNS: list[str] = [
        "QuestionID",
        "Skill",
        "Topic",
        "Difficulty",
        "QuestionType",
        "Question",
        "OptionA",
        "OptionB",
        "OptionC",
        "OptionD",
        "CorrectAnswer",
        "Explanation",
        "Status",
    ]

    # --- Firestore ---
    QUESTIONS_COLLECTION: str = os.getenv("QUESTIONS_COLLECTION", "questions")

    # Status values. Stored as plain strings in Firestore, referenced via
    # these constants everywhere else so nothing typos "active" vs "Active".
    STATUS_ACTIVE: str = "Active"
    STATUS_INACTIVE: str = "Inactive"

    # --- Admin Question Form (routes/admin_question_routes.py) ---
    # Fields required on every create/update coming from the Admin Panel.
    # Kept separate from REQUIRED_QUESTION_COLUMNS (the Excel import schema)
    # since the admin form is the newer, human-entry surface and adds
    # "Role" (Excel rows never carried Role, only Skill).
    ADMIN_REQUIRED_QUESTION_FIELDS: list[str] = [
        "QuestionID",
        "Role",
        "Skill",
        "Difficulty",
        "QuestionType",
        "Question",
        "OptionA",
        "OptionB",
        "OptionC",
        "OptionD",
        "CorrectAnswer",
    ]


settings = Settings()
