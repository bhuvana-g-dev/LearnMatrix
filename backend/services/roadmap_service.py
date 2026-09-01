"""
services/roadmap_service.py

Roadmap Agent (#9 in ARCHITECTURE.md).

Responsibility: given the Evaluation Agent's skill-wise breakdown
(services/evaluation_service.py), produce the student's FULL course
roadmap — every selected skill, not just the weak ones. Skills already
at "Strong" level are included as already-completed/mastered entries
(status="mastered"), so the roadmap represents the whole journey — what
they've already earned, not only what's left. Skills needing work are
scheduled week-by-week (status="upcoming"), worst first.

WHY THIS CHANGED from an earlier version that excluded Strong skills
entirely: a roadmap that only ever shows the remedial slice looks thin
and demoralizing for anyone with even one strong skill, and doesn't
answer "how far am I through the whole course" — which is the actual
point of a roadmap. Including mastered skills as completed entries lets
completionPercent start above 0% immediately (a student Strong in 2 of
5 skills has legitimately already finished 40% of the course before
touching a single upcoming week), and gives students something to see
progress against beyond "you have 3 weak skills to fix".

ROLE-DRIVEN CURRICULUM (this revision): generate_roadmap() now accepts
an optional `role_skills` — the learner's FULL role skill list (see
services/skill_topic_service.get_syllabus_for_role). This is the core
LearnMatrix rule: the SELECTED ROLE decides which skills belong on the
roadmap, not which skills the learner happened to claim/assess.
Claiming a skill only means "verify what I already know" for scoring —
it never means "only show me this". Any role skill missing from the
evaluation becomes its own status="not_assessed" entry (full syllabus,
starts at topic 1, no week assigned yet) instead of silently vanishing
from the roadmap. Omit `role_skills` (e.g. the role isn't seeded in
data/skill_syllabus_seed.py yet) and this falls back to the original
assessed-skills-only behavior — same shape, just a narrower skill set.

MODULE GROUPING (this revision): generate_roadmap() now also accepts
optional `role_categories` — the {category: [skills]} mapping from
data/role_skill_categories.py — used purely to tag each entry with
which "module" it belongs to (e.g. "Frontend", "Backend", "Database",
"Tools" for the fullstack role) so the frontend can group the roadmap
into Module 1, Module 2, ... instead of one flat list. This is
DISPLAY-ONLY: it changes nothing about how a skill is classified
mastered/upcoming/not_assessed or how weeks are numbered — it only adds
a `module` tag to each entry. Omit it and every entry's module is None,
which the frontend treats as "no module grouping, render as before".

DESIGN DECISION (unchanged): still deliberately rule-based, NOT an LLM
call — the question "which skill needs work first" doesn't need a
language model, it needs the diagnostic data already in hand. See the
original docstring reasoning (instant, no external dependency to fail,
fully explainable) — none of that changes with this restructure.
"""

from dataclasses import dataclass, field

from services.focus_band import determine_focus_band

NEEDS_WORK_LEVELS = ["Not Attempted", "Weak", "Intermediate"]
LEVEL_PRIORITY_RANK = {"Not Attempted": 0, "Weak": 1, "Intermediate": 2}

FOCUS_BAND_MESSAGES = {
    "fundamentals": "Even the basics need work — start from the fundamentals before moving on.",
    "application": "Basics are solid, but applying them (predicting output, spotting bugs) needs practice.",
    "advanced": "Fundamentals and application are solid — focus on edge cases and advanced usage.",
    "polish": "Overall solid, but not yet consistent — a quick revision pass should be enough.",
}

MASTERED_MESSAGE = "Already mastered on your diagnostic assessment — no scheduled study, just quick revision if you want it."
NOT_ASSESSED_MESSAGE = "Part of your role's curriculum, but not assessed yet — full syllabus starting from Topic 1 once you get here."

# Simple, explainable pace label — NOT a different visual theme per
# learner (that would mean maintaining multiple UIs), just an honest,
# encouraging framing of the SAME roadmap structure that matches how
# much ground is actually left to cover.
PACE_FAST_TRACK = "Fast-Track"
PACE_STEADY = "Steady & Thorough"


