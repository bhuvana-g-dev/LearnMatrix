"""
utils/question_bank_reader.py

*** IMPORT-TIME ONLY. Runtime Flask routes/services must NEVER import this
    module. Only scripts/upload_questions.py may read Excel files. ***

Responsibilities:
  1. Discover every *.xlsx file inside config.settings.QUESTION_BANK_DIR.
  2. Derive a "subject" name from each filename (Python.xlsx -> "Python").
  3. Read a subject's sheet into a list of row-dicts, validating that all
     REQUIRED_QUESTION_COLUMNS are present and that QuestionID has no
     duplicates within the file.

This module knows nothing about Firestore, and Firestore-facing code
(services/question_repository.py) knows nothing about Excel/pandas. That
boundary is what makes "Excel is an import source, not a runtime database"
true in code, not just in a comment.
"""

import os
import glob
import pandas as pd

from config.settings import settings


class QuestionBankError(Exception):
    """Raised for anything wrong with the Excel-based question bank."""


def list_available_subjects() -> list[str]:
    """
    Scan QUESTION_BANK_DIR and return subject names, one per *.xlsx file.
    e.g. ["Python"] today, ["Python", "Java", "SQL"] once more files land.
    Adding a new file here is the ONLY step needed to support a new subject —
    no code changes anywhere.
    """
    pattern = os.path.join(settings.QUESTION_BANK_DIR, "*.xlsx")
    files = glob.glob(pattern)
    return sorted(os.path.splitext(os.path.basename(f))[0] for f in files)


def _subject_file_path(subject: str) -> str:
    return os.path.join(settings.QUESTION_BANK_DIR, f"{subject}.xlsx")


def _validate_columns(df: pd.DataFrame, subject: str) -> None:
    missing = [
        col for col in settings.REQUIRED_QUESTION_COLUMNS if col not in df.columns
    ]
    if missing:
        raise QuestionBankError(
            f"'{subject}.xlsx' is missing required column(s): {missing}. "
            f"Expected columns: {settings.REQUIRED_QUESTION_COLUMNS}"
        )


def _validate_question_ids(rows: list[dict], subject: str) -> None:
    ids = [str(r.get("QuestionID")).strip() for r in rows]

    blank = [i for i, qid in enumerate(ids, start=2) if not qid or qid == "None"]
    if blank:
        raise QuestionBankError(
            f"'{subject}.xlsx' has blank QuestionID on row(s): {blank}."
        )

    seen = set()
    duplicates = set()
    for qid in ids:
        if qid in seen:
            duplicates.add(qid)
        seen.add(qid)
    if duplicates:
        raise QuestionBankError(
            f"'{subject}.xlsx' has duplicate QuestionID value(s): {sorted(duplicates)}."
        )


def read_questions(subject: str) -> list[dict]:
    """
    Read a single subject's Excel file and return a list of row-dicts.
    Raises QuestionBankError if the file is missing, malformed, or has
    duplicate/blank QuestionID values.
    """
    file_path = _subject_file_path(subject)

    if not os.path.exists(file_path):
        raise QuestionBankError(f"No question bank file found for '{subject}'.")

    df = pd.read_excel(file_path, engine="openpyxl", dtype={"QuestionID": str})
    _validate_columns(df, subject)

    # NaN -> None so downstream code sees real nulls, not a stray float nan.
    # astype(object) first is required — otherwise pandas silently casts
    # None back to NaN on numeric-looking columns during .where().
    df = df.astype(object).where(pd.notnull(df), None)

    rows = df.to_dict(orient="records")
    _validate_question_ids(rows, subject)

    return rows
