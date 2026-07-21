import { AI_INSIGHTS } from "../constants/aiInsights";
import { auth } from "../firebase";
import { loadSavedAssessmentResult } from "./aiAssessmentService";

/**
 * Fields below are genuinely computed from the student's real, saved
 * diagnostic assessment result (backend/services/evaluation_service.py's
 * skill-wise Strong/Intermediate/Weak/Not Attempted breakdown). No
 * fabricated numbers — everything here traces back to
 * evaluation.skills[].scorePercent / .level and evaluation.overall.
 */
function computeLiveInsights(evaluation, roleTitle) {
  const skills = evaluation.skills || [];
  const overall = evaluation.overall || { correct: 0, total: 0, scorePercent: 0 };

  const sortedByScore = [...skills].sort((a, b) => a.scorePercent - b.scorePercent);
  const weakestSkill = sortedByScore[0] || null;
  const weakSkills = skills.filter((s) => s.level === "Weak" || s.level === "Not Attempted");

  const skillProgress = skills.map((s) => ({ skill: s.skill, percent: Math.round(s.scorePercent) }));

  const weakTopics = weakSkills.length ? weakSkills.map((s) => s.skill) : ["No weak areas — nice work!"];

  const recommendedNextSkill = weakestSkill ? weakestSkill.skill : roleTitle;

  const riskLevel = weakSkills.length >= 2 ? "high" : weakSkills.length === 1 ? "medium" : "low";
  const riskReason = weakSkills.length
    ? `Your latest assessment shows ${weakSkills
        .map((s) => `${s.skill} at ${Math.round(s.scorePercent)}%`)
        .join(", ")}.`
    : "You're scoring well across every skill in your latest assessment.";
  const riskRecommendation = weakSkills.length
    ? `Revise ${weakestSkill.skill} before moving on to new topics in your roadmap.`
    : "Keep progressing through your roadmap — no risk areas from your latest assessment.";

  const mentorMessage = weakSkills.length
    ? `👋 You scored ${Math.round(overall.scorePercent)}% overall on your assessment. ${weakestSkill.skill} needs the most attention — a focused revision session there will help the most.`
    : `👋 Great work! You scored ${Math.round(overall.scorePercent)}% overall with no weak areas on your assessment.`;

  const motivation =
    overall.scorePercent >= 75
      ? "🔥 You're performing strongly — keep this pace and you'll be job-ready in no time."
      : "🎯 Revisit your weak topics and retake the assessment to watch your score climb.";

  const studyTip = weakestSkill
    ? `Spend your next session on ${weakestSkill.skill} — it's your lowest-scoring skill at ${Math.round(weakestSkill.scorePercent)}% in your latest assessment.`
    : "You're balanced across every assessed skill — pick any topic and keep building depth.";

  const smartResources = (weakSkills.length ? weakSkills : skills)
    .slice(0, 3)
    .map((s, i) => ({
      title: `${s.skill} — Focused Review`,
      difficulty: s.scorePercent < 40 ? "Beginner" : "Intermediate",
      estimatedTime: ["15 min", "20 min", "25 min"][i % 3],
      type: ["Video", "Practice Lab", "Article"][i % 3],
      reason: `Recommended because your ${s.skill} score is ${Math.round(s.scorePercent)}% in your latest assessment.`,
    }));

  return {
    learningScore: { score: Math.round(overall.scorePercent), caption: "Based on your latest assessment" },
    weakTopics,
    recommendedNextSkill,
    skillProgress,
    riskPrediction: { level: riskLevel, reason: riskReason, recommendation: riskRecommendation },
    careerReadiness: {
      careerName: roleTitle,
      percent: Math.round(overall.scorePercent),
      suggestedRole: roleTitle,
      nextRequirement: weakestSkill ? `Strengthen ${weakestSkill.skill}` : `Continue your ${roleTitle} roadmap`,
    },
    mentorMessage,
    motivation,
    studyTip,
    smartResources,
  };
}

/**
 * getAIInsights — checks whether the current user has a completed,
 * saved diagnostic assessment (Firestore, via loadSavedAssessmentResult).
 *
 *  - No assessment yet -> { started: false }. The UI shows a prompt to
 *    take the assessment instead of guessing at fake numbers.
 *  - Assessment completed -> real per-skill scores computed above, PLUS
 *    a few fields the app doesn't track anywhere yet (today's plan,
 *    weekly activity, achievements, community ranking, resource
 *    catalog, revision scheduling) filled from AI_INSIGHTS as clearly
 *    labeled sample data (insights.sampleFields) until there's a real
 *    backend source for them.
 */
export async function getAIInsights() {
  const uid = auth.currentUser?.uid;
  if (!uid) return { started: false };

  let saved = null;
  try {
    saved = await loadSavedAssessmentResult(uid);
  } catch {
    return { started: false };
  }

  if (!saved || !saved.evaluation) return { started: false };

  const roleTitle = saved.role || "Your Career Path";
  const live = computeLiveInsights(saved.evaluation, roleTitle);

  return {
    started: true,
    ...live,
    // ---- no real tracking source for these yet — sample data ----
    recommendedResources: AI_INSIGHTS.recommendedResources,
    learningConsistency: AI_INSIGHTS.learningConsistency,
    estimatedCourseCompletionDate: AI_INSIGHTS.estimatedCourseCompletionDate,
    todayPlan: AI_INSIGHTS.todayPlan,
    weeklyActivity: AI_INSIGHTS.weeklyActivity,
    achievements: AI_INSIGHTS.achievements,
    communityRanking: AI_INSIGHTS.communityRanking,
    revisionReminder: { ...AI_INSIGHTS.revisionReminder, topic: live.recommendedNextSkill },
    sampleFields: [
      "recommendedResources",
      "learningConsistency",
      "estimatedCourseCompletionDate",
      "todayPlan",
      "weeklyActivity",
      "achievements",
      "communityRanking",
      "revisionReminder",
    ],
  };
}
