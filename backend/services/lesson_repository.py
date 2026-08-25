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


def lesson_cache_key(skill: str, topic: str) -> str:
    """Public accessor for this cache's doc ID — used as the
    generation-lock key by services/lesson_service.py."""
    return _doc_id(skill, topic)


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


def list_all_lesson_plans(db, skill: str | None = None, topic: str | None = None) -> list[dict]:
    """Every cached lesson-plan doc — the Admin Panel's Lesson Plan
    Management view of what's currently being served to learners.
    Same optional-equality-filter shape as notes_repository.list_all_notes().
    """
    docs = db.collection(settings.LESSON_PLANS_COLLECTION).stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        if skill and data.get("Skill") != skill:
            continue
        if topic and data.get("Topic") != topic:
            continue
        results.append(data)
    return results


def delete_lesson_plan(db, skill: str, topic: str) -> None:
    """Removes the cached lesson plan for (skill, topic). The next
    learner request for get_lessons(skill, topic) then hits a cache
    miss and regenerates a fresh Lesson list via LessonPlannerAgent,
    same "delete now, regenerate on next read" contract as
    notes_repository.delete_notes(). This is the piece that was
    missing: deleting a topic's cached AI notes (learning_notes, via
    generated_content_routes.py) never touched this lesson_plans doc,
    so the OLD lesson titles kept being served even after the admin
    deleted the underlying generated content."""
    db.collection(settings.LESSON_PLANS_COLLECTION).document(_doc_id(skill, topic)).delete()
