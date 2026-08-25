"""
services/generated_content_service.py

Thin orchestration layer for the Admin Panel's "Generated Content
Management" section — same role relative to services/notes_repository.py
as services/resource_review_service.py plays for
services/resource_repository.py: routes call this, not the repository
directly, so the get_firestore_client() wiring lives in one place.

This is NOT a second content system. It manages exactly the same
`learning_notes` cache that services/learning_content_service.py already
reads/writes on every student topic-page load (cache hit -> reuse,
skip generation entirely; cache miss -> generate once, save, reuse from
then on). Deleting an entry here doesn't touch resources (Articles,
Cheat Sheets, Documentation, GitHub links, videos) — those are a
separate, manually-curated collection (services/resource_repository.py)
and are managed from Resource Management instead.
"""

from firebase.firebase_config import get_firestore_client
from services.notes_repository import list_all_notes, get_notes_by_id, delete_notes


class GeneratedContentError(Exception):
    pass


def list_generated_content(skill: str | None = None, topic: str | None = None) -> list[dict]:
    db = get_firestore_client()
    items = list_all_notes(db, skill=skill, topic=topic)
    # Newest first — the admin cares most about what's recently been
    # (re)generated, e.g. right after deleting a stale entry.
    items.sort(key=lambda n: n.get("generatedAt") or 0, reverse=True)
    return items


def get_generated_content(doc_id: str) -> dict:
    db = get_firestore_client()
    item = get_notes_by_id(db, doc_id)
    if item is None:
        raise GeneratedContentError(f"No generated content found for id '{doc_id}'.")
    return item


def delete_generated_content(doc_id: str) -> None:
    db = get_firestore_client()
    if get_notes_by_id(db, doc_id) is None:
        raise GeneratedContentError(f"No generated content found for id '{doc_id}'.")
    delete_notes(db, doc_id)
