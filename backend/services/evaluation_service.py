"""
services/evaluation_service.py

Evaluation Agent (#5 in ARCHITECTURE.md), skill-wise slice.

Responsibility: given the diagnostic assessment's questions (each tagged
with Skill + Difficulty) and the student's answers, produce a per-skill
breakdown — not just one overall score. This is the actual output your
final-year project's "core intelligence" example table is built from:

    Skill      | Easy | Medium | Hard | Level
    Variables  | 2/2  | 2/2    | 1/2  | Strong
    Loops      | 2/2  | 1/2    | 0/2  | Intermediate
    OOP        | 0/2  | 0/2    | 0/2  | Beginner

SCORING DESIGN NOTE: this uses a plain unweighted percentage
(correct / total * 100 per skill), not a difficulty-weighted score. A
weighted version (Hard questions worth more) was tried first but doesn't
reproduce the example above — Loops at 2/2 Easy + 1/2 Medium + 0/2 Hard
is 50% unweighted (lands in "Intermediate"), but weighted it drops below
the Intermediate cutoff into "Weak". Unweighted is also simpler to
explain to anyone reading the code or asking about it in an interview:
"percent of questions answered correctly for that skill" needs no
further justification, whereas a weighting scheme invites the follow-up
"why those specific weights?" with no clean answer.

Nothing here touches Firestore — same rule as every other agent. The
route/service calling this decides whether/how to persist the result
(§9 Phase 3 in ARCHITECTURE.md: quiz_results / assessment_history).
"""

from dataclasses import dataclass, field

STRONG_THRESHOLD = 75
INTERMEDIATE_THRESHOLD = 40


@dataclass
class SkillResult:
    skill: str
    breakdown: dict[str, dict[str, int]]  # {"Easy": {"correct": 2, "total": 2}, ...}
    correct: int
    total: int
    score_percent: float
    level: str  # "Strong" | "Intermediate" | "Weak" | "Not Attempted"

    def to_dict(self) -> dict:
        return {
            "skill": self.skill,
            "breakdown": self.breakdown,
            "correct": self.correct,
            "total": self.total,
            "scorePercent": self.score_percent,
            "level": self.level,
        }


@dataclass
class EvaluationResult:
    skills: list[SkillResult] = field(default_factory=list)
    overall_correct: int = 0
    overall_total: int = 0
    overall_percent: float = 0.0

    def to_dict(self) -> dict:
        return {
            "skills": [s.to_dict() for s in self.skills],
            "overall": {
                "correct": self.overall_correct,
                "total": self.overall_total,
                "scorePercent": self.overall_percent,
            },
        }


def _classify(score_percent: float, total_attempted: int) -> str:
    if total_attempted == 0:
        return "Not Attempted"
    if score_percent >= STRONG_THRESHOLD:
        return "Strong"
    if score_percent >= INTERMEDIATE_THRESHOLD:
        return "Intermediate"
    return "Weak"


def evaluate_diagnostic_assessment(
    questions: list[dict], answers: dict[str, str]
) -> EvaluationResult:
    """
    questions: list of GeneratedQuestion dicts (must have TempID, Skill,
               Difficulty, CorrectAnswer).
    answers:   {TempID: chosen_option} — e.g. {"AI-1": "OptionB"}.
               A skipped question simply has no key here.

    Groups questions by Skill, then by Difficulty within each skill,
    scores each, and classifies the skill level. Order of `skills` in
    the result matches the order skills first appear in `questions`.
    """
    skill_order: list[str] = []
    # skill -> difficulty -> {"correct": int, "total": int}
    per_skill: dict[str, dict[str, dict[str, int]]] = {}

    for q in questions:
        skill = q["Skill"]
        difficulty = q["Difficulty"]
        if skill not in per_skill:
            per_skill[skill] = {}
            skill_order.append(skill)
        if difficulty not in per_skill[skill]:
            per_skill[skill][difficulty] = {"correct": 0, "total": 0}

        per_skill[skill][difficulty]["total"] += 1
        chosen = answers.get(q["TempID"])
        if chosen is not None and chosen == q["CorrectAnswer"]:
            per_skill[skill][difficulty]["correct"] += 1

    result = EvaluationResult()
    for skill in skill_order:
        breakdown = per_skill[skill]
        correct = sum(b["correct"] for b in breakdown.values())
        total = sum(b["total"] for b in breakdown.values())
        # "attempted" = at least one question in this skill was actually
        # answered (not skipped) — distinguishes "Weak" (tried, got them
        # wrong) from "Not Attempted" (skipped the whole skill).
        attempted = sum(
            1 for q in questions
            if q["Skill"] == skill and answers.get(q["TempID"]) is not None
        )
        score_percent = round((correct / total * 100) if total else 0.0, 1)
        level = _classify(score_percent, attempted)

        result.skills.append(
            SkillResult(
                skill=skill,
                breakdown=breakdown,
                correct=correct,
                total=total,
                score_percent=score_percent,
                level=level,
            )
        )
        result.overall_correct += correct
        result.overall_total += total

    result.overall_percent = round(
        (result.overall_correct / result.overall_total * 100) if result.overall_total else 0.0, 1
    )
    return result
