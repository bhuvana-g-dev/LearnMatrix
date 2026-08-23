"""
services/ai_chat_service.py

Orchestration layer for the AI Study Assistant chat screen. Routes call
these functions; nothing here touches Flask, and nothing in
agents/chat_agent.py or services/chat_repository.py knows about the
other — this module is what wires them together, same separation as
services/learning_content_service.py does for notes generation + the
resource repository.
"""

from agents.chat_agent import ChatAgent, ChatAgentError
from config.settings import settings
from firebase.firebase_config import get_firestore_client
from services import chat_repository
from services import chat_source_repository
from services import embedding_service
from services.embedding_service import EmbeddingServiceError
from utils.source_text_extractor import extract_text, SourceExtractionError
from utils.youtube_source_extractor import YoutubeExtractionError

AIChatError = ChatAgentError  # re-exported so routes only import from here
# Routes catch this tuple for anything source-upload/indexing related —
# kept separate from AIChatError since a bad PDF, empty upload, or bad
# YouTube link is a different failure class than the Chat Agent itself
# failing.
SourceError = (EmbeddingServiceError, SourceExtractionError, YoutubeExtractionError)


def send_message(uid: str, message: str, session_id: str | None = None, context: dict | None = None) -> dict:
    """
    Loads this session's recent history (creating a new session on the
    FIRST message if session_id wasn't passed — see chat_repository's
    create_session), retrieves relevant chunks from the user's
    uploaded/linked sources (if any), asks the Chat Agent for a
    grounded reply, then persists both sides of the exchange.

    Returns: {"sessionId": str, "reply": str, "suggestions": list[str],
    "citedSources": list[str], "history": list[dict]}
    "sessionId" is always present — the frontend adopts it after the
    first message of a new conversation. "history" is the FULL updated
    transcript (including this new turn), so the frontend can just
    replace its message list with the response.
    """
    db = get_firestore_client()

    if not session_id:
        # Title is a simple truncation of the first message — no LLM
        # call needed just to name a conversation.
        title = message.strip()[:50] or "New chat"
        session_id = chat_repository.create_session(db, uid, title)

    history = chat_repository.get_session_messages(db, uid, session_id, settings.AI_CHAT_MAX_HISTORY_MESSAGES)

    # Retrieval failing (no sources yet, or the embedding call itself
    # failing) just means an ungrounded, plain-chat turn — never a hard
    # error, since the chat is fully usable without any sources at all.
    relevant_chunks = embedding_service.retrieve_relevant_chunks(db, uid, message)

    agent = ChatAgent()
    result = agent.run(message=message, history=history, context=context, sources=relevant_chunks)

    now = firestore_timestamp()
    user_turn = {"role": "user", "content": message, "ts": now}
    assistant_turn = {"role": "assistant", "content": result["reply"], "ts": now}
    chat_repository.append_turn(db, uid, session_id, user_turn, assistant_turn)

    return {
        "sessionId": session_id,
        "reply": result["reply"],
        "suggestions": result.get("suggestions", []),
        "citedSources": result.get("citedSources", []),
        "history": history + [user_turn, assistant_turn],
    }


def list_chat_sessions(uid: str) -> list[dict]:
    """Sidebar list — title + message count per session, most recently
    active first. Used when the AI Study Assistant page mounts."""
    db = get_firestore_client()
    return chat_repository.list_sessions(db, uid)


def load_chat_session(uid: str, session_id: str) -> list[dict]:
    """Full message list for one session, oldest first — used when the
    student clicks a past conversation in the sidebar."""
    db = get_firestore_client()
    return chat_repository.get_session_messages(db, uid, session_id, limit=0)


def delete_chat_session(uid: str, session_id: str) -> None:
    db = get_firestore_client()
    chat_repository.delete_session(db, uid, session_id)


def add_upload_source(uid: str, filename: str, file_stream) -> dict:
    """Extracts text from an uploaded file, chunks + embeds it, and
    saves it as a new source. Returns {sourceId, title, chunkCount}.
    Raises SourceError (EmbeddingServiceError/SourceExtractionError) —
    routes catch this the same way AIChatError is caught elsewhere."""
    db = get_firestore_client()
    text = extract_text(file_stream, filename)
    return embedding_service.index_uploaded_text(db, uid, title=filename, raw_text=text)


def add_notes_source(uid: str, skill: str, topic: str, focus_band: str) -> dict:
    """Adds an already-generated Learning Hub notes entry as a chat
    source. See embedding_service.index_learning_notes for the
    "notes must already exist" precondition."""
    db = get_firestore_client()
    return embedding_service.index_learning_notes(db, uid, skill, topic, focus_band)


def add_text_source(uid: str, text: str, title: str | None = None) -> dict:
    """Adds raw pasted text as a chat source (NotebookLM-style "Copied
    text" option). Returns {sourceId, title, chunkCount}."""
    db = get_firestore_client()
    return embedding_service.index_pasted_text(db, uid, text, title)


def add_youtube_source(uid: str, url: str) -> dict:
    """Adds a YouTube video's transcript as a chat source, NotebookLM-
    style. Returns {sourceId, title, chunkCount}. Raises SourceError
    (YoutubeExtractionError) if the link is invalid or the video has
    no transcript."""
    db = get_firestore_client()
    return embedding_service.index_youtube_source(db, uid, url)


def list_sources(uid: str) -> list[dict]:
    db = get_firestore_client()
    return chat_source_repository.list_sources(db, uid)


def get_sources_content(uid: str) -> list[dict]:
    """[{sourceId, title, text}] for every source this user has — used by
    Mind Map / Audio Overview when the student has uploaded sources,
    instead of falling back to a fixed roadmap topic's notes."""
    db = get_firestore_client()
    return embedding_service.get_sources_with_text(db, uid)


def delete_source(uid: str, source_id: str) -> None:
    db = get_firestore_client()
    chat_source_repository.delete_source(db, uid, source_id)


def firestore_timestamp() -> str:
    """Client-visible ISO string, NOT firestore.SERVER_TIMESTAMP — that
    sentinel can't live inside an ArrayUnion element (Firestore only
    resolves it for top-level/map fields), so a plain timestamp computed
    here is the correct choice for chat_repository's array-of-messages
    shape, not an oversight."""
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
