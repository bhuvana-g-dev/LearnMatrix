"""
services/answer_equivalence_service.py

Grades a typed answer (FillBlank / CodeCompletion questions) against the
stored CorrectAnswer. Unlike MCQ, a typed answer can be correct without
being byte-identical — "def foo():" vs "def foo() :", "4" vs "four",
extra semicolons/whitespace — so a plain `==` (which is all MCQ grading
needs) would mark genuinely correct answers wrong.

Two tiers, cheapest first:
  1. Normalized string match (strip/lowercase/collapse whitespace/drop
     trailing punctuation) — catches the vast majority of "same answer,
     different formatting" cases with zero API calls.
  2. Only if tier 1 doesn't match: ONE Gemini call asking whether the
     two answers are logically/functionally equivalent for this specific
     question. This is the expensive path, so it's the fallback, not the
     default — most typed answers should resolve at tier 1.

A grading-service failure (network error, malformed AI response, etc.)
must never crash the assessment result the student is waiting on — see
is_equivalent()'s except clause. Worst case, an answer that WAS correct
gets marked wrong here; that's a bounded, honest failure mode, not a
crashed evaluation.
"""

import re

from utils.gemini_client import generate_json

_TRAILING_PUNCT_RE = re.compile(r"[;.,:\s]+$")
_WHITESPACE_RE = re.compile(r"\s+")
# Removes whitespace immediately touching common code/punctuation
# characters (but NOT whitespace between words) — this is what makes
# "def foo() :" normalize the same as "def foo():".
_PUNCT_SPACING_RE = re.compile(r"\s*([:;,(){}\[\].=+\-*/<>!])\s*")


def _normalize(text: str) -> str:
    text = text.strip().lower()
    text = _PUNCT_SPACING_RE.sub(r"\1", text)
    text = _TRAILING_PUNCT_RE.sub("", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    return text


def _normalized_match(correct_answer: str, student_answer: str) -> bool:
    if not student_answer:
        return False
    return _normalize(correct_answer) == _normalize(student_answer)


def _ai_equivalence_check(question: str, correct_answer: str, student_answer: str) -> bool:
    prompt = f"""You are grading ONE short-answer question on a technical
assessment. Decide whether the student's answer is logically/functionally
equivalent to the correct answer — same meaning or same code behavior,
even if the wording, spacing, variable names, or exact syntax differs.
Minor formatting differences (spacing, semicolons, capitalization) do NOT
make an answer wrong. A genuinely different or incorrect answer IS wrong.

Question: {question}
Correct answer: {correct_answer}
Student's answer: {student_answer}

Respond with ONLY this JSON object, no prose, no markdown fences:
{{"equivalent": true}}
or
{{"equivalent": false}}"""

    raw = generate_json(prompt, temperature=0.0)
    if isinstance(raw, dict) and isinstance(raw.get("equivalent"), bool):
        return raw["equivalent"]
    raise ValueError(f"Unexpected AI grading response shape: {raw!r}")


def is_equivalent(question: str, correct_answer: str, student_answer: str | None) -> bool:
    """
    True if student_answer should be counted correct for this FillBlank/
    CodeCompletion question. Tries the cheap normalized match first; only
    falls back to an AI call when that doesn't match. Never raises — any
    failure in the AI fallback degrades to "not equivalent" rather than
    crashing the caller's evaluation.
    """
    if not student_answer:
        return False
    if not correct_answer:
        return False

    if _normalized_match(correct_answer, student_answer):
        return True

    try:
        return _ai_equivalence_check(question, correct_answer, student_answer)
    except Exception:  # noqa: BLE001 — grading must never crash the result
        return False
