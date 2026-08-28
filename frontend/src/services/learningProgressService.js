import { LEARNING_PROGRESS } from "../constants/learningProgress";
import { auth } from "../firebase";
import { getCachedRoadmap, getCachedAssessmentResult } from "./userProgressCache";

/**
 * getLearningProgress — real roadmap data for a signed-in user; a
 * brand-new user with no saved roadmap gets an honest empty snapshot
 * (0%, "Take your diagnostic assessment"), never the sample module/topic.
 *
 * currentModule/currentTopic <- the first status="upcoming" roadmap
 * entry (lowest week number = what they should study next). No
 * upcoming entries (everything mastered, or nothing assessed yet) ->
 * a clear message instead of a fabricated topic name.
 */
export async function getLearningProgress() {
  const uid = auth.currentUser?.uid;
  if (!uid) return emptyProgress();

  const [roadmap, saved] = await Promise.all([
    getCachedRoadmap(uid).catch(() => null),
    getCachedAssessmentResult(uid).catch(() => null),
  ]);
  if (!roadmap) return emptyProgress();

  const upcoming = (roadmap.entries || [])
    .filter((e) => e.status === "upcoming")
    .sort((a, b) => (a.week ?? 0) - (b.week ?? 0));
  const next = upcoming[0] || null;

  return {
    careerPath: saved?.role || "Your Career Path",
    currentModule: next ? next.module || next.skill : "All caught up",
    currentTopic: next ? next.skill : "Every roadmap skill is mastered or not yet assessed.",
    progressPercent: roadmap.courseCompletionPercent ?? 0,
    completedSkills: roadmap.masteredCount ?? 0,
    totalSkills: roadmap.totalSkills ?? 0,
    remainingSkills: (roadmap.upcomingCount ?? 0) + (roadmap.notAssessedCount ?? 0),
    // ---- no real tracking source for this yet — sample data ----
    estimatedCompletionDate: LEARNING_PROGRESS.estimatedCompletionDate,
    sampleFields: ["estimatedCompletionDate"],
  };
}

function emptyProgress() {
  return {
    careerPath: "Not started yet",
    currentModule: "—",
    currentTopic: "Take your diagnostic assessment to generate a roadmap.",
    progressPercent: 0,
    completedSkills: 0,
    totalSkills: 0,
    remainingSkills: 0,
    estimatedCompletionDate: null,
  };
}
