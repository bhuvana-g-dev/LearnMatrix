"""
services/lesson_repository.py

The ONLY module touching lesson_plans. Same cache-repository shape as
services/notes_repository.py — one doc per (skill, topic), written once
by services/lesson_service.py on a cache miss, read every other time.
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _doc_id(skill: str, topic: str) -> str:
    return f"{skill}__{topic}"


def get_cached_lesson_plan(db, skill: str, topic: str) -> list[dict] | None:
    snap = db.collection(settings.LESSON_PLANS_COLLECTION).document(_doc_id(skill, topic)).get()
    if not snap.exists:
        return None
    return snap.to_dict().get("Lessons", [])


def save_lesson_plan(db, skill: str, topic: str, lessons: list[dict]) -> list[dict]:
    doc_ref = db.collection(settings.LESSON_PLANS_COLLECTION).document(_doc_id(skill, topic))
    doc_ref.set({
        "Skill": skill,
        "Topic": topic,
        "Lessons": lessons,
        "CreatedAt": SERVER_TIMESTAMP,
        "UpdatedAt": SERVER_TIMESTAMP,
    })
    return lessons
