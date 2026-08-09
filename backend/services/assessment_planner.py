"""
services/assessment_planner.py

Assessment Planner Agent (#1 in ARCHITECTURE.md), diagnostic-assessment
slice: turns a list of selected skills into a concrete generation plan.

Per the diagnostic assessment design: every skill gets the SAME fixed
spread (2 Easy + 2 Medium + 2 Hard = 6 questions/skill), because the
Evaluation Agent's classification (services/evaluation_service.py) needs
a consistent, comparable structure across skills — you can't compare
"Strong at Python" vs "Strong at SQL" fairly if they were tested with
different question counts or difficulty mixes.

This is intentionally NOT the same as the generic Difficulty Engine
(services/difficulty_engine.py), which picks ONE difficulty for a
practice quiz based on prior performance. A diagnostic assessment's whole
point is to test across ALL difficulty levels at once, precisely because
the student's actual level isn't known yet.
"""

from dataclasses import dataclass

QUESTIONS_PER_DIFFICULTY = {"Easy": 2, "Medium": 2, "Hard": 2}


@dataclass
class SkillPlan:
    skill: str
    difficulty_counts: dict[str, int]

    @property
    def total(self) -> int:
        return sum(self.difficulty_counts.values())


def build_diagnostic_plan(skills: list[str]) -> list[SkillPlan]:
    """
    One SkillPlan per selected skill, each requesting the same fixed
    2/2/2 Easy/Medium/Hard split. Returned as a list (not a dict) so
    ordering is preserved — useful for showing the assessment in a
    predictable, stable order in the UI.
    """
    if not skills:
        raise ValueError("At least one skill must be selected to build a diagnostic plan.")
    return [SkillPlan(skill=s, difficulty_counts=dict(QUESTIONS_PER_DIFFICULTY)) for s in skills]


def total_questions(skills: list[str]) -> int:
    """Convenience for the frontend/API to show 'N questions total' before generating."""
    return len(skills) * sum(QUESTIONS_PER_DIFFICULTY.values())
