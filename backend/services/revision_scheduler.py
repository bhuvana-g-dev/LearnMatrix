"""
services/revision_scheduler.py

Objective 4 ("adaptive revision schedule using spaced repetition"): turns
a Fast/Moderate/Slow classification into a concrete next-retest date.

Kept as its own tiny module (not folded into learner_classifier.py or
topic_quiz_service.py) for the same reason services/focus_band.py is
separate — "given X, what date/band applies" is pure, easily-tested
logic that has nothing to do with HOW X was decided (the classifier) or
WHAT happens with the result (the service/route). Every learner gets a
next_review_date on every attempt — Fast learners just get a longer one,
not none — matching the abstract's "test every 7/5/3 days" wording,
which schedules the NEXT test for everyone, not only for those who
scored low.
"""

from datetime import date, timedelta

from config.settings import settings

VALID_CLASSIFICATIONS = tuple(settings.REVISION_INTERVAL_DAYS.keys())  # ("Fast","Moderate","Slow")


def compute_next_review_date(classification: str, from_date: date | None = None) -> str:
    """Returns 'YYYY-MM-DD'. Unknown classification defaults to the most
    cautious interval (Slow) rather than raising — a bad label should
    never leave a learner with NO scheduled revision."""
    interval_days = settings.REVISION_INTERVAL_DAYS.get(
        classification, settings.REVISION_INTERVAL_DAYS["Slow"]
    )
    base = from_date or date.today()
    return (base + timedelta(days=interval_days)).isoformat()
