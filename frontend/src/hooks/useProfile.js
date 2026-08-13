import { useState, useEffect, useCallback } from "react";
import { getUserProfile } from "../services/profileService";
import { getLearningProgress } from "../services/learningProgressService";
import { getUpcomingAssessments } from "../services/assessmentService";
import { getCompletedCourses } from "../services/completedCoursesService";
import { getLearningStatistics } from "../services/statisticsService";
import { getAIInsights } from "../services/aiInsightsService";

/**
 * useProfile — owns all state for the My Profile page: loading flags,
 * every section's data. Backed by services/*.js today (dummy data), and
 * calls into Flask/Firebase later without ProfileScreen or any of its
 * sub-components changing.
 *
 * Revision data used to live here too but was split out — see
 * screens/RevisionScheduleScreen.jsx, which now owns its own fetch
 * straight from services/revisionService.js (real backend, not dummy)
 * since Revision is its own top-level nav page now, unrelated to the
 * rest of this bundle.
 */
export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [completedCourses, setCompletedCourses] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [p, lp, ua, cc, ls, ai] = await Promise.all([
        getUserProfile(),
        getLearningProgress(),
        getUpcomingAssessments(),
        getCompletedCourses(),
        getLearningStatistics(),
        getAIInsights(),
      ]);

      if (!mounted) return;

      setProfile(p);
      setProgress(lp);
      setAssessments(ua);
      setCompletedCourses(cc);
      setStatistics(ls);
      setAiInsights(ai);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Re-fetches just the profile section — used after EditProfileModal
  // saves changes, so ProfileHeaderCard reflects the new data immediately
  // without a full page reload.
  const refetchProfile = useCallback(async () => {
    const p = await getUserProfile();
    setProfile(p);
  }, []);

  return {
    profile,
    progress,
    assessments,
    completedCourses,
    statistics,
    aiInsights,
    loading,
    refetchProfile,
  };
}
