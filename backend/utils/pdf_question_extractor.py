"""
utils/pdf_question_extractor.py

*** ADMIN-PANEL IMPORT ONLY. Never imported by student-facing routes/
    services (routes/question_routes.py, services/question_service.py). ***

Mirrors the boundary utils/question_bank_reader.py already draws for Excel:
this module knows how to turn a raw file into row-shaped dicts, and nothing
else. It never touches Firestore — routes/admin_question_routes.py returns
the extracted rows straight to the Admin Panel so a human can review/edit
QuestionID, Skill, Difficulty, etc. before anything is saved via the normal
POST /api/admin/questions endpoint.

Extraction approach
--------------------
Question papers vary too much for a single regex to be reliable, so this
does a best-effort structural parse of a common layout:

    1. What does useState do in React?
    A) Stores component state
    B) Renders JSX
    C) Deletes a component
    D) None of the above
    Answer: A

Each block is split on a leading question-number marker ("1.", "Q1.",
"Q1)", "1)"), then Option A–D lines are pulled out with an "X) / X. / X:"
prefix, and an "Answer:" / "Correct Answer:" line (if present) is mapped to
the matching option letter. Anything that doesn't match this shape is still
returned with whatever fields WERE found — the Admin Panel form is where a
human fills in the gaps, this function never guesses silently.
"""

import re
import pdfplumber

QUESTION_START_RE = re.compile(r"^\s*(?:Q\.?\s*)?(\d{1,3})[).:]\s*(.*)$")
OPTION_RE = re.compile(r"^\s*\(?([A-Da-d])[).:]\s*(.*)$")
ANSWER_RE = re.compile(
    r"^\s*(?:Correct\s*Answer|Answer)\s*[:\-]\s*\(?([A-Da-d])\)?\.?\s*$",
    re.IGNORECASE,
)


class PdfExtractionError(Exception):
    """Raised when the uploaded file can't be read as a PDF at all."""


def _read_pdf_lines(file_stream) -> list[str]:
    lines: list[str] = []
    try:
        with pdfplumber.open(file_stream) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                lines.extend(line.strip() for line in text.split("\n") if line.strip())
    except Exception as exc:  # noqa: BLE001
        raise PdfExtractionError(f"Could not read PDF: {exc}") from exc
    return lines


def _flush_block(block: dict, results: list[dict]) -> None:
    if block.get("Question"):
        results.append(block)


def extract_questions_from_pdf(file_stream) -> list[dict]:
    """
    Parse a PDF into a list of candidate question dicts, each shaped like:
        {
            "Question": str,
            "OptionA": str, "OptionB": str, "OptionC": str, "OptionD": str,
            "CorrectAnswer": str,   # "A" | "B" | "C" | "D" | ""
        }
    Fields the PDF didn't clearly contain are left as "" — QuestionID,
    Skill, Difficulty, QuestionType, and Status are NEVER guessed
    here; the Admin Panel form collects those from the human reviewer.
    """
    lines = _read_pdf_lines(file_stream)

    results: list[dict] = []
    current: dict = {}

    def new_block():
        return {
            "Question": "",
            "OptionA": "",
            "OptionB": "",
            "OptionC": "",
            "OptionD": "",
            "CorrectAnswer": "",
        }

    option_key_by_letter = {"A": "OptionA", "B": "OptionB", "C": "OptionC", "D": "OptionD"}

    for line in lines:
        q_match = QUESTION_START_RE.match(line)
        opt_match = OPTION_RE.match(line)
        ans_match = ANSWER_RE.match(line)

        if q_match and not opt_match:
            # A new numbered question starts — save whatever we were
            # building and start fresh.
            _flush_block(current, results)
            current = new_block()
            current["Question"] = q_match.group(2).strip()
            continue

        if opt_match and current:
            letter = opt_match.group(1).upper()
            current[option_key_by_letter[letter]] = opt_match.group(2).strip()
            continue

        if ans_match and current:
            current["CorrectAnswer"] = ans_match.group(1).upper()
            continue

        if current and current.get("Question") and not any(
            current[k] for k in ("OptionA", "OptionB", "OptionC", "OptionD")
        ):
            # No options captured yet for this block — treat this line as a
            # continuation of a wrapped question line.
            current["Question"] = (current["Question"] + " " + line).strip()

    _flush_block(current, results)
    return results
