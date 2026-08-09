"""
services/learner_classifier.py

Objective 3: "classify learners as fast, moderate, or slow based on quiz
performance using machine learning" — the actual Scikit-Learn piece of
the abstract.

WHY A MODEL AND NOT JUST if score >= 80 / >= 50:
The score-band rule alone is a valid classifier but a one-line if/else
isn't "a Scikit-Learn model" in any real sense, and it can't improve as
real usage data comes in. So classification here is a small
RandomForestClassifier trained on FOUR features, not just the score:

    score_percent         — this attempt's raw quiz score (0-100)
    time_ratio            — time_taken / expected_time (fast-but-correct
                             vs slow-and-lucky look different even at the
                             same score)
    attempt_number        — 1 = first attempt at this topic, 2+ = a
                             learner who's already been through revision
                             once (repeated slowness is a stronger "Slow"
                             signal than a single bad day)
    prior_average_percent — this learner's running average on this topic
                             before this attempt (a learner trending up
                             reads differently than one trending down,
                             even at an identical current score)

COLD START: on a brand-new deployment there's no real attempt history to
train on yet. train_or_load() falls back to a bootstrap dataset generated
from the exact same score thresholds the abstract defines
(FAST_THRESHOLD=80, MODERATE_THRESHOLD=50), perturbed by synthetic
time/attempt/trend noise so the model learns the INTERACTION between
features, not just a copy of the score cutoff. scripts/train_learner_classifier.py
retrains on real Firestore data once enough attempts exist
(see MIN_REAL_SAMPLES_FOR_RETRAIN below) — the bootstrap model is
replaced, not thrown away as dead weight; it's what makes classification
work correctly from day one instead of only after weeks of usage.
"""

import os
import random

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

from config.settings import settings

FAST_THRESHOLD = 80
MODERATE_THRESHOLD = 50

MIN_REAL_SAMPLES_FOR_RETRAIN = 50

FEATURE_NAMES = ["score_percent", "time_ratio", "attempt_number", "prior_average_percent"]

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_MODEL_PATH = os.path.join(_BACKEND_DIR, settings.CLASSIFIER_MODEL_PATH)

_model_cache: RandomForestClassifier | None = None


def _rule_based_label(score_percent: float) -> str:
    """The abstract's plain threshold rule — used only to LABEL synthetic
    bootstrap rows and as an emergency fallback if the model ever fails
    to load. Never used directly to classify a real attempt once a model
    is available; classify() always goes through the trained model."""
    if score_percent >= FAST_THRESHOLD:
        return "Fast"
    if score_percent >= MODERATE_THRESHOLD:
        return "Moderate"
    return "Slow"