@dataclass
class RoadmapEntry:
    order: int
    skill: str
    current_level: str  # "Strong" | "Intermediate" | "Weak" | "Not Attempted" | "Not Assessed"
    score_percent: float | None  # None for status="not_assessed" — never measured
    status: str  # "mastered" | "upcoming" | "not_assessed"
    week: int | None  # None for mastered/not_assessed entries — they're not "scheduled"
    focus_band: str | None  # starting band for every entry (see MASTERED/NOT_ASSESSED_STARTING_FOCUS_BAND) — only None if truly undetermined
    recommendation: str
    module: str | None = None  # e.g. "Frontend", "Backend" — None when role_categories wasn't provided

    def to_dict(self) -> dict:
        return {
            "order": self.order,
            "skill": self.skill,
            "currentLevel": self.current_level,
            "scorePercent": self.score_percent,
            "status": self.status,
            "week": self.week,
            "focusBand": self.focus_band,
            "recommendation": self.recommendation,
            "module": self.module,
        }


@dataclass
class Roadmap:
    entries: list[RoadmapEntry] = field(default_factory=list)
    total_skills: int = 0
    mastered_count: int = 0
    upcoming_count: int = 0
    not_assessed_count: int = 0  # role skills never claimed/assessed — still on the roadmap
    total_weeks: int = 0  # upcoming weeks + project week — weeks still AHEAD
    includes_project_week: bool = False
    pace_label: str = PACE_STEADY
    course_completion_percent: float = 0.0  # mastered / total, BEFORE any upcoming week is completed
    module_order: list[str] = field(default_factory=list)  # category names in display order, [] if ungrouped

    def to_dict(self) -> dict:
        return {
            "entries": [e.to_dict() for e in self.entries],
            "totalSkills": self.total_skills,
            "masteredCount": self.mastered_count,
            "upcomingCount": self.upcoming_count,
            "notAssessedCount": self.not_assessed_count,
            "totalWeeks": self.total_weeks,
            "includesProjectWeek": self.includes_project_week,
            "paceLabel": self.pace_label,
            "courseCompletionPercent": self.course_completion_percent,
            "moduleOrder": self.module_order,
        }


