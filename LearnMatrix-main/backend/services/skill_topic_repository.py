"""
services/skill_topic_repository.py

The ONLY module that touches the `skill_topics` Firestore collection.
Same dependency-injection pattern as services/question_repository.py:
every function takes `db` as a parameter, so both the Flask app and
scripts/upload_skill_topics.py share this module without either one
hardcoding how the client is obtained.

Firestore document layout:

    skill_topics/{TopicID}
        TopicID, Skill, Title, Order, Description, Difficulty,
        EstimatedMinutes, PrerequisiteTopicIds, Status,
        CreatedAt, UpdatedAt

Read path is used by services/skill_topic_service.py (Flask API,
runtime). Write path is used by scripts/upload_skill_topics.py (seed
import) — same "script writes, service reads" separation as questions.
"""

from firebase_admin import firestore

from config.settings import settings

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP


def _collection(db):
    return db.collection(settings.SKILL_TOPICS_COLLECTION)


# ---------------------------------------------------------------------------
# Read path
# ---------------------------------------------------------------------------


def list_topics_for_skill(db, skill: str) -> list[dict]:
    """
    Every Active topic for one skill, sorted by Order — the sequence a
    learner walks through when nothing is compressed yet. Compression
    (marking early topics Verified based on assessment score) is applied
    on top of this list by the caller, not here — this function only
    ever returns the raw, uncompressed syllabus.
    """
    docs = (
        _collection(db)
        .where("Skill", "==", skill)
        .where("Status", "==", settings.STATUS_ACTIVE)
        .stream()
    )
    topics = [doc.to_dict() for doc in docs]
    topics.sort(key=lambda t: t.get("Order", 0))
    return topics


def list_topics_for_skills(db, skills: list[str]) -> dict[str, list[dict]]:
    """Same as list_topics_for_skill but batched for a whole role's skill
    list, keyed by skill name — avoids N separate calls from the route
    layer when rendering a full role syllabus."""
    return {skill: list_topics_for_skill(db, skill) for skill in skills}


# ---------------------------------------------------------------------------
# Write path — used by scripts/upload_skill_topics.py
# ---------------------------------------------------------------------------


def upsert_topic(db, topic_data: dict) -> str:
    """
    Insert or update one topic, keyed by TopicID. Returns "created" or
    "updated" — same contract as question_repository.upsert_question().
    """
    doc_ref = _collection(db).document(topic_data["TopicID"])
    existing = doc_ref.get()

    payload = dict(topic_data)
    payload["UpdatedAt"] = SERVER_TIMESTAMP
    if not existing.exists:
        payload["CreatedAt"] = SERVER_TIMESTAMP
        doc_ref.set(payload)
        return "created"

    doc_ref.set(payload, merge=True)
    return "updated"


def deactivate_missing_topics(db, skill: str, topic_ids_in_seed: set[str]) -> list[str]:
    """
    Soft-delete: any topic that exists in Firestore for this Skill but is
    NOT in the current seed data has its Status flipped to Inactive.
    Mirrors question_repository.deactivate_missing_questions() — the
    document itself is never removed, so no learner_topic_progress
    reference is ever left dangling.
    """
    docs = _collection(db).where("Skill", "==", skill).stream()
    deactivated = []
    for doc in docs:
        data = doc.to_dict()
        if data.get("TopicID") not in topic_ids_in_seed and data.get("Status") == settings.STATUS_ACTIVE:
            doc.reference.update({"Status": settings.STATUS_INACTIVE, "UpdatedAt": SERVER_TIMESTAMP})
            deactivated.append(data.get("TopicID"))
    return deactivated
