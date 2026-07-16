import { useState, useEffect, useCallback } from "react";
import { getUserProfile } from "../services/profileService";
import { getLearningProgress } from "../services/learningProgressService";
import { getUpcomingAssessments } from "../services/assessmentService";
import { getCompletedCourses } from "../services/completedCoursesService";
import { getRevisionSchedule, markRevisionCompleted } from "../services/revisionService";
import { getLearningStatistics } from "../services/statisticsService";
import { getAIInsights } from "../services/aiInsightsService";

/**
 * useProfile — owns all state for the My Profile page: loading flags,
 * every section's data, and the revision-completion toggle. Backed by
 * services/*.js today (dummy data), and calls into Flask/Firebase later
 * without ProfileScreen or any of its sub-components changing.
 */
export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [completedCourses, setCompletedCourses] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [p, lp, ua, cc, rs, ls, ai] = await Promise.all([
        getUserProfile(),
        getLearningProgress(),
        getUpcomingAssessments(),
        getCompletedCourses(),
        getRevisionSchedule(),
        getLearningStatistics(),
        getAIInsights(),
      ]);

      if (!mounted) return;

      setProfile(p);
      setProgress(lp);
      setAssessments(ua);
      setCompletedCourses(cc);
      setRevisions(rs);
      setStatistics(ls);
      setAiInsights(ai);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Optimistic local toggle + fire-and-forget sync (future Flask write).
  const toggleRevisionCompleted = useCallback((id) => {
    setRevisions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r))
    );
    markRevisionCompleted(id);
  }, []);

  return {
    profile,
    progress,
    assessments,
    completedCourses,
    revisions,
    statistics,
    aiInsights,
    loading,
    toggleRevisionCompleted,
  };
}
