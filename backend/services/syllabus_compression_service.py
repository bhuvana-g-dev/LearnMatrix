"""
services/syllabus_compression_service.py

Compression Engine — Phase 2 of the Adaptive Roadmap System.

Responsibility: given ONE skill's ordered topic tree (from
services/skill_topic_service.py) and that skill's diagnostic result
(services/evaluation_service.py's SkillResult), decide which topics are
already covered and which one the learner should actually start on.

    HTML, 95% (Strong)       -> most topics Verified, one Current left
    JavaScript, 48% (Intermediate) -> nothing Verified, start at topic 1
    React, 0% (Not Attempted)      -> nothing Verified, start at topic 1

DESIGN DECISION — compression only rewards "Strong":
Only skills classified "Strong" (score_percent >= 75, same threshold
services/evaluation_service.py already uses) get any topics marked
Verified. A 48%-Intermediate skill still needs the FULL syllabus, not
a partially-skipped one — Intermediate means "got some questions right,
some wrong", not "already knows most of this and just needs a refresher
on the edges", so there's nothing safe to skip yet. This mirrors
services/roadmap_service.py treating anything below Strong as
"needs work" rather than trying to partially credit it — same
philosophy, applied one level deeper (topics instead of skills).

DESIGN DECISION — the final topic in a skill is never pre-Verified:
Every skill's syllabus (data/skill_syllabus_seed.py) ends in a
"Mini/Major Project" topic — the one place mastery is actually
demonstrated by building something, not just answering questions
about it. A diagnostic quiz score, however high, is Not the same
evidence as a finished project, so verified_count is always capped at
(total_topics - 1): the project topic is always at least "Current",
never silently skipped.

Formula (Strong only): verified_count = floor(score_percent/100 *
total_topics), capped at total_topics - 1. E.g. 95% on a 14-topic
skill -> floor(13.3) = 13, capped at 13 -> only the Mini Project (#14)
is left as Current.

The single topic right after the verified block is always "Current"
(what the learner does next). Everything after that is "Locked" until
the Current topic is completed — Phase 3 (learner_topic_progress) is
what will actually flip Locked -> Current as real progress comes in;
this module only computes the STARTING state from a diagnostic score,
same one-time role Roadmap Agent (services/roadmap_service.py) plays
for skills.

Nothing here touches Firestore or an LLM — same rule as
services/roadmap_service.py and for the same reason: "how much of this
skill can we skip" is a deterministic function of a score plus a fixed
topic count, not something that benefits from an AI call.
"""

from dataclasses import dataclass, field

from services.focus_band import determine_focus_band
from services.skill_topic_service import get_topics_for_skill

STRONG_THRESHOLD = 75  # matches services/evaluation_service.py

STATUS_VERIFIED = "Verified"
STATUS_CURRENT = "Current"
STATUS_LOCKED = "Locked"

CURRENT_TOPIC_MESSAGES = {
    "fundamentals": "Even the basics need work here — start from the fundamentals before moving on.",
    "application": "The definition is solid, but applying it (predicting output, spotting bugs) needs practice.",
    "advanced": "Fundamentals and application are solid — focus on edge cases and advanced usage.",
    "polish": "Overall solid, but not yet consistent — a quick revision pass should be enough.",
    "not_attempted": "Not assessed yet — start here.",
}

VERIFIED_REASON_TEMPLATE = "Skipped based on your {score}% diagnostic score on {skill}."


@dataclass
class CompressedTopic:
    topic_id: str
    title: str
    order: int
    status: str  # "Verified" | "Current" | "Locked"
    note: str    # why it's Verified, or what to focus on if Current, or "" if Locked

    def to_dict(self) -> dict:
        return {
            "topicId": self.topic_id,
            "title": self.title,
            "order": self.order,
            "status": self.status,
            "note": self.note,
        }