def generate_roadmap(
    evaluation: dict,
    role_skills: list[str] | None = None,
    role_categories: dict[str, list[str]] | None = None,
) -> Roadmap:
    """
    evaluation: {"skills": [...], "overall": {...}} from
    services/evaluation_service.py.

    role_skills (optional): the learner's FULL role skill list
    (services/skill_topic_service.get_syllabus_for_role, or
    data/role_skill_categories.get_role_skill_list). When provided,
    THIS — not evaluation["skills"] — decides which skills appear and
    how many total_skills the roadmap covers. Any role skill that was
    never claimed/assessed still gets its own status="not_assessed"
    entry so it never silently disappears from the roadmap. Skills that
    WERE assessed are still classified mastered/upcoming exactly as
    before — role_skills only widens the set, it never changes how an
    assessed skill's own result is read.

    Omit role_skills (role not seeded yet) and this is the original
    behavior: only assessed skills appear, total_skills = count of those.

    role_categories (optional): {category: [skills]} — tags each entry
    with a `module` field and populates the roadmap's `moduleOrder` for
    grouped display. Purely a display tag; doesn't affect classification.

    "Strong" skills become status="mastered" (no week assigned).
    Everything else assessed becomes status="upcoming", sorted
    worst-first (level priority, then score ascending) and assigned
    sequential week numbers. A "Mini Project" week is added whenever
    there's more than one upcoming skill. Never-assessed role skills are
    appended last as status="not_assessed" — not part of the scheduled
    week timeline since there's no diagnostic data yet to sequence them
    by severity.
    """
    assessed_by_skill = {s["skill"]: s for s in evaluation["skills"]}

    if role_skills is not None:
        assessed_skills = [assessed_by_skill[sk] for sk in role_skills if sk in assessed_by_skill]
        not_assessed_skills = [sk for sk in role_skills if sk not in assessed_by_skill]
        total_skills = len(role_skills)
    else:
        assessed_skills = list(evaluation["skills"])
        not_assessed_skills = []
        total_skills = len(assessed_skills)

    # STARTING FOCUS BAND FOR MASTERED / NOT-ASSESSED (this revision):
    # these two used to both leave focus_band=None, which meant the
    # frontend's DEFAULT_FOCUS_BAND ("application") applied to BOTH —
    # so a learner who scored 100% on the CSS3 diagnostic and a learner
    # who never touched CSS3 at all got served the identical cached
    # notes + primary video for every topic until they separately took
    # that topic's own quiz. That's wrong on its face: these are
    # opposite ends of the spectrum, not a shared "average" case.
    # MASTERED -> "advanced": they already know the fundamentals, no
    # need to force them back through a beginner's explanation, but
    # unlike a formal deep-dive there's still room above it ("polish")
    # for anyone who wants it.
    # NOT_ASSESSED -> "fundamentals": a role skill the learner never
    # claimed/tested is, by definition, unproven — same “start from
    # scratch” treatment a Weak/Not-Attempted diagnostic result gets.
    # Both remain only STARTING points — see buildCourseNavigator.js's
    # per-topic focus_band, which still overrides this the moment the
    # learner takes that specific topic's own quiz.
    MASTERED_STARTING_FOCUS_BAND = "advanced"
    NOT_ASSESSED_STARTING_FOCUS_BAND = "fundamentals"

    mastered = [s for s in assessed_skills if s["level"] == "Strong"]
    needs_work = [s for s in assessed_skills if s["level"] in NEEDS_WORK_LEVELS]
    needs_work.sort(key=lambda s: (LEVEL_PRIORITY_RANK[s["level"]], s["scorePercent"]))

    skill_to_module: dict[str, str] = {}
    if role_categories:
        for category, skills in role_categories.items():
            for sk in skills:
                skill_to_module[sk] = category

    entries: list[RoadmapEntry] = []
    order = 1
    for s in mastered:
        entries.append(
            RoadmapEntry(
                order=order, skill=s["skill"], current_level=s["level"],
                score_percent=s["scorePercent"], status="mastered",
                week=None, focus_band=MASTERED_STARTING_FOCUS_BAND, recommendation=MASTERED_MESSAGE,
                module=skill_to_module.get(s["skill"]),
            )
        )
        order += 1

    for i, s in enumerate(needs_work):
        focus_band = determine_focus_band(s["breakdown"])
        entries.append(
            RoadmapEntry(
                order=order, skill=s["skill"], current_level=s["level"],
                score_percent=s["scorePercent"], status="upcoming",
                week=i + 1, focus_band=focus_band,
                recommendation=FOCUS_BAND_MESSAGES[focus_band],
                module=skill_to_module.get(s["skill"]),
            )
        )
        order += 1

    for sk in not_assessed_skills:
        entries.append(
            RoadmapEntry(
                order=order, skill=sk, current_level="Not Assessed",
                score_percent=None, status="not_assessed",
                week=None, focus_band=NOT_ASSESSED_STARTING_FOCUS_BAND, recommendation=NOT_ASSESSED_MESSAGE,
                module=skill_to_module.get(sk),
            )
        )
        order += 1

    includes_project_week = len(needs_work) > 1
    upcoming_weeks = len(needs_work) + (1 if includes_project_week else 0)

    mastered_count = len(mastered)
    not_assessed_count = len(not_assessed_skills)
    # Continuous, not binary: an assessed-but-not-mastered skill's own
    # diagnostic score contributes its real share here (e.g. an
    # Intermediate skill at 47% counts as 47%, not 0%) instead of only
    # fully-mastered skills counting toward completion. Keeps this
    # starting value on the same footing as
    # recompute_mastery_after_topic_progress()'s _skill_progress_fraction,
    # which continues this same continuous accounting once topic quizzes
    # start coming in — see that function's docstring for the full
    # rationale (avoids the number reading as "stuck at 0%" for a
    # legitimately-progressing learner).
    skill_percents = (
        [100.0] * mastered_count
        + [s["scorePercent"] for s in needs_work]
        + [0.0] * not_assessed_count
    )
    course_completion_percent = round(
        (sum(skill_percents) / total_skills) if total_skills else 0.0, 1
    )

    # Pace framing: mostly-mastered-already reads as "fast track" (short
    # sprint left); mostly-still-to-learn reads as "steady, thorough
    # path" — same roadmap structure either way, just an honest label
    # that matches how much is actually ahead, not a different UI.
    pace_label = PACE_FAST_TRACK if (mastered_count / total_skills if total_skills else 0) >= 0.5 else PACE_STEADY

    return Roadmap(
        entries=entries,
        total_skills=total_skills,
        mastered_count=mastered_count,
        upcoming_count=len(needs_work),
        not_assessed_count=not_assessed_count,
        total_weeks=upcoming_weeks,
        includes_project_week=includes_project_week,
        pace_label=pace_label,
        course_completion_percent=course_completion_percent,
        module_order=list(role_categories.keys()) if role_categories else [],
    )


