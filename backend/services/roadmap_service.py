"""
services/roadmap_service.py

Roadmap Agent (#9 in ARCHITECTURE.md).

Responsibility: given the Evaluation Agent's skill-wise breakdown
(services/evaluation_service.py), produce an ORDERED study plan — which
skill to tackle first, what to focus on within it, and roughly how many
weeks the plan spans.

DESIGN DECISION: this is deliberately rule-based, NOT an LLM call. The
question "which weak skill should a student study first" doesn't need a
language model — it needs the student's own diagnostic data, which we
already have in full. Keeping this deterministic means:
  1. It's instant (no API call, no cold start, no cost).
  2. It NEVER fails due to Gemini/Groq being down — unlike question
     generation, there's no external dependency to have a bad day.
  3. It's fully explainable and testable — every ordering decision below
     has a one-line reason, not a black-box model output.

An AI-enhanced version (e.g. Gemini writing more natural, personalized
paragraph explanations instead of the templated ones below) is a
reasonable future upgrade — but it should be an OPTIONAL layer on top of
this, never a replacement, so a roadmap can always be generated even if
every AI provider is unavailable.
"""

from dataclasses import dataclass, field

# Skills at these levels get a roadmap entry, ordered worst-first.
# "Strong" skills are excluded from the main plan — the student already
# knows them — but still listed separately as a quick maintenance note.
NEEDS_WORK_LEVELS = ["Not Attempted", "Weak", "Intermediate"]
LEVEL_PRIORITY_RANK = {"Not Attempted": 0, "Weak": 1, "Intermediate": 2}

FOCUS_BAND_MESSAGES = {
    "fundamentals": "Even the basics need work — start from the fundamentals before moving on.",
    "application": "Basics are solid, but applying them (predicting output, spotting bugs) needs practice.",
    "advanced": "Fundamentals and application are solid — focus on edge cases and advanced usage.",
    "polish": "Overall solid, but not yet consistent — a quick revision pass should be enough.",
}


@dataclass
class RoadmapEntry:
    order: int
    week: int
    skill: str
    current_level: str
    score_percent: float
    focus_band: str  # "fundamentals" | "application" | "advanced" | "polish"
    recommendation: str

    def to_dict(self) -> dict:
        return {
            "order": self.order,
            "week": self.week,
            "skill": self.skill,
            "currentLevel": self.current_level,
            "scorePercent": self.score_percent,
            "focusBand": self.focus_band,
            "recommendation": self.recommendation,
        }


@dataclass
class Roadmap:
    entries: list[RoadmapEntry] = field(default_factory=list)
    already_strong: list[str] = field(default_factory=list)
    total_weeks: int = 0
    includes_project_week: bool = False

    def to_dict(self) -> dict:
        return {
            "entries": [e.to_dict() for e in self.entries],
            "alreadyStrong": self.already_strong,
            "totalWeeks": self.total_weeks,
            "includesProjectWeek": self.includes_project_week,
        }


def _determine_focus_band(breakdown: dict[str, dict[str, int]]) -> str:
    """
    Looks at WHERE within a skill the student is weak — not just the
    overall score — to give a more specific recommendation than "study
    more". e.g. two skills can both be 50%, but one is weak on basics
    (needs fundamentals) and the other is weak only on edge cases (needs
    advanced practice) — very different study plans.
    """

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
    evaluation: the dict returned by services/evaluation_service.py's
    EvaluationResult.to_dict() — i.e. {"skills": [...], "overall": {...}}.

    Ordering: skills needing work are sorted by (level priority, score
    ascending) — "Not Attempted" and "Weak" skills come before
    "Intermediate" ones, and within the same level, the lowest score goes
    first. "Strong" skills are set aside as already-known, not scheduled.
    A final "Mini Project" week is added whenever there's more than one
    skill in the plan, to consolidate what was learned — matches the
    workflow's own Step 6 example (Week 4: Mini Project).
    """
    needs_work = [
        s for s in evaluation["skills"] if s["level"] in NEEDS_WORK_LEVELS
    ]
    already_strong = [s["skill"] for s in evaluation["skills"] if s["level"] == "Strong"]

    needs_work.sort(key=lambda s: (LEVEL_PRIORITY_RANK[s["level"]], s["scorePercent"]))

    entries = []
    for i, skill_result in enumerate(needs_work):
        focus_band = _determine_focus_band(skill_result["breakdown"])
        entries.append(
            RoadmapEntry(
                order=i + 1,
                week=i + 1,
                skill=skill_result["skill"],
                current_level=skill_result["level"],
                score_percent=skill_result["scorePercent"],
                focus_band=focus_band,
                recommendation=FOCUS_BAND_MESSAGES[focus_band],
            )
        )

    includes_project_week = len(entries) > 1
    total_weeks = len(entries) + (1 if includes_project_week else 0)

    return Roadmap(
        entries=entries,
        already_strong=already_strong,
        total_weeks=total_weeks,
        includes_project_week=includes_project_week,
    )
