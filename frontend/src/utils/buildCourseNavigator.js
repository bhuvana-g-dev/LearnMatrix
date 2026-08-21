/**
 * buildCourseNavigator.js
 *
 * Turns the roadmap (services/roadmap_service.py's Roadmap.to_dict())
 * plus the compressed syllabus (services/syllabus_compression_service.py's
 * get_compressed_role_syllabus) into ONE flat, ordered list of every
 * topic in the learner's curriculum — Module -> Skill -> Topic, in
 * that display order. This is the single source of truth for both the
 * Course Workspace's sidebar tree AND its Previous/Next navigation, so
 * the two can never disagree about ordering.
 *
 * Deliberately NOT a locking mechanism: every topic for every skill is
 * included here regardless of the skill's mastered/upcoming/not_assessed
 * status — clicking any of them is always valid. Status only affects
 * the STARTING focusBand used for that skill's topics (see below) and
 * small visual indicators (Verified checkmark) in the sidebar — never
 * whether a topic can be opened.
 *
 * PER-TOPIC FOCUS BAND (this revision): the skill-level focusBand below
 * is only ever a STARTING point — one band computed once from the
 * whole-skill diagnostic. Once a learner has actually taken a TOPIC's
 * own quiz (backend/services/topic_quiz_service.py), that topic gets
 * its own FocusBand computed from ITS Easy/Medium/Hard breakdown
 * (backend/services/focus_band.py, same function, topic-scoped data —
 * see backend/routes/topic_quiz_routes.py's GET .../progress). That
 * per-topic result — passed in here as `topicProgress`, a
 * `${skill}::${topic}` -> FocusBand map — always wins over the
 * skill-level default, because it's a fresher, more specific signal:
 * two topics in the same "upcoming" skill can genuinely need different
 * content depth once the learner has actually studied one of them. The
 * same recorded-progress signal also upgrades that topic's
 * Verified/Current/Locked STATUS to "Verified" (see buildFlatTopicList
 * below) — submitting a topic's own quiz is stronger evidence than the
 * one-time diagnostic that scored it Current/Locked originally.
 *
 * LESSON COMPLETION (this revision): a topic can ALSO reach "Verified"
 * by the learner finishing every lesson in its Lessons breakdown (see
 * utils/lessonProgress.js) — read synchronously from localStorage, no
 * extra network round trip. This is what keeps the tick honest for a
 * topic like "React.js" with 4 lessons: finishing 1 of 4 no longer
 * shows it as done, because that signal simply didn't exist before —
 * only quiz/diagnostic status did.
 */
import { isTopicFullyComplete } from "./lessonProgress";

// A skill's roadmap-computed focusBand (fundamentals/application/
// advanced/polish) only exists for status="upcoming" skills — that's
// the ONE band the Roadmap Agent scored from the diagnostic breakdown.
// Skills that are already mastered or were never assessed don't have a
// computed band at all, so "application" (a balanced, moderate default)
// is used for every topic under them — never "locked", just a sensible
// default level to fetch content at.
const DEFAULT_FOCUS_BAND = "application";

/** Key used to look up a topic's recorded per-quiz progress in the
 * `topicProgress` map — must match how CourseWorkspaceScreen builds
 * that map from getTopicProgress()'s [{ Skill, Topic, FocusBand, ... }]. */
export function topicProgressKey(skill, topic) {
  return `${skill}::${topic}`;
}

export function buildFlatTopicList(roadmap, compressedSyllabus, topicProgress = null, uid = null) {
  if (!roadmap) return [];

  const groups =
    roadmap.moduleOrder && roadmap.moduleOrder.length > 0
      ? roadmap.moduleOrder.map((name) => ({ name, entries: roadmap.entries.filter((e) => e.module === name) }))
      : [{ name: null, entries: roadmap.entries }];

  const flat = [];
  for (const group of groups) {
    for (const entry of group.entries) {
      const syllabusTopics = compressedSyllabus?.skills?.find((s) => s.skill === entry.skill)?.topics;
      // Fallback for skills without topic-level seed data yet (see
      // services/skill_topic_service.py — currently "frontend" role
      // only): treat the whole skill as a single topic, same as the
      // rest of the app's existing "topic == skill" fallback.
      const topics =
        syllabusTopics && syllabusTopics.length > 0
          ? syllabusTopics
          : [{ title: entry.skill, status: entry.status === "mastered" ? "Verified" : "Locked", order: 0 }];

     const skillLevelFocusBand =
  entry.status === "upcoming" && entry.focusBand
    ? entry.focusBand
    : DEFAULT_FOCUS_BAND;

      for (const t of topics) {
        // A recorded per-topic quiz result always wins over the
        // skill-level starting band — see module docstring.
        const recordedBand = topicProgress?.[topicProgressKey(entry.skill, t.title)];
        const focusBand = recordedBand || skillLevelFocusBand;

        // A topic the learner has actually submitted a quiz for shows
        // as Verified (tick) even if the original diagnostic scored it
        // Current/Locked — completing the topic's own test is stronger,
        // fresher evidence than the one-time whole-skill diagnostic.
        // Finishing every lesson in its breakdown is the same kind of
        // stronger evidence (see module docstring) — either one ticks it.
        const lessonsDone = isTopicFullyComplete(uid, entry.skill, t.title);
        const topicStatus = recordedBand || lessonsDone ? "Verified" : t.status;

        flat.push({
          module: group.name,
          skill: entry.skill,
          skillStatus: entry.status,
          topic: t.title,
          topicStatus, // "Verified" | "Current" | "Locked" — display-only, never gates access
          focusBand,
        });
      }
    }
  }
  return flat;
}

/** Index of the best default topic to open — the learner's current
 * skill/topic if one was passed in (e.g. from "Start My Learning
 * Journey"), else the first topic overall. */
export function findStartingIndex(flatTopics, initialEntry) {
  if (initialEntry) {
    const wantedTopic = initialEntry.currentTopic || initialEntry.skill;
    const idx = flatTopics.findIndex((t) => t.skill === initialEntry.skill && t.topic === wantedTopic);
    if (idx >= 0) return idx;
    const skillIdx = flatTopics.findIndex((t) => t.skill === initialEntry.skill);
    if (skillIdx >= 0) return skillIdx;
  }
  return 0;
}
