"""
models/topic_quiz_progress_model.py

Canonical shape of a TopicQuizProgress — one learner's revision state
for one topic, mirroring the Firestore document structure exactly:

    topic_quiz_progress/{uid}__{skill}__{topic}
        Uid, Skill, Topic, AttemptCount, LastScorePercent,
        AverageScorePercent, Classification, LastAttemptAt,
        NextReviewDate, CreatedAt, UpdatedAt

Doc ID is a deterministic composite key (not auto-generated) so upserting
"the current state for this uid+skill+topic" is a single known-ID write,
same reasoning as SkillTopic.TopicID — no query-then-write race needed.

Deliberately separate from topic_quiz_attempts (the append-only history
log services/learner_classifier.py trains on) — this doc is mutable and
only ever holds the LATEST state, same split as
services/activity_repository.py (append-only dates) vs a hypothetical
"current streak" doc, except here we actually need both: history for
training, latest-state for the dashboard's due-today query.

FocusBand (this revision): the SAME four-value band
services/focus_band.py computes for a whole skill (fundamentals /
application / advanced / polish), computed here from THIS topic quiz's
own Easy/Medium/Hard breakdown instead of the skill-wide diagnostic.
This is what lets content depth update per-topic as the learner actually
takes topic quizzes, rather than staying fixed at whatever the one-time
diagnostic assessed for the whole skill — see
utils/buildCourseNavigator.js (frontend) for how a topic with recorded
progress overrides the skill-level default.
"""

from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class TopicQuizProgress:
    Uid: str
    Skill: str
    Topic: str
    AttemptCount: int
    LastScorePercent: float
    AverageScorePercent: float
    Classification: str  # "Fast" | "Moderate" | "Slow"
    FocusBand: str  # "fundamentals" | "application" | "advanced" | "polish" — content LEVEL, from Topic Mastery %
    WeakArea: Optional[str]  # "fundamentals" | "application" | "advanced" | None — content EMPHASIS, from this attempt's weakest difficulty tier
    NextReviewDate: str  # "YYYY-MM-DD"

    LastAttemptAt: Optional[object] = None
    CreatedAt: Optional[object] = None
    UpdatedAt: Optional[object] = None

    @staticmethod
    def doc_id(uid: str, skill: str, topic: str) -> str:
        return f"{uid}__{skill}__{topic}"

    def to_dict(self) -> dict:
        return asdict(self)
