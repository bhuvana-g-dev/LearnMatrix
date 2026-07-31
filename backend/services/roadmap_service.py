"""
services/roadmap_service.py

Roadmap Agent (#9 in ARCHITECTURE.md).

Responsibility: given the Evaluation Agent's skill-wise breakdown
(services/evaluation_service.py), produce the student's FULL course
roadmap — every selected skill, not just the weak ones. Skills already
at "Strong" level are included as already-completed/mastered entries
(status="mastered"), so the roadmap represents the whole journey — what
they've already earned, not only what's left. Skills needing work are
scheduled week-by-week (status="upcoming"), worst first.

WHY THIS CHANGED from an earlier version that excluded Strong skills
entirely: a roadmap that only ever shows the remedial slice looks thin
and demoralizing for anyone with even one strong skill, and doesn't
answer "how far am I through the whole course" — which is the actual
point of a roadmap. Including mastered skills as completed entries lets
completionPercent start above 0% immediately (a student Strong in 2 of
5 skills has legitimately already finished 40% of the course before
touching a single upcoming week), and gives students something to see
progress against beyond "you have 3 weak skills to fix".

ROLE-DRIVEN CURRICULUM (this revision): generate_roadmap() now accepts
an optional `role_skills` — the learner's FULL role skill list (see
services/skill_topic_service.get_syllabus_for_role). This is the core
LearnMatrix rule: the SELECTED ROLE decides which skills belong on the
roadmap, not which skills the learner happened to claim/assess.
Claiming a skill only means "verify what I already know" for scoring —
it never means "only show me this". Any role skill missing from the
evaluation becomes its own status="not_assessed" entry (full syllabus,
starts at topic 1, no week assigned yet) instead of silently vanishing
from the roadmap. Omit `role_skills` (e.g. the role isn't seeded in
data/skill_syllabus_seed.py yet) and this falls back to the original
assessed-skills-only behavior — same shape, just a narrower skill set.

MODULE GROUPING (this revision): generate_roadmap() now also accepts
optional `role_categories` — the {category: [skills]} mapping from
data/role_skill_categories.py — used purely to tag each entry with
which "module" it belongs to (e.g. "Frontend", "Backend", "Database",
"Tools" for the fullstack role) so the frontend can group the roadmap
into Module 1, Module 2, ... instead of one flat list. This is
DISPLAY-ONLY: it changes nothing about how a skill is classified
mastered/upcoming/not_assessed or how weeks are numbered — it only adds
a `module` tag to each entry. Omit it and every entry's module is None,
which the frontend treats as "no module grouping, render as before".

DESIGN DECISION (unchanged): still deliberately rule-based, NOT an LLM
call — the question "which skill needs work first" doesn't need a
language model, it needs the diagnostic data already in hand. See the
original docstring reasoning (instant, no external dependency to fail,
fully explainable) — none of that changes with this restructure.
"""

from dataclasses import dataclass, field

from services.focus_band import determine_focus_band

NEEDS_WORK_LEVELS = ["Not Attempted", "Weak", "Intermediate"]
LEVEL_PRIORITY_RANK = {"Not Attempted": 0, "Weak": 1, "Intermediate": 2}

FOCUS_BAND_MESSAGES = {
    "fundamentals": "Even the basics need work — start from the fundamentals before moving on.",
    "application": "Basics are solid, but applying them (predicting output, spotting bugs) needs practice.",
    "advanced": "Fundamentals and application are solid — focus on edge cases and advanced usage.",
    "polish": "Overall solid, but not yet consistent — a quick revision pass should be enough.",
}

MASTERED_MESSAGE = "Already mastered on your diagnostic assessment — no scheduled study, just quick revision if you want it."
NOT_ASSESSED_MESSAGE = "Part of your role's curriculum, but not assessed yet — full syllabus starting from Topic 1 once you get here."

# Simple, explainable pace label — NOT a different visual theme per
# learner (that would mean maintaining multiple UIs), just an honest,
# encouraging framing of the SAME roadmap structure that matches how
# much ground is actually left to cover.
PACE_FAST_TRACK = "Fast-Track"
PACE_STEADY = "Steady & Thorough"


@dataclass
class RoadmapEntry:
    order: int
    skill: str
    current_level: str  # "Strong" | "Intermediate" | "Weak" | "Not Attempted" | "Not Assessed"
    score_percent: float | None  # None for status="not_assessed" — never measured
    status: str  # "mastered" | "upcoming" | "not_assessed"
    week: int | None  # None for mastered/not_assessed entries — they're not "scheduled"
    focus_band: str | None  # None for mastered/not_assessed entries
    recommendation: str
    module: str | None = None  # e.g. "Frontend", "Backend" — None when role_categories wasn't provided

    def to_dict(self) -> dict:
        return {
            "order": self.order,
            "skill": self.skill,
            "currentLevel": self.current_level,
            "scorePercent": self.score_percent,
            "status": self.status,
            "week": self.week,
            "focusBand": self.focus_band,
            "recommendation": self.recommendation,
            "module": self.module,
        }


