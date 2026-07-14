"""
models/generated_question_model.py

Shape of a question produced by agents/question_generation_agent.py.

Deliberately NOT the same class as models/question_model.Question:
a GeneratedQuestion is ephemeral (built for one assessment, never written
to Firestore, no permanent QuestionID/CreatedAt/UpdatedAt). Reusing
Question here would imply a Firestore lifecycle that doesn't exist for
AI-generated questions per the architecture doc's "generated questions are
never permanently stored" rule.

TempID is a per-request identifier only (e.g. "AI-1", "AI-2") so the
frontend/assessment builder can reference a question within one assessment
payload — it carries no meaning outside that single response.
"""

from dataclasses import dataclass, asdict


@dataclass
class GeneratedQuestion:
    TempID: str
    Skill: str
    Topic: str
    Difficulty: str
    QuestionType: str
    Question: str
    OptionA: str
    OptionB: str
    OptionC: str
    OptionD: str
    CorrectAnswer: str
    Explanation: str
    Source: str = "AI"  # always "AI" — distinguishes from Question Bank rows
                          # once Assessment Builder Agent merges both sources.

    @staticmethod
    def from_gemini_row(row: dict, index: int) -> "GeneratedQuestion":
        return GeneratedQuestion(
            TempID=f"AI-{index}",
            Skill=str(row.get("Skill", "")).strip(),
            Topic=str(row.get("Topic", "")).strip(),
            Difficulty=str(row.get("Difficulty", "")).strip(),
            QuestionType=str(row.get("QuestionType", "MCQ")).strip() or "MCQ",
            Question=str(row.get("Question", "")).strip(),
            OptionA=str(row.get("OptionA", "")).strip(),
            OptionB=str(row.get("OptionB", "")).strip(),
            OptionC=str(row.get("OptionC", "")).strip(),
            OptionD=str(row.get("OptionD", "")).strip(),
            CorrectAnswer=str(row.get("CorrectAnswer", "")).strip(),
            Explanation=str(row.get("Explanation", "")).strip(),
        )

    def to_dict(self) -> dict:
        return asdict(self)