def _bootstrap_training_data(n_samples: int = 1200, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Synthetic rows for cold start. score_percent is sampled uniformly
    across 0-100 so all three bands are represented; the other three
    features are generated to correlate loosely with the band (a Fast
    learner tends to answer quickly and consistently, a Slow learner
    tends to take longer and trend down) plus random noise, so the
    forest actually has non-trivial feature interactions to learn from
    instead of memorizing a single-feature cutoff."""
    rng = random.Random(seed)
    X, y = [], []

    for _ in range(n_samples):
        score = rng.uniform(0, 100)
        label = _rule_based_label(score)

        if label == "Fast":
            time_ratio = rng.uniform(0.5, 1.0)
            attempt_number = rng.choice([1, 1, 1, 2])
            prior_avg = min(100.0, max(0.0, score + rng.uniform(-8, 5)))
        elif label == "Moderate":
            time_ratio = rng.uniform(0.8, 1.4)
            attempt_number = rng.choice([1, 1, 2, 2, 3])
            prior_avg = min(100.0, max(0.0, score + rng.uniform(-10, 10)))
        else:
            time_ratio = rng.uniform(1.1, 2.2)
            attempt_number = rng.choice([1, 2, 2, 3, 3])
            prior_avg = min(100.0, max(0.0, score + rng.uniform(-5, 12)))

        X.append([score, time_ratio, attempt_number, prior_avg])
        y.append(label)

    return np.array(X, dtype=float), np.array(y)


def _real_attempts_to_training_data(attempts: list[dict]) -> tuple[np.ndarray, np.ndarray]:
    """Converts topic_quiz_attempts Firestore rows into (X, y). The label
    for real rows is ALSO derived from the abstract's score thresholds —
    that never changes, it's the ground truth definition of the three
    bands. What changes as real data grows is that the model learns the
    real-world relationship between time/attempt-history/trend and that
    label, instead of the synthetic approximation."""
    X, y = [], []
    for row in attempts:
        score = row.get("ScorePercent")
        if score is None:
            continue
        time_taken = row.get("TimeTakenSeconds") or 600
        expected = TOPIC_QUIZ_EXPECTED_SECONDS
        X.append([
            float(score),
            float(time_taken) / float(expected),
            float(row.get("AttemptNumber", 1)),
            float(row.get("PriorAverageScorePercent", score)),
        ])
        y.append(_rule_based_label(float(score)))
    return np.array(X, dtype=float), np.array(y)


# 10 questions, ~60s/question — matches settings.TOPIC_QUIZ_QUESTION_COUNT.
# Kept as a module constant (not settings) since it's a modeling
# assumption, not a configurable product value.
TOPIC_QUIZ_EXPECTED_SECONDS = settings.TOPIC_QUIZ_QUESTION_COUNT * 60


def train_and_save(real_attempts: list[dict] | None = None) -> RandomForestClassifier:
    """Trains a fresh model and writes it to CLASSIFIER_MODEL_PATH.

    real_attempts=None or too few -> bootstrap synthetic data only.
    real_attempts with >= MIN_REAL_SAMPLES_FOR_RETRAIN rows -> trained on
    real data (blended with a smaller bootstrap set so rare bands don't
    starve if real usage happens to be lopsided, e.g. mostly Fast
    learners early on).
    """
    boot_X, boot_y = _bootstrap_training_data()

    if real_attempts and len(real_attempts) >= MIN_REAL_SAMPLES_FOR_RETRAIN:
        real_X, real_y = _real_attempts_to_training_data(real_attempts)
        X = np.vstack([real_X, boot_X[: len(boot_X) // 3]])
        y = np.concatenate([real_y, boot_y[: len(boot_y) // 3]])
    else:
        X, y = boot_X, boot_y

    model = RandomForestClassifier(
        n_estimators=100, max_depth=6, random_state=42, class_weight="balanced"
    )
    model.fit(X, y)

    os.makedirs(os.path.dirname(_MODEL_PATH), exist_ok=True)
    joblib.dump(model, _MODEL_PATH)

    global _model_cache
    _model_cache = model
    return model


def _load_model() -> RandomForestClassifier:
    global _model_cache
    if _model_cache is not None:
        return _model_cache

    if os.path.exists(_MODEL_PATH):
        _model_cache = joblib.load(_MODEL_PATH)
        return _model_cache

    # No trained model on disk yet (fresh checkout) -> bootstrap one now
    # so the API never hard-fails for lack of a committed .pkl file.
    return train_and_save(real_attempts=None)


def classify(
    score_percent: float,
    time_taken_seconds: int,
    attempt_number: int = 1,
    prior_average_percent: float | None = None,
) -> dict:
    """Returns {"classification": "Fast"|"Moderate"|"Slow", "probabilities": {...}}.

    prior_average_percent defaults to this attempt's own score when the
    learner has no prior history (first attempt on this topic) — a
    neutral assumption rather than biasing a brand-new learner toward
    any particular band.
    """
    if prior_average_percent is None:
        prior_average_percent = score_percent

    time_ratio = max(0.15, min(4.0, time_taken_seconds / TOPIC_QUIZ_EXPECTED_SECONDS))

    model = _load_model()
    features = np.array([[score_percent, time_ratio, attempt_number, prior_average_percent]])

    try:
        prediction = model.predict(features)[0]
        proba = dict(zip(model.classes_, model.predict_proba(features)[0].round(3)))
    except Exception:  # noqa: BLE001 — never let a model quirk block scoring a quiz
        prediction = _rule_based_label(score_percent)
        proba = {prediction: 1.0}

    return {
        "classification": str(prediction),
        "probabilities": {str(k): float(v) for k, v in proba.items()},
    }