# ---------------------------------------------------------------------------
# Persistence orchestration — everything above this line is the pure Roadmap
# Agent (generate_roadmap) with zero Firestore dependency.
# ---------------------------------------------------------------------------

from firebase.firebase_config import get_firestore_client
from services.roadmap_repository import save_roadmap as _save_roadmap, get_roadmap as _get_roadmap


def resolve_role_skills(role_id: str | None) -> list[str] | None:
    """
    Returns the full skill list for a role, or None if role_id is
    empty/unrecognized anywhere. Two sources, tried in order:

      1. Topic-seeded syllabus (services/skill_topic_service.py, backed
         by data/skill_syllabus_seed.py) — currently "frontend" only,
         but when available also unlocks the topic-level Verified/
         Current/Locked expand view via compressedSyllabus.
      2. data/role_skill_categories.py — covers ALL 8 roles (mirrors
         frontend/src/constants/skills.js), just without per-topic
         detail. This is what makes "every role skill appears on the
         roadmap" true for every role today, not just frontend.

    None only when NEITHER source recognizes role_id — the same
    fallback as never passing a role_id at all, never an error.
    """
    if not role_id:
        return None

    from services.skill_topic_service import get_syllabus_for_role, SkillTopicError

    db = get_firestore_client()
    try:
        role_syllabus = get_syllabus_for_role(db, role_id)
        return [s["skill"] for s in role_syllabus["skills"]]
    except SkillTopicError:
        pass

    from data.role_skill_categories import get_role_skill_list

    return get_role_skill_list(role_id)


def resolve_role_categories(role_id: str | None) -> dict[str, list[str]] | None:
    """{category: [skills]} for module-grouped display — see
    data/role_skill_categories.py. None if role_id isn't recognized
    there, in which case the roadmap renders ungrouped (unchanged
    behavior), same fallback pattern as resolve_role_skills."""
    if not role_id:
        return None
    from data.role_skill_categories import get_role_categories

    return get_role_categories(role_id)


def _compressed_syllabus_or_none(role_id: str | None, role_skills: list[str] | None, evaluation: dict) -> dict | None:
    """
    Only computed when a role was actually resolved AND has topic-level
    seed data (data/skill_syllabus_seed.py — currently "frontend" only).

    IMPORTANT: role_skills being non-None is no longer a safe proxy for
    "topic-seed data exists" — resolve_role_skills() now also succeeds
    via data/role_skill_categories.py for roles that have NO topic seed
    at all (e.g. "fullstack"). So this still has to actually try the
    topic-seeded call and catch SkillTopicError itself, exactly like
    resolve_role_skills() does — same "seeded role or silently skip"
    rule, just re-applied here because get_compressed_role_syllabus()
    hits get_syllabus_for_role() again internally.
    """
    if not role_id or role_skills is None:
        return None

    from services.skill_topic_service import SkillTopicError
    from services.syllabus_compression_service import get_compressed_role_syllabus

    db = get_firestore_client()
    try:
        return get_compressed_role_syllabus(db, role_id, evaluation)
    except SkillTopicError:
        return None


def generate_and_save_roadmap(uid: str, role: str, evaluation: dict, role_id: str | None = None) -> dict:
    role_skills = resolve_role_skills(role_id)
    role_categories = resolve_role_categories(role_id)
    roadmap = generate_roadmap(evaluation, role_skills=role_skills, role_categories=role_categories)
    compressed_syllabus = _compressed_syllabus_or_none(role_id, role_skills, evaluation)

    db = get_firestore_client()
    return _save_roadmap(
        db, uid, role, roadmap.to_dict(),
        role_id=role_id, compressed_syllabus=compressed_syllabus,
    )


def generate_roadmap_preview(evaluation: dict, role_id: str | None = None) -> dict:
    """
    Non-persisted counterpart to generate_and_save_roadmap() — used when
    no uid is provided (e.g. quick testing). Still role-driven and still
    includes compressedSyllabus in the response so the shape matches the
    persisted path exactly; it just never touches the `roadmaps`
    collection.
    """
    role_skills = resolve_role_skills(role_id)
    role_categories = resolve_role_categories(role_id)
    roadmap = generate_roadmap(evaluation, role_skills=role_skills, role_categories=role_categories)
    roadmap_dict = roadmap.to_dict()
    roadmap_dict["compressedSyllabus"] = _compressed_syllabus_or_none(role_id, role_skills, evaluation)
    return roadmap_dict


