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
 *
 * Each section fetches and loads independently (own state + own
 * `*Loading` flag) instead of sharing one Promise.all/`loading` pair.
 * Previously every section was tied to a single `loading` flag, so one
 * slow or failing call (e.g. getLearningStatistics) held up every other
 * section's UI too — screens/LearningInsightsScreen.jsx only reads
 * `aiInsights`, but used to wait on five unrelated fetches before it
 * could render. `loading` is still exported, as the AND of every
 * section's flag, for any caller that genuinely wants "fully loaded".
 */
export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(true);

  const [assessments, setAssessments] = useState([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);

  const [completedCourses, setCompletedCourses] = useState([]);
  const [completedCoursesLoading, setCompletedCoursesLoading] = useState(true);

  const [statistics, setStatistics] = useState(null);
  const [statisticsLoading, setStatisticsLoading] = useState(true);

  const [aiInsights, setAiInsights] = useState(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(true);

  // Re-fetches just the profile section — used after EditProfileModal
  // saves changes, so ProfileHeaderCard reflects the new data immediately
  // without a full page reload. Sets its own loading flag rather than
  // the shared one, so a refetch here can't re-block sections that have
  // nothing to do with the profile write that triggered it.
  const refetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfile(p);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Re-fetches just the AI insights section — the counterpart to
  // refetchProfile for whatever writes a new diagnostic assessment
  // result. Not called automatically today (the pages that trigger an
  // assessment currently remount this hook via navigation, which
  // re-fetches everything), but is exposed so any future in-place
  // "retake assessment" flow can pull the fresh result the same
  // update-then-refetch way EditProfileModal already does for profile,
  // instead of relying on a remount to happen to paper over it.
  const refetchAiInsights = useCallback(async () => {
    setAiInsightsLoading(true);
    try {
      const ai = await getAIInsights();
      setAiInsights(ai);
    } finally {
      setAiInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    getUserProfile().then((p) => {
      if (!mounted) return;
      setProfile(p);
      setProfileLoading(false);
    });

    getLearningProgress().then((lp) => {
      if (!mounted) return;
      setProgress(lp);
      setProgressLoading(false);
    });

    getUpcomingAssessments().then((ua) => {
      if (!mounted) return;
      setAssessments(ua);
      setAssessmentsLoading(false);
    });

    getCompletedCourses().then((cc) => {
      if (!mounted) return;
      setCompletedCourses(cc);
      setCompletedCoursesLoading(false);
    });

    getLearningStatistics().then((ls) => {
      if (!mounted) return;
      setStatistics(ls);
      setStatisticsLoading(false);
    });

    getAIInsights().then((ai) => {
      if (!mounted) return;
      setAiInsights(ai);
      setAiInsightsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const loading =
    profileLoading ||
    progressLoading ||
    assessmentsLoading ||
    completedCoursesLoading ||
    statisticsLoading ||
    aiInsightsLoading;

  return {
    profile,
    profileLoading,
    progress,
    progressLoading,
    assessments,
    assessmentsLoading,
    completedCourses,
    completedCoursesLoading,
    statistics,
    statisticsLoading,
    aiInsights,
    aiInsightsLoading,
    loading,
    refetchProfile,
    refetchAiInsights,
  };
}
