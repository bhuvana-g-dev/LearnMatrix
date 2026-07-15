"""
services/difficulty_engine.py

Difficulty Engine — decides the difficulty level fed into the Question
Generation Agent (and, later, the Assessment Planner Agent's plan).

Deliberately NOT an LLM call: difficulty should be fast, free, and
explainable ("why did I get Hard questions?" needs a real answer, not a
black box). It's a rule-based weighted score today; the function
signature is designed so it can be swapped for a proper IRT (Item
Response Theory) or ML model later without changing any caller.

Signals (per the architecture gap this fills):
  - previous_score:   0-100, most recent or rolling average quiz score
  - time_taken_ratio:  actual time / expected time per question
                        (< 1.0 = faster than expected, > 1.0 = slower)
  - confidence:        0-100, self-reported or inferred
  - mistake_rate:      0-100, % of recent questions answered incorrectly

Output: one of settings.VALID_DIFFICULTIES ("Easy" | "Medium" | "Hard"),
plus a `reasoning` string so the frontend/admin can show *why*.
"""

from dataclasses import dataclass

from config.settings import settings

# Weights sum to 1.0. Score and mistake rate matter most; confidence and
# speed are secondary signals that nudge, not dominate, the decision.
WEIGHT_SCORE = 0.40
WEIGHT_MISTAKES = 0.25
WEIGHT_CONFIDENCE = 0.20
WEIGHT_SPEED = 0.15

HARD_THRESHOLD = 70
MEDIUM_THRESHOLD = 40


@dataclass
class DifficultyDecision:
    difficulty: str
    readiness_score: float  # 0-100, the raw composite before thresholding
    reasoning: str


def _speed_component(time_taken_ratio: float) -> float:
    """
    Converts a time ratio into a 0-100 readiness contribution.
    Answering faster than expected (ratio < 1.0) with no penalty for
    accuracy already being handled by mistake_rate) suggests readiness
    for harder questions; much slower suggests the opposite.
    Clamped so one extreme outlier (e.g. ratio=10 from an idle tab)
    can't swing the whole decision.
    """
    ratio = max(0.2, min(time_taken_ratio, 3.0))
    # ratio 0.2 (very fast) -> 100, ratio 1.0 (on pace) -> 60, ratio 3.0 (slow) -> 0
    return max(0.0, min(100.0, 100 - ((ratio - 0.2) / (3.0 - 0.2)) * 100))


def compute_difficulty(
    previous_score: float,
    time_taken_seconds: float,
    expected_time_seconds: float,
    confidence: float,
    mistake_rate: float,
) -> DifficultyDecision:
    """
    All inputs are 0-100 except the two time values (raw seconds).
    Pass expected_time_seconds=0 to skip the speed signal entirely
    (e.g. first attempt ever, no baseline yet) — it's re-weighted across
    the remaining three signals rather than defaulting to a fake value.
    """
    previous_score = max(0.0, min(previous_score, 100.0))
    confidence = max(0.0, min(confidence, 100.0))
    mistake_rate = max(0.0, min(mistake_rate, 100.0))

    accuracy_component = 100 - mistake_rate

    if expected_time_seconds > 0:
        ratio = time_taken_seconds / expected_time_seconds
        speed = _speed_component(ratio)
        composite = (
            WEIGHT_SCORE * previous_score
            + WEIGHT_MISTAKES * accuracy_component
            + WEIGHT_CONFIDENCE * confidence
            + WEIGHT_SPEED * speed
        )
        speed_note = f"speed factor {speed:.0f}/100 (time ratio {ratio:.2f}), "
    else:
        # Re-normalize weights across the remaining 3 signals (no baseline
        # time to compare against yet — e.g. this student's first quiz).
        total_weight = WEIGHT_SCORE + WEIGHT_MISTAKES + WEIGHT_CONFIDENCE
        composite = (
            WEIGHT_SCORE * previous_score
            + WEIGHT_MISTAKES * accuracy_component
            + WEIGHT_CONFIDENCE * confidence
        ) / total_weight
        speed_note = "no time baseline yet, "

    if composite >= HARD_THRESHOLD:
        difficulty = "Hard"
    elif composite >= MEDIUM_THRESHOLD:
        difficulty = "Medium"
    else:
        difficulty = "Easy"

    reasoning = (
        f"readiness {composite:.0f}/100 -> {difficulty} "
        f"(score {previous_score:.0f}, accuracy {accuracy_component:.0f}, "
        f"confidence {confidence:.0f}, {speed_note}"
        f"thresholds: Hard>={HARD_THRESHOLD}, Medium>={MEDIUM_THRESHOLD})"
    )

    return DifficultyDecision(
        difficulty=difficulty,
        readiness_score=round(composite, 1),
        reasoning=reasoning,
    )
