"""
services/focus_band.py

Shared "focus band" computation — two related but distinct decisions
live here:

  1. determine_focus_band(breakdown) — the ORIGINAL, skill-level
     waterfall (Easy<50 -> fundamentals, elif Medium<50 -> application,
     elif Hard<50 -> advanced, else polish). Still used exactly as
     before by roadmap_service.py (whole-skill diagnostic) and
     syllabus_compression_service.py (what a learner's NEXT topic in a
     skill should focus on). NOT used for topic-quiz content anymore —
     see #2.

  2. calculate_topic_mastery() / determine_content_level() /
     identify_weak_area() — the TOPIC-QUIZ decision
     (backend/services/topic_quiz_service.py), one attempt at a time:

         Topic Quiz
            |
         Easy / Medium / Hard performance
            |
         Topic Mastery %  +  Weak Area
            |
         Content Decision

     Two separate axes, on purpose:
       - Topic Mastery % -> WHICH content level to generate
         (foundation / application / advanced / polish) — depth of the
         material.
       - Weak Area -> WHAT kind of practice to emphasize within that
         level (fundamentals / application / advanced-reasoning) — even
         a "polish"-level learner still has a lowest-scoring tier worth
         calling out.

     Deliberately does NOT use Fast/Moderate/Slow (services/
     learner_classifier.py) — that classification only ever drives
     revision pacing (services/revision_scheduler.py), never content.
"""


def determine_focus_band(breakdown: dict[str, dict[str, int]]) -> str:
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


def calculate_topic_mastery(correct: int, total: int) -> float:
    """Topic Mastery % for ONE topic quiz attempt — correct answers over
    total questions, across all difficulties combined. This is the
    single number determine_content_level() below thresholds against."""
    return round((correct / total) * 100, 1) if total else 0.0


def determine_content_level(mastery_percent: float) -> str:
    """
    Topic Mastery % -> content level. This is the ONLY thing that
    decides how deep/shallow the generated content is — same topic,
    different mastery, different level:

        < 40  -> "fundamentals"  (FOUNDATION: basic concepts, step-by-step,
                                   simple examples, easy practice)
        < 70  -> "application"   (APPLICATION)
        < 85  -> "advanced"      (ADVANCED)
        else  -> "polish"        (POLISH: edge cases, complex examples,
                                   real-world problems, hard practice)

    Values match the existing fundamentals/application/advanced/polish
    vocabulary (frontend's FOCUS_BAND_LABELS, learningContentService.py)
    so nothing downstream needs to change to understand this string —
    only the mastery-based THRESHOLDS deciding it are new.
    """
    if mastery_percent < 40:
        return "fundamentals"
    if mastery_percent < 70:
        return "application"
    if mastery_percent < 85:
        return "advanced"
    return "polish"


def identify_weak_area(breakdown: dict[str, dict[str, int]]) -> str | None:
    """
    The SECOND axis: which difficulty tier is this attempt's weakest
    point, in Easy -> Medium -> Hard priority (fix fundamentals before
    application, application before advanced reasoning). Returns the
    first tier that isn't a clean 100%, or None if all three are.

    This intentionally checks "< 100", not "< 50" — a learner who's
    100/100/67 (Easy/Medium/Hard) has no ABSOLUTE weakness (nothing
    below 50%) but still has a clear RELATIVE one worth naming: Hard.
    That's what lets a "polish"-level learner still get an "advanced
    reasoning" callout instead of a bare "you're doing great, nothing
    to report."
    """
    def accuracy(level: str) -> float:
        band = breakdown.get(level, {"correct": 0, "total": 0})
        return (band["correct"] / band["total"] * 100) if band["total"] else 100.0

    for level, label in (("Easy", "fundamentals"), ("Medium", "application"), ("Hard", "advanced")):
        if accuracy(level) < 100:
            return label
    return None