def recompute_all_mastery(uid: str) -> dict | None:
    """
    Re-runs recompute_mastery_after_topic_progress() for EVERY skill on
    the learner's saved roadmap, not just one.

    Why this exists: that function only fires as a side-effect of
    submit_topic_quiz() — i.e. it only re-evaluates a skill the moment a
    NEW quiz comes in. Progress completed BEFORE a mastery-logic change
    ships (e.g. the min()->average() change in this same function) has
    no new quiz event to trigger a re-check with the new rule, so it
    stays stuck showing the OLD verdict forever even though the
    underlying Firestore attempts already qualify. This walks every
    entry once so a learner's existing history gets re-judged under
    current logic without needing to retake anything.
    Called from GET /api/roadmap/<uid>/recompute (routes/roadmap_routes.py).
    """
    db = get_firestore_client()
    roadmap = _get_roadmap(db, uid)
    if not roadmap:
        return None

    result = None
    for entry in roadmap.get("entries", []):
        result = recompute_mastery_after_topic_progress(uid=uid, skill=entry.get("skill")) or result
    return result


def load_saved_roadmap(uid: str) -> dict | None:
    db = get_firestore_client()
    return _get_roadmap(db, uid)


# ---------------------------------------------------------------------------
# Post-diagnostic recompute — keeps masteredCount/courseCompletionPercent
# honest as the learner actually completes topic quizzes, instead of
# freezing them at whatever the one-time diagnostic assessment produced.
# See services/topic_quiz_service.py::submit_topic_quiz(), which calls this
# right after every topic quiz submission.
# ---------------------------------------------------------------------------

# Same bar evaluation_service.py uses for "Strong" on the diagnostic —
# kept identical so a skill mastered via topic quizzes means the same
# thing as a skill mastered on the original assessment. Used ONLY for
# the discrete "Skills Mastered X/Y" count/badge below — the Overall
# Progress % (course_completion_percent) is intentionally NOT gated on
# this threshold, see _skill_progress_fraction()'s docstring.
SKILL_MASTERY_THRESHOLD_PERCENT = 75

# Must match frontend/src/services/lessonService.js's compositeTopicKey()
# EXACTLY (same "—" em dash + spacing) — Learning Hub lesson quizzes
# submit under "{topic} — {lessonTitle}" as the Topic field (see
# CourseWorkspaceScreen.jsx), not the bare topic name a whole-topic
# Test uses. Without stripping this suffix back off, every lesson a
# learner passes inside the Learning Hub writes a Firestore progress
# row that _topic_effective_score() below would never match against
# get_topics_for_skill()'s plain topic names — i.e. studying lessons
# would silently never move Overall Progress at all, only the separate
# per-topic "Test" button would. This is exactly that fix.
_LESSON_COMPOSITE_INFIX = " — "


def _topic_effective_score(progress_rows: list[dict], topic: str, baseline: float) -> float:
    """
    One topic's effective score for progress purposes, folding together
    BOTH ways a learner can generate progress for it:
      - a direct whole-topic "Test" attempt (Topic field == topic exactly), and
      - one or more per-lesson quiz passes inside the Learning Hub
        (Topic field == "{topic} — {lessonTitle}", one row per lesson).
    All matching rows (whichever kind) are averaged together. Falls
    back to `baseline` (the skill's diagnostic scorePercent) when this
    topic has no rows of either kind yet — same "don't punish an
    untouched topic" behavior as before this existed.
    """
    prefix = f"{topic}{_LESSON_COMPOSITE_INFIX}"
    matches = [
        r for r in progress_rows
        if r.get("Topic") == topic or str(r.get("Topic", "")).startswith(prefix)
    ]
    if not matches:
        return baseline
    return sum(r.get("AverageScorePercent", baseline) for r in matches) / len(matches)


