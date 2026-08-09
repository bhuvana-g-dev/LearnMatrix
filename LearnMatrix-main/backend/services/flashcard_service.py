"""
services/flashcard_service.py

Orchestration for Flashcards. Three generation modes, mirroring the
frontend's mode selector:
  - generate_from_topic: reuses the SAME learning_notes cache the
    Learning Hub topic pages read from (services/notes_repository.py)
  - generate_from_chat: reuses one saved AI Chat SESSION's messages
    (services/chat_repository.py — sessions, not one continuous thread)
  - generate_from_sources: reuses this user's uploaded/linked chat
    sources (services/embedding_service.py)

All three end up calling the same FlashcardAgent — only the source text
and label differ.
"""

from agents.flashcard_agent import FlashcardAgent, FlashcardAgentError
from config.settings import settings
from firebase.firebase_config import get_firestore_client
from services import chat_repository, embedding_service, flashcard_repository, notes_repository

FlashcardServiceError = FlashcardAgentError


def generate_from_topic(uid: str, skill: str, topic: str, focus_band: str, count: int | None = None) -> dict:
    db = get_firestore_client()
    notes = notes_repository.get_cached_notes(db, skill, topic, focus_band)
    if not notes:
        raise FlashcardServiceError(
            f"No study notes found yet for '{skill} / {topic}' ({focus_band}). "
            "Open that topic in the Learning Hub first so notes are generated."
        )

    parts = [notes.get("title", ""), notes.get("summary", "")]
    for section in notes.get("sections", []):
        parts.append(f"{section.get('heading', '')}: {section.get('content', '')}")
    parts.extend(notes.get("keyTakeaways", []))
    text = "\n".join(p for p in parts if p)

    title = f"{skill} / {topic} ({focus_band})"
    return _generate_and_save(db, uid, text, source_label=f"study notes on {skill}/{topic}", title=title,
                               source_type="topic", count=count)


def generate_from_chat(uid: str, session_id: str, count: int | None = None) -> dict:
    if not session_id:
        raise FlashcardServiceError("No chat conversation selected — open or start a chat first.")
    db = get_firestore_client()
    history = chat_repository.get_session_messages(db, uid, session_id, limit=0)
    if not history:
        raise FlashcardServiceError("That conversation has no messages yet — ask the AI Study Assistant something first.")

    transcript = "\n".join(f"{'Student' if m.get('role') == 'user' else 'Assistant'}: {m.get('content', '')}" for m in history)
    title = "Flashcards from AI Chat"
    return _generate_and_save(db, uid, transcript, source_label="a chat conversation", title=title,
                               source_type="chat", count=count)


def generate_from_sources(uid: str, count: int | None = None) -> dict:
    db = get_firestore_client()
    sources_content = embedding_service.get_sources_with_text(db, uid)
    if not sources_content:
        raise FlashcardServiceError("No sources found yet — upload a source first.")

    combined = "\n\n".join(f"[{s['title']}]\n{s['text']}" for s in sources_content)
    title = "Flashcards from Sources"
    return _generate_and_save(db, uid, combined, source_label="the student's uploaded sources", title=title,
                               source_type="sources", count=count)


def generate_from_custom_text(uid: str, text: str, count: int | None = None) -> dict:
    if not text or not text.strip():
        raise FlashcardServiceError("Type something first.")
    db = get_firestore_client()
    title = text.strip().split("\n")[0][:50] or "Flashcards"
    return _generate_and_save(db, uid, text, source_label="the student's own typed notes", title=title,
                               source_type="custom", count=count)


def _generate_and_save(db, uid, text, source_label, title, source_type, count):
    agent = FlashcardAgent()
    result = agent.run(text, source_label, count=count or settings.FLASHCARD_DEFAULT_COUNT)
    cards = result["flashcards"]
    set_id = flashcard_repository.save_set(db, uid, title, source_type, cards)
    return {"setId": set_id, "title": title, "cards": cards}


def list_flashcard_sets(uid: str) -> list[dict]:
    db = get_firestore_client()
    return flashcard_repository.list_sets(db, uid)


def delete_flashcard_set(uid: str, set_id: str) -> None:
    db = get_firestore_client()
    flashcard_repository.delete_set(db, uid, set_id)
