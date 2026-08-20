import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

/**
 * topicQuizService.js
 *
 * Calls backend/routes/topic_quiz_routes.py — Objective 3 (post-topic
 * quiz + ML classification) and Objective 4 (adaptive revision
 * scheduling). Real API calls from day one (unlike revisionService.js's
 * current dummy stub), since this is what TopicQuizModal.jsx runs on.
 */

export async function getTopicQuiz(skill, topic, focusBand) {
  const { data } = await apiClient.get(ENDPOINTS.TOPIC_QUIZ.GET_QUIZ(skill, topic), {
    params: { focusBand }, // quiz cache is shared per (skill, topic, focusBand) category — see backend/services/topic_quiz_bank_cache.py
    timeout: 60000, // only the FIRST student in a category triggers a live AI call; every one after gets the cached quiz
  });
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load this topic's quiz.");
  }
  return data.data; // { skill, topic, questions, totalQuestions, source }
}

// Always call BEFORE getTopicQuiz(). Returns null if the learner hasn't
// taken this topic's quiz yet (caller should fall back to getTopicQuiz()
// + the normal take-quiz flow); otherwise returns the review data for
// their most recent attempt — questions, their picks, and that attempt's
// already-computed score/classification/next revision date — WITHOUT
// generating or fetching a new quiz.
export async function getTopicQuizAttempt(skill, topic, uid) {
  const { data } = await apiClient.get(ENDPOINTS.TOPIC_QUIZ.GET_ATTEMPT(skill, topic), {
    params: { uid },
  });
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to check this topic's quiz history.");
  }
  return data.data; // null (no prior attempt) or { questions, answers, scorePercent, ... }
}

export async function submitTopicQuiz(skill, topic, { uid, questions, answers, timeTakenSeconds }) {
  const { data } = await apiClient.post(ENDPOINTS.TOPIC_QUIZ.SUBMIT(skill, topic), {
    uid,
    questions,
    answers,
    timeTakenSeconds,
  });
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to submit the quiz.");
  }
  return data.data; // { scorePercent, correct, total, classification, classificationProbabilities, nextReviewDate, attemptNumber, averageScorePercent }
}

export async function getTopicProgress(uid) {
  const { data } = await apiClient.get(ENDPOINTS.TOPIC_QUIZ.PROGRESS(uid));
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load topic progress.");
  }
  return data.data; // array of topic_quiz_progress docs, each with { Skill, Topic, FocusBand, Classification, ... }
}

export async function getDueRevisions(uid) {
  const { data } = await apiClient.get(ENDPOINTS.TOPIC_QUIZ.DUE_REVISIONS(uid));
  if (!data.success) {
    throw new Error(data.error || data.message || "Failed to load revisions.");
  }
  return data.data; // array of topic_quiz_progress docs due today or earlier
}
