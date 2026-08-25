"""
services/lesson_service.py

Objective 5's finer granularity: given (skill, topic), return the small
ordered list of Lessons a student walks through for that topic —
generating and caching them on first request, same pattern as
services/learning_content_service.py's notes caching.

Each Lesson's actual content is NOT generated here. get_lesson_content()
below reuses the EXISTING get_topic_package() pipeline unmodified,
passing Lesson.composite_topic_key(topic, lesson_title) as the `topic`
argument — that pipeline already does exactly "generate/cache AI notes
+ fetch resources for this (skill, topic) string", and a composite
"Flexbox — Main Axis vs Cross Axis" string is just as valid a cache key
as "Flexbox" was. This is why lesson content didn't need its own
notes-generation agent, resource-fetch logic, or cache collection.
"""

from firebase.firebase_config import get_firestore_client
from services import lesson_repository as repo
from services import skill_topic_repository
from services.learning_content_service import get_topic_package, LearningContentError
from agents.lesson_planner_agent import LessonPlannerAgent, LessonPlanningError
from models.lesson_model import Lesson
from utils.generation_lock import run_with_lock


class LessonServiceError(Exception):
    pass


def _find_topic_metadata(db, skill: str, topic: str) -> dict:
    """Best-effort lookup of this topic's seeded Description/Difficulty/
    EstimatedMinutes (see data/skill_syllabus_seed.py) to ground the
    lesson planner's prompt. Returns {} — not an error — when the skill
    isn't topic-seeded yet or the topic title doesn't match exactly;
    the agent still works with just (skill, topic), just less grounded."""
    topics = skill_topic_repository.list_topics_for_skill(db, skill)
    for t in topics:
        if t.get("Title") == topic:
            return t
    return {}


def get_lessons(skill: str, topic: str) -> list[dict]:
    """Cache-first. First call for a (skill, topic) pair generates and
    saves the lesson plan; every call after that is a pure Firestore
    read, no AI call."""
    db = get_firestore_client()

    cached = repo.get_cached_lesson_plan(db, skill, topic)
    if cached is not None:
        return cached

    # Two students reaching the same never-before-planned (skill, topic)
    # at nearly the same moment would otherwise both fire a Gemini call
    # here — collapse that into one real generation. See
    # utils/generation_lock.py.
    def _generate_and_save() -> list[dict]:
        metadata = _find_topic_metadata(db, skill, topic)
        try:
            lessons = LessonPlannerAgent().run(
                skill=skill, topic=topic,
                description=metadata.get("Description", ""),
                difficulty=metadata.get("Difficulty", ""),
                estimated_minutes=metadata.get("EstimatedMinutes", 0),
            )
        except LessonPlanningError as exc:
            raise LessonServiceError(str(exc)) from exc
        return repo.save_lesson_plan(db, skill, topic, lessons)

    return run_with_lock(
        db,
        lock_key=f"lessons__{repo.lesson_cache_key(skill, topic)}",
        check_fn=lambda: repo.get_cached_lesson_plan(db, skill, topic),
        generate_and_save_fn=_generate_and_save,
    )


def list_lesson_plans(skill: str | None = None, topic: str | None = None) -> list[dict]:
    """Admin-facing read of every cached lesson plan — backs the Admin
    Panel's Lesson Plan Management screen."""
    db = get_firestore_client()
    return repo.list_all_lesson_plans(db, skill=skill, topic=topic)


def delete_lessons(skill: str, topic: str) -> None:
    """Admin-facing delete of a topic's cached lesson plan (the ordered
    title list), separate from and in addition to deleting that
    topic's/lessons' cached AI notes via generated_content_routes.py.
    Deleting only the notes leaves this doc in place, which is why the
    OLD lesson list kept showing on the site after an admin deleted
    "generated content" — this is the endpoint that actually clears
    it, so get_lessons() regenerates a fresh list on the next request."""
    db = get_firestore_client()
    repo.delete_lesson_plan(db, skill, topic)


def get_lesson_content(skill: str, topic: str, lesson_title: str, focus_band: str) -> dict:
    """One lesson's actual page — theory notes + resources, via the
    existing per-topic content pipeline scoped to this lesson's
    composite key. Raises LearningContentError on failure, same as
    get_topic_package() itself — deliberately not caught/wrapped here so
    callers see the exact same error type either way."""
    composite_topic = Lesson.composite_topic_key(topic, lesson_title)
    return get_topic_package(skill, composite_topic, focus_band)