@dataclass
class Roadmap:
    entries: list[RoadmapEntry] = field(default_factory=list)
    total_skills: int = 0
    mastered_count: int = 0
    upcoming_count: int = 0
    not_assessed_count: int = 0  # role skills never claimed/assessed — still on the roadmap
    total_weeks: int = 0  # upcoming weeks + project week — weeks still AHEAD
    includes_project_week: bool = False
    pace_label: str = PACE_STEADY
    course_completion_percent: float = 0.0  # mastered / total, BEFORE any upcoming week is completed
    module_order: list[str] = field(default_factory=list)  # category names in display order, [] if ungrouped

    def to_dict(self) -> dict:
        return {
            "entries": [e.to_dict() for e in self.entries],
            "totalSkills": self.total_skills,
            "masteredCount": self.mastered_count,
            "upcomingCount": self.upcoming_count,
            "notAssessedCount": self.not_assessed_count,
            "totalWeeks": self.total_weeks,
            "includesProjectWeek": self.includes_project_week,
            "paceLabel": self.pace_label,
            "courseCompletionPercent": self.course_completion_percent,
            "moduleOrder": self.module_order,
        }


def generate_roadmap(
    evaluation: dict,
    role_skills: list[str] | None = None,
    role_categories: dict[str, list[str]] | None = None,
) -> Roadmap:
    """
    evaluation: {"skills": [...], "overall": {...}} from
    services/evaluation_service.py.

    role_skills (optional): the learner's FULL role skill list
    (services/skill_topic_service.get_syllabus_for_role, or
    data/role_skill_categories.get_role_skill_list). When provided,
    THIS — not evaluation["skills"] — decides which skills appear and
    how many total_skills the roadmap covers. Any role skill that was
    never claimed/assessed still gets its own status="not_assessed"
    entry so it never silently disappears from the roadmap. Skills that
    WERE assessed are still classified mastered/upcoming exactly as
    before — role_skills only widens the set, it never changes how an
    assessed skill's own result is read.

    Omit role_skills (role not seeded yet) and this is the original
    behavior: only assessed skills appear, total_skills = count of those.

    role_categories (optional): {category: [skills]} — tags each entry
    with a `module` field and populates the roadmap's `moduleOrder` for
    grouped display. Purely a display tag; doesn't affect classification.

    "Strong" skills become status="mastered" (no week assigned).
    Everything else assessed becomes status="upcoming", sorted
    worst-first (level priority, then score ascending) and assigned
    sequential week numbers. A "Mini Project" week is added whenever
    there's more than one upcoming skill. Never-assessed role skills are
    appended last as status="not_assessed" — not part of the scheduled
    week timeline since there's no diagnostic data yet to sequence them
    by severity.
    """
    assessed_by_skill = {s["skill"]: s for s in evaluation["skills"]}

    if role_skills is not None:
        assessed_skills = [assessed_by_skill[sk] for sk in role_skills if sk in assessed_by_skill]
        not_assessed_skills = [sk for sk in role_skills if sk not in assessed_by_skill]
        total_skills = len(role_skills)
    else:
        assessed_skills = list(evaluation["skills"])
        not_assessed_skills = []
        total_skills = len(assessed_skills)

    mastered = [s for s in assessed_skills if s["level"] == "Strong"]
    needs_work = [s for s in assessed_skills if s["level"] in NEEDS_WORK_LEVELS]
    needs_work.sort(key=lambda s: (LEVEL_PRIORITY_RANK[s["level"]], s["scorePercent"]))

    skill_to_module: dict[str, str] = {}
    if role_categories:
        for category, skills in role_categories.items():
            for sk in skills:
                skill_to_module[sk] = category

    entries: list[RoadmapEntry] = []
    order = 1
    for s in mastered:
        entries.append(
            RoadmapEntry(
                order=order, skill=s["skill"], current_level=s["level"],
                score_percent=s["scorePercent"], status="mastered",
                week=None, focus_band=None, recommendation=MASTERED_MESSAGE,
                module=skill_to_module.get(s["skill"]),
            )
        )
        order += 1

    for i, s in enumerate(needs_work):
        focus_band = determine_focus_band(s["breakdown"])
        entries.append(
            RoadmapEntry(
                order=order, skill=s["skill"], current_level=s["level"],
                score_percent=s["scorePercent"], status="upcoming",
                week=i + 1, focus_band=focus_band,
                recommendation=FOCUS_BAND_MESSAGES[focus_band],
                module=skill_to_module.get(s["skill"]),
            )
        )
        order += 1

    for sk in not_assessed_skills:
        entries.append(
            RoadmapEntry(
                order=order, skill=sk, current_level="Not Assessed",
                score_percent=None, status="not_assessed",
                week=None, focus_band=None, recommendation=NOT_ASSESSED_MESSAGE,
                module=skill_to_module.get(sk),
            )
        )
        order += 1

    includes_project_week = len(needs_work) > 1
    upcoming_weeks = len(needs_work) + (1 if includes_project_week else 0)

    mastered_count = len(mastered)
    not_assessed_count = len(not_assessed_skills)
    course_completion_percent = round(
        (mastered_count / total_skills * 100) if total_skills else 0.0, 1
    )

    # Pace framing: mostly-mastered-already reads as "fast track" (short
    # sprint left); mostly-still-to-learn reads as "steady, thorough
    # path" — same roadmap structure either way, just an honest label
    # that matches how much is actually ahead, not a different UI.
    pace_label = PACE_FAST_TRACK if (mastered_count / total_skills if total_skills else 0) >= 0.5 else PACE_STEADY

    return Roadmap(
        entries=entries,
        total_skills=total_skills,
        mastered_count=mastered_count,
        upcoming_count=len(needs_work),
        not_assessed_count=not_assessed_count,
        total_weeks=upcoming_weeks,
        includes_project_week=includes_project_week,
        pace_label=pace_label,
        course_completion_percent=course_completion_percent,
        module_order=list(role_categories.keys()) if role_categories else [],
    )


