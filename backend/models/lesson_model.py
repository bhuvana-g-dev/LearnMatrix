"""
models/lesson_model.py

Canonical shape of a Lesson — one row inside a topic's cached lesson
plan (see services/lesson_repository.py). A Lesson is deliberately
lightweight: just enough to render a clickable list item and to build
the composite topic-key that fetches its actual content from the
EXISTING learning_content_service.get_topic_package() pipeline (see
services/lesson_service.py's docstring for why that reuse is possible).

    lesson_plans/{skill}__{topic}
        Skill, Topic, Lessons: [ {Order, Title, Summary}, ... ],
        CreatedAt, UpdatedAt
"""

from dataclasses import dataclass, asdict


@dataclass
class Lesson:
    Order: int
    Title: str
    Summary: str

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def composite_topic_key(topic: str, lesson_title: str) -> str:
        """The string passed as `topic` into get_topic_package() for
        this specific lesson — scopes AI notes caching AND the YouTube
        search query to the lesson, not just the parent topic, without
        needing a parallel notes/resource cache keyed by lesson."""
        return f"{topic} — {lesson_title}"
