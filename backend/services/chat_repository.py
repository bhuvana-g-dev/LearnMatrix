"""
services/chat_repository.py

The ONLY module that touches the `ai_chat_history` Firestore tree. Same
dependency-injection pattern (db passed in, never fetched here) as
notes_repository.py / activity_repository.py.

    ai_chat_history/{uid}/sessions/{sessionId}
        title, messages: [{role, content, ts}], createdAt, updatedAt

Each user can have many SESSIONS (separate conversations, like ChatGPT's
sidebar) rather than one continuous thread — this is a subcollection
under the user's doc, same shape as chat_sources/{uid}/sources.

Uses ArrayUnion (like activity_repository.py) so a retried/duplicate
write never corrupts message ordering — each message dict carries its
own timestamp, so two real messages are never identical even if the
text repeats.
"""

from firebase_admin import firestore

from config.settings import settings

ArrayUnion = firestore.ArrayUnion
SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _sessions_ref(db, uid: str):
    return db.collection(settings.CHAT_HISTORY_COLLECTION).document(uid).collection("sessions")


def create_session(db, uid: str, title: str) -> str:
    """A session is created once, on the FIRST message of a new
    conversation (see services/ai_chat_service.py) — there's no empty
    "New Chat" document sitting in Firestore until the student actually
    sends something."""
    doc_ref = _sessions_ref(db, uid).document()
    doc_ref.set(
        {"title": title, "messages": [], "createdAt": SERVER_TIMESTAMP, "updatedAt": SERVER_TIMESTAMP}
    )
    return doc_ref.id


def get_session_messages(db, uid: str, session_id: str, limit: int) -> list[dict]:
    """Returns [] if the session doesn't exist (e.g. stale/deleted id
    from the frontend) rather than raising — the caller treats that the
    same as a brand-new conversation. `limit` slices from the END (most
    recent); 0/None returns everything."""
    snap = _sessions_ref(db, uid).document(session_id).get()
    if not snap.exists:
        return []
    messages = snap.to_dict().get("messages", [])
    return messages[-limit:] if limit else messages


def append_turn(db, uid: str, session_id: str, user_message: dict, assistant_message: dict) -> None:
    """Appends both sides of one exchange in a single write so a session
    is never left with a dangling user message and no reply (e.g. if
    the process died mid-request). Also bumps updatedAt so
    list_sessions can sort by most-recently-active."""
    _sessions_ref(db, uid).document(session_id).set(
        {"messages": ArrayUnion([user_message, assistant_message]), "updatedAt": SERVER_TIMESTAMP},
        merge=True,
    )


def list_sessions(db, uid: str) -> list[dict]:
    """Metadata only (title, message count, updatedAt) — NOT the full
    message arrays, which would be wasteful to load just to render a
    sidebar list. Most-recently-active first."""
    docs = _sessions_ref(db, uid).order_by("updatedAt", direction=firestore.Query.DESCENDING).stream()
    result = []
    for doc in docs:
        data = doc.to_dict()
        result.append(
            {
                "id": doc.id,
                "title": data.get("title", "New chat"),
                "messageCount": len(data.get("messages", [])),
            }
        )
    return result


def delete_session(db, uid: str, session_id: str) -> None:
    _sessions_ref(db, uid).document(session_id).delete()


def delete_all_sessions(db, uid: str) -> None:
    """Wipes every session this user has, INCLUDING each session's
    studio subcollection (ai_chat_history/{uid}/sessions/{sessionId}/
    studio/{artifactId} — see services/studio_repository.py), which
    delete_session() above never touched. Part of the admin
    "permanently delete this student" flow (see
    services/user_deletion_service.py) — the parent
    ai_chat_history/{uid} doc itself doesn't need a separate delete
    since it never holds fields of its own, only this subcollection."""
    batch = db.batch()
    count = 0

    def _flush():
        nonlocal batch, count
        if count:
            batch.commit()
            batch = db.batch()
            count = 0

    for session_doc in _sessions_ref(db, uid).stream():
        for artifact_doc in session_doc.reference.collection("studio").stream():
            batch.delete(artifact_doc.reference)
            count += 1
            if count >= 400:  # stay under Firestore's 500-write batch limit
                _flush()
        batch.delete(session_doc.reference)
        count += 1
        if count >= 400:
            _flush()

    _flush()
