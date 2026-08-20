"""
services/topic_quiz_bank_cache.py

Quiz questions are cached per (skill, topic, focusBand) — generated
ONCE by TopicQuizAgent for a given category, then reused by EVERY
student who lands on that skill/topic/category after that, forever.
Never regenerated per-student and never regenerated on a revision
retake — same "cache-check-then-generate, never call AI twice for the
same key" pattern as services/notes_repository.py, mirrored here
deliberately so both caches behave identically.

This exists because a live Gemini/Groq call on every quiz open doesn't
scale — different students land on the same skill/topic/focusBand
constantly, and each one used to trigger its own AI call, which is
exactly what was hitting provider rate limits and failing. Since the
initial assessment already buckets every student into one of four
categories (fundamentals/application/advanced/polish — see
services/focus_band.py), reusing one generated quiz per category is
enough to keep questions relevant to the student's level while
cutting AI calls from "one per student" to "one per category, ever."

Doc ID is a deterministic slug of (skill, topic, focus_band) — a
direct .get() by ID, no query needed:

    topic_quiz_bank_cache/{skill}__{topic}__{focusBand}  (slugified)
        skill, topic, focusBand, questions: [...], source, cachedAt
"""

import re

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return slug.strip("-")


def _doc_ref(db, skill: str, topic: str, focus_band: str):
    doc_id = f"{_slugify(skill)}__{_slugify(topic)}__{_slugify(focus_band)}"
    return db.collection(settings.TOPIC_QUIZ_BANK_CACHE_COLLECTION).document(doc_id)


def get_cached_quiz(db, skill: str, topic: str, focus_band: str) -> dict | None:
    """None = no quiz has ever been generated for this skill/topic/category
    yet — the normal signal to generate once now and save it, not an
    error."""
    snap = _doc_ref(db, skill, topic, focus_band).get()
    if not snap.exists:
        return None
    data = snap.to_dict()
    return {"questions": data.get("questions", []), "source": data.get("source", "cached")}


def save_quiz(db, skill: str, topic: str, focus_band: str, questions: list[dict], source: str) -> None:
    _doc_ref(db, skill, topic, focus_band).set({
        "skill": skill,
        "topic": topic,
        "focusBand": focus_band,
        "questions": questions,
        "source": source,
        "cachedAt": SERVER_TIMESTAMP,
    })
