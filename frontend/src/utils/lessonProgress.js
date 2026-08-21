/**
 * lessonProgress.js
 *
 * Client-side (localStorage) tracking of which lessons a learner has
 * actually PASSED — a lesson only counts as complete once its quiz
 * (same TopicQuizModal/topic_quiz_service the topic-level Test already
 * uses, just keyed by the composite "{topic} — {lessonTitle}" string —
 * see lessonService.compositeTopicKey()) is scored at or above
 * LESSON_PASS_THRESHOLD. Just opening/reading a lesson, or clicking
 * Next/Previous, never marks it done — Coursera-style: score to
 * complete, not scroll to complete.
 *
 * Before this file, NOTHING tracked lesson-level progress anywhere in
 * the app — LessonListPane.jsx just listed lessons with no completed
 * state, and a topic's sidebar tick (buildCourseNavigator.js) came
 * ONLY from its quiz/diagnostic status, completely disconnected from
 * lessons.
 *
 * Not backend-synced (capstone scope) — lives in localStorage only,
 * per browser/device. (The quiz ATTEMPT itself is still recorded
 * server-side as usual, via submitTopicQuiz — this file only tracks
 * the derived "which lessons are done" state for the UI.)
 */

const STORAGE_KEY = "lm_lesson_progress_v1";

// Score needed on a lesson's quiz (see TopicQuizModal's result.scorePercent)
// for that lesson to count as complete — Coursera-style: opening/reading a
// lesson is never enough on its own, only a passing quiz score marks it done.
export const LESSON_PASS_THRESHOLD = 70;

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
