"""
services/studio_repository.py

The ONLY module that touches the per-session `studio` Firestore
subcollection. Same dependency-injection pattern (db passed in, never
fetched here) as chat_repository.py, which this sits alongside:

    ai_chat_history/{uid}/sessions/{sessionId}/studio/{artifactId}
        type: "mindmap" | "slidedeck"
        title, content (the exact JSON MindMapAgent/SlideDeckAgent
        produced — MindMapView / SlideDeckPreview render this directly,
        no reshaping), createdAt

This is what lets a student reopen a Mind Map or Slide Deck they
already generated earlier in a conversation (like NotebookLM's Studio
panel) instead of losing it the moment the modal closes and having to
regenerate — same content, same LLM cost paid once.

Deliberately scoped to a chat SESSION, not the whole user — an
artifact was generated in the context of one conversation (Sources at
the time, or a typed prompt discussed there), so it belongs listed
under that session the same way its messages do, rather than in one
undifferentiated pile across every chat the student has ever had.
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _studio_ref(db, uid: str, session_id: str):
    return (
        db.collection(settings.CHAT_HISTORY_COLLECTION)
        .document(uid)
        .collection("sessions")
        .document(session_id)
        .collection("studio")
    )


def save_artifact(db, uid: str, session_id: str, artifact_type: str, title: str, content: dict) -> str:
    doc_ref = _studio_ref(db, uid, session_id).document()
    doc_ref.set(
        {
            "type": artifact_type,
            "title": title,
            "content": content,
            "createdAt": SERVER_TIMESTAMP,
        }
    )
    return doc_ref.id


def list_artifacts(db, uid: str, session_id: str) -> list[dict]:
    """Metadata only (id, type, title, createdAt) — NOT the full
    content, which would be wasteful to load just to render a list of
    cards. Most-recently-created first."""
    docs = _studio_ref(db, uid, session_id).order_by("createdAt", direction=firestore.Query.DESCENDING).stream()
    result = []
    for doc in docs:
        data = doc.to_dict()
        result.append(
            {
                "id": doc.id,
                "type": data.get("type"),
                "title": data.get("title", "Untitled"),
                "createdAt": data.get("createdAt").isoformat() if data.get("createdAt") else None,
            }
        )
    return result


def get_artifact(db, uid: str, session_id: str, artifact_id: str) -> dict | None:
    """Returns None if the artifact doesn't exist (e.g. stale id, or
    it belongs to a different session/user) rather than raising — the
    caller treats that as a 404."""
    snap = _studio_ref(db, uid, session_id).document(artifact_id).get()
    if not snap.exists:
        return None
    return snap.to_dict()
