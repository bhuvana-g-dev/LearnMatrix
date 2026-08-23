"""
services/chat_source_repository.py

The ONLY module that touches the `chat_sources` Firestore tree. Same
dependency-injection pattern as every other *_repository.py in this
folder (db passed in, never fetched here).

    chat_sources/{uid}/sources/{sourceId}
        title, type ("upload"|"notes"|"youtube"), createdAt
    chat_sources/{uid}/sources/{sourceId}/chunks/{chunkId}
        text, embedding (list[float]), chunkIndex

Two levels (source doc + chunks subcollection) rather than one flat
array, unlike chat_repository.py's single messages array — a source
can have dozens of chunks with a 768-float embedding each, which is far
past what's comfortable inside one Firestore document's 1MB field, and
each chunk needs to be independently scored during retrieval anyway.
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _sources_ref(db, uid: str):
    return db.collection(settings.CHAT_SOURCES_COLLECTION).document(uid).collection("sources")


def create_source(db, uid: str, title: str, source_type: str) -> str:
    """Creates the parent source doc and returns its auto-generated id —
    chunks are added to it afterwards via add_chunks()."""
    doc_ref = _sources_ref(db, uid).document()
    doc_ref.set(
        {"title": title, "type": source_type, "createdAt": SERVER_TIMESTAMP}
    )
    return doc_ref.id


def add_chunks(db, uid: str, source_id: str, chunks: list[dict]) -> None:
    """chunks: [{text, embedding, chunkIndex}, ...]. Uses a batch write
    so a source with many chunks is one round-trip, not N."""
    batch = db.batch()
    chunks_ref = _sources_ref(db, uid).document(source_id).collection("chunks")
    for chunk in chunks:
        batch.set(chunks_ref.document(), chunk)
    batch.commit()


def list_sources(db, uid: str) -> list[dict]:
    """Metadata only (no chunk text/embeddings) — used to render the
    "Sources" panel list, which never needs the raw vectors."""
    docs = _sources_ref(db, uid).order_by("createdAt").stream()
    result = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        result.append(data)
    return result


def get_all_chunks(db, uid: str) -> list[dict]:
    """Every chunk across every source this user has, each tagged with
    its parent source's title/id so retrieval results can cite where
    they came from. Fine to load all of them into memory for
    in-process cosine similarity at this project's scale (a single
    student's own documents, not a multi-tenant corpus)."""
    all_chunks = []
    for source in _sources_ref(db, uid).stream():
        source_data = source.to_dict()
        chunk_docs = _sources_ref(db, uid).document(source.id).collection("chunks").stream()
        for chunk_doc in chunk_docs:
            chunk = chunk_doc.to_dict()
            chunk["sourceId"] = source.id
            chunk["sourceTitle"] = source_data.get("title", "Untitled source")
            all_chunks.append(chunk)
    return all_chunks


def delete_source(db, uid: str, source_id: str) -> None:
    """Deletes the source doc AND its chunks subcollection. Firestore
    doesn't cascade-delete subcollections automatically, so chunks are
    removed explicitly first."""
    source_ref = _sources_ref(db, uid).document(source_id)
    chunk_docs = source_ref.collection("chunks").stream()
    batch = db.batch()
    count = 0
    for chunk_doc in chunk_docs:
        batch.delete(chunk_doc.reference)
        count += 1
        if count >= 400:  # stay under Firestore's 500-write batch limit
            batch.commit()
            batch = db.batch()
            count = 0
    if count:
        batch.commit()
    source_ref.delete()