def _effective_topic_names(skill: str, seeded_topics: list, progress_rows: list[dict]) -> list[str]:
    """
    Which topic names to actually score progress against for `skill`.

    Normally this is just the seeded per-skill syllabus
    (services/skill_topic_service.get_topics_for_skill) — e.g. CSS3's 14
    seed topics (Introduction, Selectors, Colors, ...). BUT that seed
    list is only ever used by the frontend's topic tree when a
    `compressedSyllabus` was actually loaded for the learner's role
    (see syllabus_compression_service.get_compressed_role_syllabus,
    keyed off skill_topic_service.ROLE_SKILLS_BY_ROLE — today only the
    "frontend" role id is populated there). Whenever that lookup isn't
    available for the learner's role (e.g. role id "fullstack" has no
    entry yet), buildCourseNavigator.js's buildFlatTopicList() falls
    back to treating the WHOLE skill as a single topic (topic title ==
    skill name) — see its "Fallback for skills without topic-level seed
    data yet" comment — and every lesson quiz for that skill is then
    recorded with Topic == "{skill} — {lessonTitle}", not
    "{seed topic} — {lessonTitle}".

    Scoring strictly against the seed topic names in that situation
    means NONE of them ever get a matching progress row — a learner can
    finish every lesson in a skill with high scores and the skill still
    never crosses SKILL_MASTERY_THRESHOLD_PERCENT, because the progress
    was filed under the skill's own name instead. So: only use the
    seeded topic names if at least one of them actually has recorded
    progress; otherwise fall back to the skill name itself, mirroring
    the frontend's own fallback so the two can't disagree.
    """
    # NOTE: skill_topics documents use the field name "Title" (see
    # models/skill_topic_model.py), not "Topic" — this used to read
    # t["Topic"] here (and in the two call sites below, before they were
    # unified into this helper), which raised a KeyError on every real
    # seeded topic dict and meant this whole code path silently failed
    # (caught wherever recompute_mastery_after_topic_progress's caller
    # swallows errors) any time a skill actually had seed data.
    seeded_names = [t["Title"] if isinstance(t, dict) else t for t in seeded_topics]
    if seeded_names:
        prefixes = [f"{name}{_LESSON_COMPOSITE_INFIX}" for name in seeded_names]
        has_seeded_progress = any(
            r.get("Topic") in seeded_names or any(str(r.get("Topic", "")).startswith(p) for p in prefixes)
            for r in progress_rows
        )
        if has_seeded_progress:
            return seeded_names

    fallback_prefix = f"{skill}{_LESSON_COMPOSITE_INFIX}"
    has_fallback_progress = any(
        r.get("Topic") == skill or str(r.get("Topic", "")).startswith(fallback_prefix)
        for r in progress_rows
    )
    if has_fallback_progress:
        return [skill]

    return seeded_names


def _skill_progress_fraction(db, uid: str, entry: dict) -> float:
    """
    Continuous 0-100 "how far along is this ONE skill" score — used to
    build Overall Progress as a smooth number that moves after every
    topic quiz (whole-topic Test OR individual Learning Hub lesson —
    see _topic_effective_score()), instead of jumping only once a skill
    fully crosses SKILL_MASTERY_THRESHOLD_PERCENT on every topic (which
    reads as "stuck at 0%" for a long time even while the learner is
    genuinely improving).

      - status "mastered"      -> 100
      - status "not_assessed"  -> 0 (role skill never touched at all)
      - status "upcoming" (assessed, not yet fully mastered):
          - if the skill has topic-seed data (services/skill_topic_service
            — currently "frontend" role skills only): average across
            every topic's _topic_effective_score() (falls back to the
            skill's diagnostic scorePercent per-topic where untouched,
            so an untouched topic doesn't drag the number down below
            what the diagnostic already showed).
          - otherwise (no topic-seed data for this skill) -> just the
            diagnostic scorePercent, since there's no finer-grained
            signal available.
    """
    status = entry.get("status")
    if status == "mastered":
        return 100.0
    if status == "not_assessed":
        return 0.0

    baseline = entry.get("scorePercent") or 0.0
    skill = entry.get("skill")

    from services.skill_topic_service import get_topics_for_skill
    from services import topic_quiz_repository as topic_repo

    topics = get_topics_for_skill(db, skill)
    progress_rows = [p for p in topic_repo.list_progress_by_uid(db, uid) if p.get("Skill") == skill]

    all_topic_names = _effective_topic_names(skill, topics, progress_rows)
    if not all_topic_names:
        return baseline

    topic_scores = [_topic_effective_score(progress_rows, name, baseline) for name in all_topic_names]
    return sum(topic_scores) / len(topic_scores) if topic_scores else baseline


