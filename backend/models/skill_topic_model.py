"""
models/skill_topic_model.py

Canonical shape of a SkillTopic — one node in a skill's syllabus tree.
Mirrors the Firestore document structure exactly:

    skill_topics/{TopicID}
        TopicID, Skill, Title, Order, Description, Difficulty,
        EstimatedMinutes, PrerequisiteTopicIds, Status,
        CreatedAt, UpdatedAt

TopicID is a permanent, human-assigned key (e.g. "html5-headings"),
same philosophy as QuestionID in models/question_model.py — it becomes
the Firestore document ID and must never change once assigned, since
learner_topic_progress documents (not yet built) will reference it.

Order is the position of this topic WITHIN its skill (1-indexed) — the
sequence a learner walks through when nothing is compressed yet.
PrerequisiteTopicIds lets a topic depend on more than just "the one
before it" (e.g. "Fetch API" can require both "Objects" and "Promises"),
which is what the Compression Engine (services/skill_topic_service.py)
will need once it decides what's safe to mark Verified.

CreatedAt/UpdatedAt follow the same rule as Question: never set by
from_seed(), only injected by services/skill_topic_repository.py at
upsert time.
"""

from dataclasses import dataclass, asdict, field
from typing import Optional

from config.settings import settings


@dataclass
class SkillTopic:
    TopicID: str
    Skill: str
    Title: str
    Order: int
    Description: str
    Difficulty: str
    EstimatedMinutes: int
    PrerequisiteTopicIds: list[str] = field(default_factory=list)
    Status: str = settings.STATUS_ACTIVE

    # Server-managed. None until services/skill_topic_repository.py sets them.
    CreatedAt: Optional[object] = field(default=None)
    UpdatedAt: Optional[object] = field(default=None)

    @staticmethod
    def from_seed(row: dict) -> "SkillTopic":
        """
        Build a SkillTopic from one entry of data/skill_syllabus_seed.py.
        Seed entries never carry Status/CreatedAt/UpdatedAt — those are
        repository-owned, same separation as Question.from_excel_row().
        """
        return SkillTopic(
            TopicID=row["TopicID"],
            Skill=row["Skill"],
            Title=row["Title"],
            Order=row["Order"],
            Description=row["Description"],
            Difficulty=row["Difficulty"],
            EstimatedMinutes=row["EstimatedMinutes"],
            PrerequisiteTopicIds=row.get("PrerequisiteTopicIds", []),
            Status=settings.STATUS_ACTIVE,
        )

    def to_upload_dict(self) -> dict:
        """Fields sourced from the seed, WITHOUT CreatedAt/UpdatedAt — the
        repository layer adds those depending on insert-vs-update."""
        data = asdict(self)
        data.pop("CreatedAt", None)
        data.pop("UpdatedAt", None)
        return data

    def to_dict(self) -> dict:
        return asdict(self)