# ---------------------------------------------------------------------------
# Persistence orchestration — everything above this line is the pure Roadmap
# Agent (generate_roadmap) with zero Firestore dependency.
# ---------------------------------------------------------------------------

from firebase.firebase_config import get_firestore_client
from services.roadmap_repository import save_roadmap as _save_roadmap, get_roadmap as _get_roadmap


def resolve_role_skills(role_id: str | None) -> list[str] | None:
    """
    Returns the full skill list for a role, or None if role_id is
    empty/unrecognized anywhere. Two sources, tried in order:

      1. Topic-seeded syllabus (services/skill_topic_service.py, backed
         by data/skill_syllabus_seed.py) — currently "frontend" only,
         but when available also unlocks the topic-level Verified/
         Current/Locked expand view via compressedSyllabus.
      2. data/role_skill_categories.py — covers ALL 8 roles (mirrors
         frontend/src/constants/skills.js), just without per-topic
         detail. This is what makes "every role skill appears on the
         roadmap" true for every role today, not just frontend.

    None only when NEITHER source recognizes role_id — the same
    fallback as never passing a role_id at all, never an error.
    """
    if not role_id:
        return None

    from services.skill_topic_service import get_syllabus_for_role, SkillTopicError

    db = get_firestore_client()
    try:
        role_syllabus = get_syllabus_for_role(db, role_id)
        return [s["skill"] for s in role_syllabus["skills"]]
    except SkillTopicError:
        pass

    from data.role_skill_categories import get_role_skill_list

    return get_role_skill_list(role_id)


def resolve_role_categories(role_id: str | None) -> dict[str, list[str]] | None:
    """{category: [skills]} for module-grouped display — see
    data/role_skill_categories.py. None if role_id isn't recognized
    there, in which case the roadmap renders ungrouped (unchanged
    behavior), same fallback pattern as resolve_role_skills."""
    if not role_id:
        return None
    from data.role_skill_categories import get_role_categories

    return get_role_categories(role_id)


def _compressed_syllabus_or_none(role_id: str | None, role_skills: list[str] | None, evaluation: dict) -> dict | None:
    """Only computed when a role was actually resolved — mirrors the
    same "seeded role or silently skip" rule as resolve_role_skills."""
    if not role_id or role_skills is None:
        return None
    from services.syllabus_compression_service import get_compressed_role_syllabus

    db = get_firestore_client()
    return get_compressed_role_syllabus(db, role_id, evaluation)


def generate_and_save_roadmap(uid: str, role: str, evaluation: dict, role_id: str | None = None) -> dict:
    role_skills = resolve_role_skills(role_id)
    role_categories = resolve_role_categories(role_id)
    roadmap = generate_roadmap(evaluation, role_skills=role_skills, role_categories=role_categories)
    compressed_syllabus = _compressed_syllabus_or_none(role_id, role_skills, evaluation)

    db = get_firestore_client()
    return _save_roadmap(
        db, uid, role, roadmap.to_dict(),
        role_id=role_id, compressed_syllabus=compressed_syllabus,
    )


def generate_roadmap_preview(evaluation: dict, role_id: str | None = None) -> dict:
    """
    Non-persisted counterpart to generate_and_save_roadmap() — used when
    no uid is provided (e.g. quick testing). Still role-driven and still
    includes compressedSyllabus in the response so the shape matches the
    persisted path exactly; it just never touches the `roadmaps`
    collection.
    """
    role_skills = resolve_role_skills(role_id)
    role_categories = resolve_role_categories(role_id)
    roadmap = generate_roadmap(evaluation, role_skills=role_skills, role_categories=role_categories)
    roadmap_dict = roadmap.to_dict()
    roadmap_dict["compressedSyllabus"] = _compressed_syllabus_or_none(role_id, role_skills, evaluation)
    return roadmap_dict


def load_saved_roadmap(uid: str) -> dict | None:
    db = get_firestore_client()
    return _get_roadmap(db, uid)
