"""
services/learning_path.py

Maps a learner's INITIAL ASSESSMENT tier (RoadmapEntry.current_level,
see services/roadmap_service.py — one of "Weak" | "Intermediate" |
"Strong" | "Not Attempted" | "Not Assessed") to the ordered sequence of
content bands that learner's path includes for a skill.

This is deliberately the ONLY thing that decides band inclusion for a
learning path. It does NOT read topic-quiz mastery
(services/focus_band.py's determine_content_level) — that logic stays
scoped to its existing per-attempt use and is not consulted here. Each
band in the sequence is still generated/cached completely independently
per (skill, topic, band) via the existing
services/learning_content_service.get_topic_package() — nothing about
how a band's content or articles are produced changes; this module only
decides WHICH bands a given learner walks through, in what order.

"Not Attempted" and "Not Assessed" learners get the full ladder, same
as "Weak" — there's no diagnostic signal yet that they know anything,
so the safe default is to start from fundamentals, same reasoning
roadmap_service.py already applies via NOT_ASSESSED_STARTING_FOCUS_BAND.
"""

ALL_BANDS = ["fundamentals", "application", "advanced", "polish"]

TIER_BAND_SEQUENCE: dict[str, list[str]] = {
    "Weak": ["fundamentals", "application", "advanced", "polish"],
    "Intermediate": ["application", "advanced", "polish"],
    "Strong": ["advanced", "polish"],
    "Not Attempted": ["fundamentals", "application", "advanced", "polish"],
    "Not Assessed": ["fundamentals", "application", "advanced", "polish"],
}


class LearningPathError(Exception):
    pass


def get_band_sequence(current_level: str) -> list[str]:
    """Returns the ordered band list for this tier. Unknown/unexpected
    `current_level` values fall back to the full ladder (same
    conservative default as the "Not Attempted"/"Not Assessed" rows
    above) rather than raising — a learning path should never come back
    empty just because of an unfamiliar label."""
    return TIER_BAND_SEQUENCE.get(current_level, ALL_BANDS)


def build_learning_path(uid: str, skill: str, topic: str) -> dict:
    """
    Assembles the full learning path for one (uid, skill, topic):
    looks up this learner's saved roadmap entry for `skill` to read
    their initial-assessment current_level, resolves that to a band
    sequence via get_band_sequence(), then fetches one already-existing
    Topic Package (services/learning_content_service.get_topic_package)
    per band in that sequence — each package keeps generating/caching
    exactly as it does today, completely independent of this learner or
    any other. This function only decides which bands to fetch and in
    what order; it never touches how a single band's content is built.

    Raises LearningPathError if the learner has no saved roadmap yet
    (roadmap_service.load_saved_roadmap returns None — they haven't
    taken the diagnostic assessment) or if `skill` isn't one of the
    entries on their roadmap.
    """
    from services.roadmap_service import load_saved_roadmap
    from services.learning_content_service import get_topic_package, LearningContentError

    roadmap = load_saved_roadmap(uid)
    if roadmap is None:
        raise LearningPathError(
            "No roadmap found for this learner yet — take the diagnostic assessment first."
        )

    entry = next((e for e in roadmap.get("entries", []) if e.get("skill") == skill), None)
    if entry is None:
        raise LearningPathError(f"'{skill}' is not on this learner's roadmap.")

    current_level = entry.get("currentLevel")
    band_sequence = get_band_sequence(current_level)

    sessions = []
    for band in band_sequence:
        try:
            package = get_topic_package(skill=skill, topic=topic, focus_band=band)
        except LearningContentError as exc:
            raise LearningPathError(
                f"Couldn't build the '{band}' session for '{skill} / {topic}': {exc}"
            ) from exc
        sessions.append(package)

    return {
        "skill": skill,
        "topic": topic,
        "currentLevel": current_level,
        "bandSequence": band_sequence,
        "sessions": sessions,  # one Topic Package per band, in walk-through order
    }
