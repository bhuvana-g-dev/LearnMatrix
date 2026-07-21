"""
services/resource_repository.py

The ONLY module that touches the `learning_resources` Firestore
collection. Same pattern as every other repository in this codebase.

Deliberately SMALL and manually curated (admin-managed, same workflow as
the existing Question Bank) — unlike learning_notes, these are real
external URLs (official documentation, GitHub repos), and an LLM cannot
reliably generate real, working links (see agents/notes_generation_agent.py
docstring for why). A handful of entries per topic, shared by every
student, is the intended scale here — not one entry per student.

    learning_resources/{resourceId}
        skill, topic, type ("documentation" | "github"), title, url,
        addedAt
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def add_resource(db, skill: str, topic: str, resource_type: str, title: str, url: str) -> dict:
    doc_ref = db.collection(settings.LEARNING_RESOURCES_COLLECTION).document()
    payload = {
        "skill": skill,
        "topic": topic,
        "type": resource_type,
        "title": title,
        "url": url,
        "addedAt": SERVER_TIMESTAMP,
    }
    doc_ref.set(payload)
    saved = doc_ref.get().to_dict()
    saved["id"] = doc_ref.id
    return saved


def list_resources(db, skill: str | None = None, topic: str | None = None) -> list[dict]:
    """
    Equality-filtered list, matching the same simple-filter pattern as
    question_repository.py — Firestore composite queries would need
    manual index creation for more than this, and this collection is
    small enough that Python-side filtering isn't a performance concern.
    """
    query = db.collection(settings.LEARNING_RESOURCES_COLLECTION)
    docs = query.stream()

    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        if skill and data.get("skill") != skill:
            continue
        if topic and data.get("topic") != topic:
            continue
        results.append(data)
    return results


def delete_resource(db, resource_id: str) -> None:
    db.collection(settings.LEARNING_RESOURCES_COLLECTION).document(resource_id).delete()
