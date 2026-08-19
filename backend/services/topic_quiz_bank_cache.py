"""
services/topic_quiz_bank_cache.py

Fixes "leave the quiz page before submitting and reopening it burns
another Gemini call" WITHOUT losing per-student differentiation or
spaced-repetition re-testing. Keyed by (uid, skill, topic) — NOT
(skill, topic) alone:

  - Same student, same topic, hasn't submitted yet, comes back
    (refresh, accidental close, browser crash) -> gets back the EXACT
    SAME quiz, no new Gemini call. This is the actual bug being fixed.
  - Different students, same topic -> different quizzes. A shared
    per-topic cache would mean every student sees identical questions,
    which breaks the Fast/Moderate/Slow differentiation this whole
    system exists for — deliberately NOT done that way.
  - Same student, SAME topic, but taking it again after a revision
    cycle (Objective 4 — they already submitted once and it's now
    NextReviewDate) -> a FRESH quiz, not a replay of what they already
    answered. See services/topic_quiz_service.py's submit_topic_quiz(),
    which calls delete_cached_quiz() right after recording the
    attempt — that's what makes the NEXT open regenerate instead of
    replaying stale answers.

    topic_quiz_bank_cache/{uid}__{skill}__{topic}  (skill/topic slugified)
        uid, skill, topic, questions: [...], source, cachedAt
"""

import hashlib
import re

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _slugify(value: str) -> str:
    """Same collision-resistant slugify as services/notes_repository.py
    (see that module's docstring) — kept identical here rather than
    imported so this repository has zero dependency on another
    repository module, matching the existing "one file per collection"
    convention. Deterministic md5-based marker, NOT Python's hash()
    (which is randomized per-process and would break cache lookups
    across workers)."""
    value = value.strip().lower()

    def _mark(match: "re.Match") -> str:
        chunk = match.group(0)
        if chunk.isspace():
            return "-"
        digest = hashlib.md5(chunk.encode("utf-8")).hexdigest()[:3]
        return f"-x{digest}-"

    slug = re.sub(r"[^a-z0-9]+", _mark, value)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def quiz_cache_key(uid: str, skill: str, topic: str) -> str:
    """Public accessor for this cache's doc ID — used as the
    generation-lock key by services/topic_quiz_service.py."""
    return f"{uid}__{_slugify(skill)}__{_slugify(topic)}"


def _doc_ref(db, uid: str, skill: str, topic: str):
    doc_id = quiz_cache_key(uid, skill, topic)
    return db.collection(settings.TOPIC_QUIZ_BANK_CACHE_COLLECTION).document(doc_id)


def get_cached_quiz(db, uid: str, skill: str, topic: str) -> dict | None:
    """None = this student has no in-progress (unsubmitted) quiz cached
    for this topic right now — either they've never opened it, or they
    already submitted last time (which deletes the cache, see module
    docstring), so it's time to generate a fresh one."""
    snap = _doc_ref(db, uid, skill, topic).get()
    if not snap.exists:
        return None
    data = snap.to_dict()
    return {"questions": data.get("questions", []), "source": data.get("source", "cached")}


def save_quiz(db, uid: str, skill: str, topic: str, questions: list[dict], source: str) -> None:
    _doc_ref(db, uid, skill, topic).set({
        "uid": uid,
        "skill": skill,
        "topic": topic,
        "questions": questions,
        "source": source,
        "cachedAt": SERVER_TIMESTAMP,
    })


def delete_cached_quiz(db, uid: str, skill: str, topic: str) -> None:
    """Called right after a submitted attempt is recorded — clears this
    student's cache for this topic so their NEXT open (their next
    revision cycle) generates a fresh quiz instead of replaying the one
    they already answered."""
    _doc_ref(db, uid, skill, topic).delete()
