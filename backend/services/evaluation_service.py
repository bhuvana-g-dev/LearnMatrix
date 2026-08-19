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

One exception to "no I/O": grading a FillBlank/CodeCompletion answer can
make a Gemini call via services/answer_equivalence_service.py (only when
a cheap normalized string match doesn't already resolve it) — MCQ
grading stays pure/instant as before.
"""

from dataclasses import dataclass, field

from services.answer_equivalence_service import resolve_batch

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
    # Per-question correctness, keyed by TempID — {"AI-1": True, ...}.
    # Exists specifically so the frontend's results/review screen can
    # show accurate correct/wrong per question WITHOUT re-deriving it
    # itself (see screens/AssessmentScreen.jsx) — for FillBlank/
    # CodeCompletion questions, correctness comes from is_equivalent()'s
    # loose/AI-assisted match, not a plain string comparison, so the
    # frontend has no way to recompute this correctly on its own.
    question_results: dict[str, bool] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "skills": [s.to_dict() for s in self.skills],
            "overall": {
                "correct": self.overall_correct,
                "total": self.overall_total,
                "scorePercent": self.overall_percent,
            },
            "questionResults": self.question_results,
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
    question_results: dict[str, bool] = {}

    # FillBlank/CodeCompletion questions can't be graded with `==` (a
    # typed answer can be correct without matching CorrectAnswer
    # byte-for-byte) — those get queued here and resolved together in
    # ONE batched pass below, instead of one sequential Gemini call per
    # question inline in this loop (see
    # services/answer_equivalence_service.resolve_batch() for why that
    # used to add a sequential round-trip per open-ended miss).
    open_ended_items: list[dict] = []

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
        question_type = q.get("QuestionType", "MCQ")
        if question_type == "MCQ":
            is_correct = chosen is not None and chosen == q["CorrectAnswer"]
            question_results[q["TempID"]] = is_correct
            if is_correct:
                per_skill[skill][difficulty]["correct"] += 1
        else:
            open_ended_items.append({
                "key": q["TempID"],
                "question": q.get("Question", ""),
                "correct_answer": q["CorrectAnswer"],
                "student_answer": chosen,
                "skill": skill,
                "difficulty": difficulty,
            })

    if open_ended_items:
        batch_results = resolve_batch([
            {
                "key": item["key"],
                "question": item["question"],
                "correct_answer": item["correct_answer"],
                "student_answer": item["student_answer"],
            }
            for item in open_ended_items
        ])
        for item in open_ended_items:
            is_correct = batch_results.get(item["key"], False)
            question_results[item["key"]] = is_correct
            if is_correct:
                per_skill[item["skill"]][item["difficulty"]]["correct"] += 1

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
    result.question_results = question_results
    return result