def recompute_mastery_after_topic_progress(uid: str, skill: str) -> dict | None:
    """
    Call after a topic quiz submission. Does two independent things:

      1. Discrete mastery flip: once every topic under `skill` has at
         least one attempt, average all of them together (per-topic
         average, then averaged again across topics — "total plus
         divide", not "every single topic must independently clear the
         bar"). If that overall average >= SKILL_MASTERY_THRESHOLD_PERCENT,
         flips the skill to "mastered" — this drives the "Skills
         Mastered X/Y" count/badge specifically. Deliberately an
         average, not a min(): a learner who scored 100/90/100/60
         across 4 Learning Hub lessons (each individually clearing
         lessonProgress.js's own LESSON_PASS_THRESHOLD=70 "completed"
         bar) has a real 87.5% grasp of the topic — requiring every
         single lesson to also individually clear 75% on top of that
         was why finishing every lesson in a topic could still leave
         "Skills Mastered" stuck at 0.
      2. Continuous course_completion_percent recompute (via
         _skill_progress_fraction, above) across EVERY entry on the
         roadmap — this drives the Overall Progress ring, and moves a
         little after every topic quiz attempt rather than only on a
         full skill mastery.

    Returns None (no-op) only when there's no saved roadmap yet, or the
    skill isn't on it — every other case still recomputes and saves
    course_completion_percent even if the mastery flip itself didn't
    happen this time.
    """
    db = get_firestore_client()
    roadmap = _get_roadmap(db, uid)
    if not roadmap:
        return None

    entries = roadmap.get("entries", [])
    entry = next((e for e in entries if e.get("skill") == skill), None)
    if entry is None:
        return None

    if entry.get("status") != "mastered":
        from services.skill_topic_service import get_topics_for_skill
        from services import topic_quiz_repository as topic_repo

        topics = get_topics_for_skill(db, skill)
        progress_rows = [p for p in topic_repo.list_progress_by_uid(db, uid) if p.get("Skill") == skill]

        # See _effective_topic_names()'s docstring: falls back to the
        # skill's own name as the sole "topic" when the seeded topic
        # names have no recorded progress at all (i.e. the frontend
        # used its own "topic == skill" fallback to record lessons —
        # see buildCourseNavigator.js), so a skill isn't stuck unable
        # to ever reach "mastered" just because its role wasn't seeded
        # into skill_topic_service.ROLE_SKILLS_BY_ROLE yet.
        all_topic_names = _effective_topic_names(skill, topics, progress_rows)

        if all_topic_names:

            def _matches_for(name: str) -> list[dict]:
                prefix = f"{name}{_LESSON_COMPOSITE_INFIX}"
                return [
                    r for r in progress_rows
                    if r.get("Topic") == name or str(r.get("Topic", "")).startswith(prefix)
                ]

            per_topic_matches = {name: _matches_for(name) for name in all_topic_names}
            if all(per_topic_matches[name] for name in all_topic_names):
                scores = [
                    sum(r.get("AverageScorePercent", 0) for r in per_topic_matches[name]) / len(per_topic_matches[name])
                    for name in all_topic_names
                ]
                overall_avg = sum(scores) / len(scores)
                if overall_avg >= SKILL_MASTERY_THRESHOLD_PERCENT:
                    entry["status"] = "mastered"
                    entry["currentLevel"] = "Strong"
                    entry["scorePercent"] = round(overall_avg, 1)
                    entry["week"] = None
                    entry["focusBand"] = "advanced"
                    entry["recommendation"] = MASTERED_MESSAGE

    mastered_count = sum(1 for e in entries if e.get("status") == "mastered")
    upcoming_count = sum(1 for e in entries if e.get("status") == "upcoming")
    not_assessed_count = sum(1 for e in entries if e.get("status") == "not_assessed")
    total_skills = roadmap.get("totalSkills") or len(entries)

    course_completion_percent = (
        round(sum(_skill_progress_fraction(db, uid, e) for e in entries) / total_skills, 1)
        if total_skills else 0.0
    )
    pace_label = PACE_FAST_TRACK if (mastered_count / total_skills if total_skills else 0) >= 0.5 else PACE_STEADY

    from services.roadmap_repository import update_roadmap_progress

    return update_roadmap_progress(
        db, uid,
        entries=entries,
        mastered_count=mastered_count,
        upcoming_count=upcoming_count,
        not_assessed_count=not_assessed_count,
        course_completion_percent=course_completion_percent,
        pace_label=pace_label,
    )
