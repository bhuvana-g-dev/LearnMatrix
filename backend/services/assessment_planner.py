"""
services/assessment_planner.py

Assessment Planner Agent (#1 in ARCHITECTURE.md), diagnostic-assessment
slice: turns a list of selected skills into a concrete generation plan.

Per the diagnostic assessment design: every skill gets the SAME fixed
spread (5 Easy + 5 Medium + 5 Hard = 15 questions/skill), because the
Evaluation Agent's classification (services/evaluation_service.py) needs
a consistent, comparable structure across skills — you can't compare
"Strong at Python" vs "Strong at SQL" fairly if they were tested with
different question counts or difficulty mixes.

15/skill (up from an earlier 6/skill) exists because 6 was too thin a
sample to classify Strong/Intermediate/Weak reliably — one lucky guess
or careless mistake could flip a whole band. See OPEN_ENDED_PER_DIFFICULTY
below and agents/question_generation_agent.py's run_chunked() for how a
bigger per-skill count is kept RELIABLE: each skill's 15 questions are
requested as 3 separate Gemini calls (one per difficulty, 5 questions
each — the same size as the old, already-reliable 6-question call), not
one call for all 15 at once. A single skill's total failure used to also
abort the ENTIRE diagnostic assessment (5 skills selected = 5 chances to
crash the whole thing); chunking shrinks each individual call back down
to a size that was already proven reliable, and confines any remaining
failure to one chunk of one skill instead of the whole assessment.

This is intentionally NOT the same as the generic Difficulty Engine
(services/difficulty_engine.py), which picks ONE difficulty for a
practice quiz based on prior performance. A diagnostic assessment's whole
point is to test across ALL difficulty levels at once, precisely because
the student's actual level isn't known yet.
"""

from dataclasses import dataclass, field

QUESTIONS_PER_DIFFICULTY = {"Easy": 5, "Medium": 5, "Hard": 5}

# Of the 15 questions per skill, 4 are open-ended (typed answer) instead
# of multiple-choice — spread across difficulties rather than dumped in
# one band, same "comparable structure" reasoning as QUESTIONS_PER_DIFFICULTY
# above. Must be <= the corresponding QUESTIONS_PER_DIFFICULTY value.
OPEN_ENDED_PER_DIFFICULTY = {"Easy": 1, "Medium": 2, "Hard": 1}

# Auto-detected by skill name (case-insensitive, exact match against the
# skill string as selected in the role/skill picker) — a skill on this
# list gets "CodeCompletion" open-ended questions (a code snippet with a
# blank to complete); anything NOT on this list gets plain "FillBlank"
# questions instead (a sentence/definition with a blank), which works for
# any skill, programming or not. Extend this list as new programming-
# language skills are added to skill_topics/role_skill_mapping.
PROGRAMMING_LANGUAGE_SKILLS: set[str] = {
    "python", "javascript", "typescript", "java", "c", "c++", "c#",
    "sql", "go", "golang", "rust", "php", "ruby", "kotlin", "swift", "r",
}


def is_programming_language_skill(skill: str) -> bool:
    return skill.strip().lower() in PROGRAMMING_LANGUAGE_SKILLS


@dataclass
class SkillPlan:
    skill: str
    difficulty_counts: dict[str, int]
    open_ended_counts: dict[str, int] = field(default_factory=dict)
    open_ended_type: str = "FillBlank"  # "FillBlank" | "CodeCompletion"

    @property
    def total(self) -> int:
        return sum(self.difficulty_counts.values())


def build_diagnostic_plan(skills: list[str]) -> list[SkillPlan]:
    """
    One SkillPlan per selected skill, each requesting the same fixed
    5/5/5 Easy/Medium/Hard split, with OPEN_ENDED_PER_DIFFICULTY of those
    slots reserved for a typed-answer question instead of MCQ. Returned
    as a list (not a dict) so ordering is preserved — useful for showing
    the assessment in a predictable, stable order in the UI.
    """
    if not skills:
        raise ValueError("At least one skill must be selected to build a diagnostic plan.")
    return [
        SkillPlan(
            skill=s,
            difficulty_counts=dict(QUESTIONS_PER_DIFFICULTY),
            open_ended_counts=dict(OPEN_ENDED_PER_DIFFICULTY),
            open_ended_type="CodeCompletion" if is_programming_language_skill(s) else "FillBlank",
        )
        for s in skills
    ]


def total_questions(skills: list[str]) -> int:
    """Convenience for the frontend/API to show 'N questions total' before generating."""
    return len(skills) * sum(QUESTIONS_PER_DIFFICULTY.values())
