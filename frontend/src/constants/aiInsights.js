/**
 * Dummy AI-generated insights. Same shape a future
 * GET /api/ai/insights response (e.g. from a Gemini/Scikit-Learn service)
 * would have.
 */
export const AI_INSIGHTS = {
  weakTopics: ["Cryptographic Hash Functions", "Wireless Security Protocols"],
  recommendedNextSkill: "Penetration Testing Basics",
  recommendedResources: [
    { title: "OWASP Testing Guide", type: "Guide" },
    { title: "TryHackMe: Pre Security Path", type: "Practice" },
  ],
  studyTip:
    "Revisit hashing concepts before moving to password security topics — it'll make the next module click faster.",
  learningConsistency: "Consistent for 12 days",
  estimatedCourseCompletionDate: "2026-11-15",
  // ---- added: these were referenced by aiInsightsService.js /
  // AIInsightsSection.jsx but missing here, causing todayPlan /
  // weeklyActivity / achievements to be undefined and crash their cards.
  // Shape is a best guess — confirm against the actual TodayPlanCard.jsx /
  // WeeklyActivityChart.jsx / AchievementsCard.jsx once available.
  todayPlan: [
    { id: "tp1", task: "Revise Firewall Rules & ACLs", duration: "20 mins", type: "Revision" },
    { id: "tp2", task: "Practice OWASP Top 10 quiz", duration: "15 mins", type: "Practice" },
  ],
  weeklyActivity: [
    { day: "Mon", minutes: 35 },
    { day: "Tue", minutes: 20 },
    { day: "Wed", minutes: 45 },
    { day: "Thu", minutes: 0 },
    { day: "Fri", minutes: 30 },
    { day: "Sat", minutes: 50 },
    { day: "Sun", minutes: 15 },
  ],
  achievements: [
    { id: "a1", title: "First Assessment Completed", icon: "🎯", earned: true },
    { id: "a2", title: "7-Day Streak", icon: "🔥", earned: true },
    { id: "a3", title: "Perfect Score", icon: "🏆", earned: false },
  ],
  // Shape confirmed against the actual CommunityRankingCard.jsx (it reads
  // .percentile, .cohort, .quizzesCompleted, .practiceLabs, .streakDays).
  communityRanking: {
    percentile: 72,
    cohort: "Cyber Security Analyst learners",
    quizzesCompleted: 14,
    practiceLabs: 6,
    streakDays: 12,
  },
  // Base fields only — aiInsightsService.js overrides `topic` with the
  // real recommended-next-skill. Extend once RevisionReminderCard.jsx is
  // available to confirm its exact expected shape.
  revisionReminder: {
    topic: "Penetration Testing Basics",
    module: "Applied Cryptography",
    date: "Today",
    time: "20 mins",
    priority: "High",
  },
};
