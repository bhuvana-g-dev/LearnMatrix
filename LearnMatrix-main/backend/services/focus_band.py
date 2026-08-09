"""
services/focus_band.py

Shared "focus band" computation — given a skill's Easy/Medium/Hard
breakdown, decides which of four bands (fundamentals / application /
advanced / polish) best describes what's actually weak.

Extracted out of services/roadmap_service.py (where this logic
originated) so services/syllabus_compression_service.py can reuse the
exact same reasoning when deciding what a learner's NEXT topic within
a skill should focus on — a learner who's Strong overall but shaky on
Hard questions needs the same "advanced" framing whether we're talking
about a whole skill (roadmap) or a single topic inside it (compression).

Bands, in the order checked:
    fundamentals -> even Easy questions are shaky; start from scratch
    application   -> Easy is fine, Medium isn't; can define but can't use it
    advanced      -> Easy+Medium fine, Hard isn't; edge cases/advanced usage
    polish        -> everything reasonably solid; just needs consistency

Message text for each band lives with whoever renders it to the
learner (roadmap_service.FOCUS_BAND_MESSAGES for skill-level messaging,
syllabus_compression_service for topic-level messaging) — this module
only decides WHICH band applies, not what to say about it.
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
