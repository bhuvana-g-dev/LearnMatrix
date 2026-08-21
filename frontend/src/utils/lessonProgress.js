/**
 * lessonProgress.js
 *
 * Client-side (localStorage) tracking of which lessons a learner has
 * actually finished, keyed by uid::skill::topic. Before this file,
 * NOTHING tracked lesson-level progress anywhere in the app —
 * LessonListPane.jsx just listed lessons with no completed/incomplete
 * state, and a topic's sidebar tick (buildCourseNavigator.js) came
 * ONLY from its quiz/diagnostic status, completely disconnected from
 * how many of its lessons were opened. That's why finishing 1 of 4
 * lessons could show a topic as fully ticked (or not ticked at all,
 * depending on quiz status) regardless of actual lesson progress.
 *
 * Not backend-synced (capstone scope) — lives in localStorage only,
 * per browser/device.
 */

const STORAGE_KEY = "lm_lesson_progress_v1";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable/full — progress just won't persist this session
  }
}

function key(uid, skill, topic) {
  return `${uid || "anon"}::${skill}::${topic}`;
}

/** Call once per topic, right after getLessons() resolves — records
 * how many lessons this topic actually has, so completion checks
 * elsewhere (isTopicFullyComplete) don't need a network call. */
export function setLessonTotal(uid, skill, topic, total) {
  const all = readAll();
  const k = key(uid, skill, topic);
  const entry = all[k] || { completed: [], total: 0 };
  entry.total = total;
  all[k] = entry;
  writeAll(all);
}

/** Mark ONE lesson (by its Order) as completed for this topic. */
export function markLessonComplete(uid, skill, topic, lessonOrder) {
  const all = readAll();
  const k = key(uid, skill, topic);
  const entry = all[k] || { completed: [], total: 0 };
  if (!entry.completed.includes(lessonOrder)) entry.completed.push(lessonOrder);
  all[k] = entry;
  writeAll(all);
}

export function getCompletedLessons(uid, skill, topic) {
  const all = readAll();
  return new Set((all[key(uid, skill, topic)] || {}).completed || []);
}

/** Index (0-based) of the first not-yet-completed lesson, given the
 * lessons array [{Order, ...}] in display order — for "resume where I
 * left off". Returns 0 if nothing completed yet, or if every lesson
 * is already done. */
export function firstIncompleteIndex(uid, skill, topic, lessons) {
  const completed = getCompletedLessons(uid, skill, topic);
  const idx = lessons.findIndex((l) => !completed.has(l.Order));
  return idx === -1 ? 0 : idx;
}

/** Synchronous, no network — used by buildCourseNavigator.js so a
 * topic's sidebar tick reflects real lesson completion once the
 * learner has actually finished every lesson in it. A topic never
 * opened yet has no cached total, so this safely returns false —
 * never falsely ticks something untouched. */
export function isTopicFullyComplete(uid, skill, topic) {
  const all = readAll();
  const entry = all[key(uid, skill, topic)];
  if (!entry || !entry.total) return false;
  return entry.completed.length >= entry.total;
}
