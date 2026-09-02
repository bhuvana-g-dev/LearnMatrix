import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";
import { getRevisionsDirect } from "./directProfileReads";

/**
 * revisionService.js
 *
 * Real API calls to backend/routes/topic_quiz_routes.py's revision
 * endpoints (Objective 4). Replaces the old dummy/local stub — this is
 * the ML classifier's actual output (topic_quiz_progress docs), not
 * mock data.
 *
 * Backend fields per item: Uid, Skill, Topic, AttemptCount,
 * LastScorePercent, AverageScorePercent, Classification (Fast/Moderate/
 * Slow), NextReviewDate ("YYYY-MM-DD"), LastAttemptAt, CreatedAt,
 * UpdatedAt — see backend/models/topic_quiz_progress_model.py.
 *
 * There is deliberately no "completed" bucket here — the backend has no
 * separate history log, only the latest state per topic (see that
 * model's docstring). "Completed" was dropped from the UI for this
 * reason (see RevisionScheduleSection.jsx).
 */

// Classification -> display priority, since "Slow" learners genuinely
// need the topic revisited sooner than "Fast" ones — this is the same
// signal the backend uses to schedule NextReviewDate in the first
// place (services/revision_scheduler.py), just relabeled for the UI.
const PRIORITY_BY_CLASSIFICATION = {
  Slow: "High",
  Moderate: "Medium",
  Fast: "Low",
};

function formatDueLabel(nextReviewDateIso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextReviewDateIso + "T00:00:00");
  const diffDays = Math.round((due - today) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0) return `${Math.abs(diffDays)} day${diffDays === -1 ? "" : "s"} overdue`;
  return due.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Shapes one backend progress doc into what RevisionScheduleSection.jsx
// renders — id is the same composite key the backend uses, so
// snooze/retake calls can round-trip skill+topic without re-parsing it.
// focusBand is carried through too (not just for display — TopicQuizModal
// needs it as a fallback if a retake ever has to fetch a fresh quiz
// instead of showing a review, e.g. a progress doc with no LastQuestions
// saved from before this field existed).
function toDisplayItem(doc) {
  return {
    id: `${doc.Uid}__${doc.Skill}__${doc.Topic}`,
    skill: doc.Skill,
    topic: doc.Topic,
    focusBand: doc.FocusBand,
    date: formatDueLabel(doc.NextReviewDate),
    nextReviewDate: doc.NextReviewDate,
    priority: PRIORITY_BY_CLASSIFICATION[doc.Classification] || "Medium",
    classification: doc.Classification,
    reason: `${doc.Classification} learner \u00b7 ${doc.AverageScorePercent}% average over ${doc.AttemptCount} attempt${doc.AttemptCount === 1 ? "" : "s"}`,
  };
}

// Direct-Firestore-first (topic_quiz_progress is a plain filtered read,
// no backend computation) — falls back to the Flask route only if the
// direct read itself throws. Same toDisplayItem shaping applies either
// way since both paths hand back the same raw doc fields (Uid/Skill/
// Topic/NextReviewDate/...).
export async function getRevisionSchedule(uid) {
  try {
    const direct = await getRevisionsDirect(uid);
    return {
      due: direct.due.map(toDisplayItem),
      upcoming: direct.upcoming.map(toDisplayItem),
    };
  } catch {
    const { data } = await apiClient.get(ENDPOINTS.TOPIC_QUIZ.DUE_REVISIONS(uid));
    if (!data.success) {
      throw new Error(data.error || data.message || "Failed to load your revision schedule.");
    }
    return {
      due: data.data.due.map(toDisplayItem),
      upcoming: data.data.upcoming.map(toDisplayItem),
    };
  }
}

export async function snoozeRevision(uid, skill, topic) {
  const { data } = await apiClient.post(ENDPOINTS.TOPIC_QUIZ.SNOOZE(uid, skill, topic));
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to postpone this revision.");
  }
  return toDisplayItem(data.data);
}
