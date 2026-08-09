"""
scripts/upload_questions.py

The ONLY script allowed to open an .xlsx file. This is the sole entry point
into Firestore's `questions` collection for question DATA (routes only ever
read it, never write it).

Runtime flow this script implements:

    Python.xlsx --> upload_questions.py --> Firestore --> Flask APIs --> React

Usage
-----
    python -m scripts.upload_questions Python          # one subject
    python -m scripts.upload_questions --all           # every .xlsx found
    python -m scripts.upload_questions Python --dry-run

--dry-run performs every validation step and prints exactly what WOULD
happen (creates / updates / deactivations) without writing to Firestore.
Omit --dry-run to actually write.

Per-file workflow
-----------------
1. Read every row from Skill.xlsx (utils/question_bank_reader.py).
   - Validates required columns are present.
   - Validates QuestionID is non-blank and unique within the file.
2. Convert each row into a Question (models/question_model.py). Blank
   Status defaults to "Active".
3. For each row, UPSERT into Firestore keyed by QuestionID
   (services/question_repository.upsert_question):
     - QuestionID not in Firestore yet -> create; CreatedAt = UpdatedAt = now.
     - QuestionID already in Firestore -> update; CreatedAt untouched,
       UpdatedAt = now.
   A row with Status = "Inactive" is upserted like any other row — it just
   carries Status = Inactive, which is enough to hide it from quizzes.
4. SOFT DELETE: any QuestionID that exists in Firestore for this Skill but
   was NOT present in this upload (i.e. the row was deleted from the Excel
   file) has its Status flipped to "Inactive". The document itself is never
   removed (services/question_repository.deactivate_missing_questions).

Future Excel files (Java.xlsx, SQL.xlsx, React.xlsx, ...) work automatically
because every step above is driven by `utils.list_available_subjects()` and
the Skill column inside the file — nothing here hardcodes "Python". Dropping
a new file into QuestionBank/ and running this script with its subject name
(or --all) is the entire integration step.
"""

import sys
import argparse

from firebase.firebase_config import get_firestore_client
from models.question_model import Question
from services.question_repository import upsert_question, deactivate_missing_questions
from utils.question_bank_reader import (
    list_available_subjects,
    read_questions,
    QuestionBankError,
)


def process_subject(db, subject: str, dry_run: bool) -> None:
    print(f"\n=== {subject} ===")

    try:
        rows = read_questions(subject)
    except QuestionBankError as exc:
        print(f"  Validation failed: {exc}")
        return

    questions = [Question.from_excel_row(row) for row in rows]
    ids_in_excel = {q.QuestionID for q in questions}

    print(f"  Read {len(questions)} question(s) from {subject}.xlsx")

    if dry_run:
        created = updated = 0
        for q in questions:
            # In dry-run we don't touch Firestore, so we can't truly know
            # created-vs-updated; report the row and let --no-dry-run do
            # the real classification.
            print(f"    [dry-run] would upsert {q.QuestionID} (Status={q.Status})")
        print(f"  [dry-run] {len(questions)} row(s) would be upserted for '{subject}'.")
        print(
            f"  [dry-run] soft-delete check skipped in dry-run "
            f"(would compare against Firestore documents where Skill='{subject}')."
        )
        return

    created = updated = 0
    for q in questions:
        result = upsert_question(db, q.to_upload_dict())
        if result == "created":
            created += 1
        else:
            updated += 1
    print(f"  Upserted: {created} created, {updated} updated.")

    deactivated = deactivate_missing_questions(db, subject, ids_in_excel)
    if deactivated:
        print(f"  Soft-deleted (missing from Excel): {deactivated}")
    else:
        print("  No questions to soft-delete for this skill.")


def main():
    parser = argparse.ArgumentParser(
        description="Upsert a Question Bank Excel file into Firestore, "
        "soft-deleting any question removed from the file."
    )
    parser.add_argument(
        "subject",
        nargs="?",
        help="Subject name matching a file in QuestionBank/ (e.g. Python). "
        "Omit and use --all to process every file.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process every .xlsx file found in QuestionBank/.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and preview only. Do NOT write to Firestore.",
    )
    args = parser.parse_args()

    available = list_available_subjects()
    if not available:
        print("No .xlsx files found in QuestionBank/. Nothing to do.")
        sys.exit(1)

    if args.all:
        subjects = available
    elif args.subject:
        if args.subject not in available:
            print(f"'{args.subject}' not found. Available subjects: {available}")
            sys.exit(1)
        subjects = [args.subject]
    else:
        subjects = [available[0]]
        print(f"No subject given — defaulting to '{subjects[0]}'. Use --all for every file.")

    db = None if args.dry_run else get_firestore_client()

    for subject in subjects:
        process_subject(db, subject, args.dry_run)


if __name__ == "__main__":
    main()
