import { LEARNING_STATISTICS } from "../constants/learningStatistics";
import { auth } from "../firebase";
import { getCachedRoadmap, getCachedAssessmentResult } from "./userProgressCache";
import { getActivity } from "./activityService";
import { computeCurrentStreak } from "../utils/streak";

/**
 * getLearningStatistics — real data for a signed-in user with a saved
 * roadmap/assessment; a brand-new user (nothing saved yet) gets honest
 * zeros, never LEARNING_STATISTICS' sample numbers.
 *
 *   completedCourses / completedSkills  <- roadmap.masteredCount (real)
 *   learningStreak                      <- activity dates (real)
 *   averageQuizScore                    <- saved evaluation.overall (real)
 *   currentXP / totalLearningHours      <- not tracked anywhere yet, so
 *                                          these stay as clearly-labeled
 *                                          sample data (see sampleFields),
 *                                          same convention as
 *                                          aiInsightsService.js.
 */
export async function getLearningStatistics() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    return { completedCourses: 0, completedSkills: 0, currentXP: 0, learningStreak: 0, totalLearningHours: 0, averageQuizScore: 0 };
  }

  const [roadmap, saved, dates] = await Promise.all([
    getCachedRoadmap(uid).catch(() => null),
    getCachedAssessmentResult(uid).catch(() => null),
    getActivity(uid).catch(() => []),
  ]);

  const masteredCount = roadmap?.masteredCount ?? 0;
  const learningStreak = computeCurrentStreak(dates);
  const averageQuizScore = saved?.evaluation?.overall?.scorePercent
    ? Math.round(saved.evaluation.overall.scorePercent)
    : 0;

  return {
    completedCourses: masteredCount,
    completedSkills: masteredCount,
    learningStreak,
    averageQuizScore,
    // ---- no real tracking source for these yet — sample data ----
    currentXP: LEARNING_STATISTICS.currentXP,
    totalLearningHours: LEARNING_STATISTICS.totalLearningHours,
    sampleFields: ["currentXP", "totalLearningHours"],
  };
}
