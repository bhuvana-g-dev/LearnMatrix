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
 */

// A skill's roadmap-computed focusBand (fundamentals/application/
// advanced/polish) only exists for status="upcoming" skills — that's
// the ONE band the Roadmap Agent scored from the diagnostic breakdown.
// Skills that are already mastered or were never assessed don't have a
// computed band at all, so "application" (a balanced, moderate default)
// is used for every topic under them — never "locked", just a sensible
// default level to fetch content at.
const DEFAULT_FOCUS_BAND = "application";

export function buildFlatTopicList(roadmap, compressedSyllabus) {
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

     const focusBand =
  entry.status === "upcoming" && entry.focusBand
    ? entry.focusBand
    : DEFAULT_FOCUS_BAND;

      for (const t of topics) {
        flat.push({
          module: group.name,
          skill: entry.skill,
          skillStatus: entry.status,
          topic: t.title,
          topicStatus: t.status, // "Verified" | "Current" | "Locked" — display-only, never gates access
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
