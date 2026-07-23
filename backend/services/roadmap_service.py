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

DESIGN DECISION (unchanged): still deliberately rule-based, NOT an LLM
call — the question "which skill needs work first" doesn't need a
language model, it needs the diagnostic data already in hand. See the
original docstring reasoning (instant, no external dependency to fail,
fully explainable) — none of that changes with this restructure.
"""

from dataclasses import dataclass, field

NEEDS_WORK_LEVELS = ["Not Attempted", "Weak", "Intermediate"]
LEVEL_PRIORITY_RANK = {"Not Attempted": 0, "Weak": 1, "Intermediate": 2}

FOCUS_BAND_MESSAGES = {
    "fundamentals": "Even the basics need work — start from the fundamentals before moving on.",
    "application": "Basics are solid, but applying them (predicting output, spotting bugs) needs practice.",
    "advanced": "Fundamentals and application are solid — focus on edge cases and advanced usage.",
    "polish": "Overall solid, but not yet consistent — a quick revision pass should be enough.",
}

MASTERED_MESSAGE = "Already mastered on your diagnostic assessment — no scheduled study, just quick revision if you want it."

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
    current_level: str
    score_percent: float
    status: str  # "mastered" | "upcoming"
    week: int | None  # None for mastered entries — they're not "scheduled"
    focus_band: str | None  # None for mastered entries
    recommendation: str

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
        }


@dataclass
class Roadmap:
    entries: list[RoadmapEntry] = field(default_factory=list)
    total_skills: int = 0
    mastered_count: int = 0
    upcoming_count: int = 0
    total_weeks: int = 0  # upcoming weeks + project week — weeks still AHEAD
    includes_project_week: bool = False
    pace_label: str = PACE_STEADY
    course_completion_percent: float = 0.0  # mastered / total, BEFORE any upcoming week is completed

    def to_dict(self) -> dict:
        return {
            "entries": [e.to_dict() for e in self.entries],
            "totalSkills": self.total_skills,
            "masteredCount": self.mastered_count,
            "upcomingCount": self.upcoming_count,
            "totalWeeks": self.total_weeks,
            "includesProjectWeek": self.includes_project_week,
            "paceLabel": self.pace_label,
            "courseCompletionPercent": self.course_completion_percent,
        }


def _determine_focus_band(breakdown: dict[str, dict[str, int]]) -> str:
    def accuracy(level: str) -> float:
        band = breakdown.get(level, {"correct": 0, "total": 0})
        return (band["correct"] / band["total"] * 100) if band["total"] else 100.0

    easy_acc = accuracy("Easy")
    medium_acc = accuracy("Medium")
    hard_acc = accuracy("Hard")

    if easy_acc < 50:
        return "fundamentals"
    if medium_acc < 50:
        return "application"
    if hard_acc < 50:
        return "advanced"
    return "polish"


def generate_roadmap(evaluation: dict) -> Roadmap:
    """
    evaluation: {"skills": [...], "overall": {...}} from
    services/evaluation_service.py.

    Every skill gets an entry. "Strong" skills become status="mastered"
    (order comes first, no week assigned). Everything else becomes
    status="upcoming", sorted worst-first (level priority, then score
    ascending) and assigned sequential week numbers. A "Mini Project"
    week is added whenever there's more than one upcoming skill.
    """
    all_skills = evaluation["skills"]
    total_skills = len(all_skills)

    mastered = [s for s in all_skills if s["level"] == "Strong"]
    needs_work = [s for s in all_skills if s["level"] in NEEDS_WORK_LEVELS]
    needs_work.sort(key=lambda s: (LEVEL_PRIORITY_RANK[s["level"]], s["scorePercent"]))

    entries: list[RoadmapEntry] = []
    order = 1
    for s in mastered:
        entries.append(
            RoadmapEntry(
                order=order, skill=s["skill"], current_level=s["level"],
                score_percent=s["scorePercent"], status="mastered",
                week=None, focus_band=None, recommendation=MASTERED_MESSAGE,
            )
        )
        order += 1

    for i, s in enumerate(needs_work):
        focus_band = _determine_focus_band(s["breakdown"])
        entries.append(
            RoadmapEntry(
                order=order, skill=s["skill"], current_level=s["level"],
                score_percent=s["scorePercent"], status="upcoming",
                week=i + 1, focus_band=focus_band,
                recommendation=FOCUS_BAND_MESSAGES[focus_band],
            )
        )
        order += 1

    includes_project_week = len(needs_work) > 1
    upcoming_weeks = len(needs_work) + (1 if includes_project_week else 0)

    mastered_count = len(mastered)
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
        total_weeks=upcoming_weeks,
        includes_project_week=includes_project_week,
        pace_label=pace_label,
        course_completion_percent=course_completion_percent,
    )


# ---------------------------------------------------------------------------
# Persistence orchestration — everything above this line is the pure Roadmap
# Agent (generate_roadmap) with zero Firestore dependency.
# ---------------------------------------------------------------------------

from firebase.firebase_config import get_firestore_client
from services.roadmap_repository import save_roadmap as _save_roadmap, get_roadmap as _get_roadmap


def generate_and_save_roadmap(uid: str, role: str, evaluation: dict) -> dict:
    roadmap = generate_roadmap(evaluation)
    db = get_firestore_client()
    return _save_roadmap(db, uid, role, roadmap.to_dict())


def load_saved_roadmap(uid: str) -> dict | None:
    db = get_firestore_client()
    return _get_roadmap(db, uid)
