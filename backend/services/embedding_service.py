"""
services/embedding_service.py

The RAG core: turns a source (an uploaded file's text, or an existing
AI-generated learning_notes entry) into embedded chunks
(chat_source_repository.add_chunks), and turns a student's live
question into the top-K most relevant chunks across all their sources.

No vector database — at this project's scale (one student's own
uploaded documents + notes, at most a few hundred chunks) an in-memory
cosine similarity pass over everything is simpler, has zero extra
infra, and is fast enough. A vector DB (Pinecone/pgvector/etc.) would
be the right call once this needs to scale past a single user's corpus
— not before.
"""

import math

from config.settings import settings
from services import chat_source_repository
from services import notes_repository
from utils.gemini_client import generate_embedding, GeminiClientError
from utils.text_chunker import chunk_text
from utils.youtube_source_extractor import fetch_youtube_source, YoutubeExtractionError


class EmbeddingServiceError(Exception):
    pass


def index_uploaded_text(db, uid: str, title: str, raw_text: str) -> dict:
    """Chunks + embeds an uploaded document's extracted text, saves it
    as a new source, and returns {sourceId, title, chunkCount}."""
    return _index_text(db, uid, title, raw_text, source_type="upload")


def index_learning_notes(db, uid: str, skill: str, topic: str, focus_band: str) -> dict:
    """Pulls an already-generated notes entry (services/notes_repository.py
    — the SAME cache the Learning Hub's topic pages read from) and adds
    it as a chat source, so the student can ask questions grounded in
    notes they've already studied, without re-uploading anything.
    Raises EmbeddingServiceError if no notes exist yet for that
    (skill, topic, focus_band) — the caller should tell the student to
    open that topic's Learning Hub page first so it gets generated."""
    notes = notes_repository.get_cached_notes(db, skill, topic, focus_band)
    if not notes:
        raise EmbeddingServiceError(
            f"No study notes found yet for '{skill} / {topic}' ({focus_band}). "
            "Open that topic in the Learning Hub first to generate them."
        )

    parts = [notes.get("title", ""), notes.get("summary", "")]
    for section in notes.get("sections", []):
        parts.append(f"{section.get('heading', '')}: {section.get('content', '')}")
    parts.extend(notes.get("keyTakeaways", []))
    text = "\n".join(p for p in parts if p)

    title = f"{skill} / {topic} notes ({focus_band})"
    return _index_text(db, uid, title, text, source_type="notes")


def index_pasted_text(db, uid: str, raw_text: str, title: str | None = None) -> dict:
    """Adds raw pasted text (copy-pasted notes, an article body, etc.)
    directly as a chat source — no file upload or URL involved, same
    idea as NotebookLM's "Copied text" source option. Title defaults to
    a short preview of the text itself when not given."""
    title = (title or "").strip() or (raw_text.strip()[:60] or "Pasted text")
    return _index_text(db, uid, title, raw_text, source_type="text")


def index_youtube_source(db, uid: str, url: str) -> dict:
    """Pulls a YouTube video's transcript (utils/youtube_source_extractor.py
    — auto-generated captions work fine) and adds it as a chat source,
    NotebookLM-style, so the student can chat/Mind Map/Audio
    Overview/Slide Deck/Flashcards off a lecture video the same way
    they can off an uploaded PDF. Raises YoutubeExtractionError (via
    SourceError in ai_chat_service.py) if the link is invalid or the
    video has no transcript available."""
    video = fetch_youtube_source(url)
    return _index_text(db, uid, video["title"], video["text"], source_type="youtube")


def _index_text(db, uid: str, title: str, raw_text: str, source_type: str) -> dict:
    pieces = chunk_text(raw_text, settings.CHAT_CHUNK_SIZE_WORDS, settings.CHAT_CHUNK_OVERLAP_WORDS)
    if not pieces:
        raise EmbeddingServiceError("This source has no text to index.")

    source_id = chat_source_repository.create_source(db, uid, title, source_type)

    chunks = []
    for i, piece in enumerate(pieces):
        try:
            embedding = generate_embedding(piece)
        except GeminiClientError as exc:
            raise EmbeddingServiceError(f"Embedding failed on chunk {i + 1}/{len(pieces)}: {exc}") from exc
        chunks.append({"text": piece, "embedding": embedding, "chunkIndex": i})

    chat_source_repository.add_chunks(db, uid, source_id, chunks)
    return {"sourceId": source_id, "title": title, "chunkCount": len(chunks)}


def get_sources_with_text(db, uid: str, max_chars_per_source: int = 4000) -> list[dict]:
    """Returns [{sourceId, title, text}] — each source's chunks rejoined
    in original order (by chunkIndex) into one readable block, with
    embeddings stripped out entirely (Mind Map/Audio Overview only need
    the text, and a 768-float vector per chunk would be wasted payload
    over the wire). Used by routes/ai_chat_routes.py's
    /sources/content endpoint, which frontend Studio features read
    instead of the fixed roadmap-topic notes — see
    AIStudyAssistantScreen.jsx's Mind Map / Audio Overview handlers."""
    all_chunks = chat_source_repository.get_all_chunks(db, uid)
    by_source: dict[str, dict] = {}
    for chunk in all_chunks:
        sid = chunk["sourceId"]
        if sid not in by_source:
            by_source[sid] = {"sourceId": sid, "title": chunk["sourceTitle"], "chunks": []}
        by_source[sid]["chunks"].append(chunk)

    result = []
    for entry in by_source.values():
        ordered = sorted(entry["chunks"], key=lambda c: c.get("chunkIndex", 0))
        text = " ".join(c["text"] for c in ordered)[:max_chars_per_source]
        result.append({"sourceId": entry["sourceId"], "title": entry["title"], "text": text})
    return result


def retrieve_relevant_chunks(db, uid: str, question: str, top_k: int | None = None) -> list[dict]:
    """Embeds the question, scores it against every chunk this user has
    across all their sources, returns the top_k highest-scoring ones.
    Returns [] if the user has no sources yet — a normal state (plain
    conversational chat), not an error."""
    all_chunks = chat_source_repository.get_all_chunks(db, uid)
    if not all_chunks:
        return []

    top_k = top_k or settings.CHAT_RETRIEVAL_TOP_K
    try:
        question_embedding = generate_embedding(question)
    except GeminiClientError:
        # Retrieval is an enhancement, not a hard requirement — if
        # embedding the LIVE question fails (rate limit etc.), fall back
        # to ungrounded chat for this turn rather than failing the
        # whole request.
        return []

    scored = [
        (_cosine_similarity(question_embedding, chunk["embedding"]), chunk)
        for chunk in all_chunks
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)

    return [
        {"text": chunk["text"], "sourceTitle": chunk["sourceTitle"], "sourceId": chunk["sourceId"], "score": score}
        for score, chunk in scored[:top_k]
    ]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