@dataclass
class CompressedSkillSyllabus:
    skill: str
    score_percent: float
    level: str
    verified_count: int
    total_topics: int
    topics: list[CompressedTopic] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "skill": self.skill,
            "scorePercent": self.score_percent,
            "level": self.level,
            "verifiedCount": self.verified_count,
            "totalTopics": self.total_topics,
            "topics": [t.to_dict() for t in self.topics],
        }


def _verified_count(total_topics: int, score_percent: float, level: str) -> int:
    if total_topics == 0:
        return 0
    if level != "Strong":
        return 0
    raw = int((score_percent / 100) * total_topics)  # floor
    return min(raw, total_topics - 1)


def compress_topics(
    topics: list[dict],
    skill: str,
    score_percent: float,
    level: str,
    breakdown: dict[str, dict[str, int]],
) -> CompressedSkillSyllabus:
    """
    Pure function — no Firestore. `topics` must already be sorted by
    Order (services/skill_topic_repository.list_topics_for_skill()
    guarantees this).
    """
    total = len(topics)
    verified_count = _verified_count(total, score_percent, level)

    focus_band = "not_attempted" if level == "Not Attempted" else determine_focus_band(breakdown)
    current_note = CURRENT_TOPIC_MESSAGES[focus_band]
    verified_note = VERIFIED_REASON_TEMPLATE.format(score=score_percent, skill=skill)

    compressed: list[CompressedTopic] = []
    for i, t in enumerate(topics):
        if i < verified_count:
            status, note = STATUS_VERIFIED, verified_note
        elif i == verified_count:
            status, note = STATUS_CURRENT, current_note
        else:
            status, note = STATUS_LOCKED, ""

        compressed.append(
            CompressedTopic(
                topic_id=t["TopicID"], title=t["Title"], order=t["Order"],
                status=status, note=note,
            )
        )

    return CompressedSkillSyllabus(
        skill=skill, score_percent=score_percent, level=level,
        verified_count=verified_count, total_topics=total, topics=compressed,
    )


# ---------------------------------------------------------------------------
# Orchestration — fetches topics via skill_topic_service, then compresses.
# ---------------------------------------------------------------------------


def get_compressed_skill_syllabus(db, skill: str, score_percent: float, level: str,
                                   breakdown: dict[str, dict[str, int]]) -> dict:
    topics = get_topics_for_skill(db, skill)
    return compress_topics(topics, skill, score_percent, level, breakdown).to_dict()


def get_compressed_role_syllabus(db, role_id: str, evaluation: dict) -> dict:
    """
    evaluation: {"skills": [...], "overall": {...}} — the exact object
    services/evaluation_service.py / evaluate-diagnostic-assessment
    returns. Every assessed skill gets compressed per its own score;
    a role skill the learner never selected/assessed simply has no
    SkillResult to compress from and is reported with an empty topic
    list rather than guessed at.
    """
    from services.skill_topic_service import get_syllabus_for_role

    role_syllabus = get_syllabus_for_role(db, role_id)  # gives the skill list + raw topics
    by_skill_result = {s["skill"]: s for s in evaluation.get("skills", [])}

    compressed_skills = []
    for skill_entry in role_syllabus["skills"]:
        skill = skill_entry["skill"]
        result = by_skill_result.get(skill)

        if result is None:
            compressed_skills.append({
                "skill": skill,
                "scorePercent": None,
                "level": "Not Assessed",
                "verifiedCount": 0,
                "totalTopics": skill_entry["topicCount"],
                "topics": [
                    {"topicId": t["TopicID"], "title": t["Title"], "order": t["Order"],
                     "status": STATUS_LOCKED if i > 0 else STATUS_CURRENT,
                     "note": "" if i > 0 else "Not assessed yet — start here."}
                    for i, t in enumerate(skill_entry["topics"])
                ],
            })
            continue

        compressed = compress_topics(
            skill_entry["topics"], skill,
            result["scorePercent"], result["level"], result["breakdown"],
        )
        compressed_skills.append(compressed.to_dict())

    return {"roleId": role_id, "skills": compressed_skills}
