import { useState, useEffect, useCallback } from "react";
import { getUserProfile } from "../services/profileService";
import { getLearningProgress } from "../services/learningProgressService";
import { getUpcomingAssessments } from "../services/assessmentService";
import { getCompletedCourses } from "../services/completedCoursesService";
import { getRevisionSchedule, markRevisionCompleted, snoozeRevision as snoozeRevisionApi } from "../services/revisionService";
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

  // Re-fetches just the profile section — used after EditProfileModal
  // saves changes, so ProfileHeaderCard reflects the new data immediately
  // without a full page reload.
  const refetchProfile = useCallback(async () => {
    const p = await getUserProfile();
    setProfile(p);
  }, []);

  // Optimistic local toggle + fire-and-forget sync (future Flask write).
  const toggleRevisionCompleted = useCallback((id) => {
    setRevisions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r))
    );
    markRevisionCompleted(id);
  }, []);

  // Postpones a "today" item to "upcoming" (Tomorrow) instead of doing it now.
  const snoozeRevision = useCallback((id) => {
    setRevisions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, bucket: "upcoming", date: "Tomorrow" } : r))
    );
    snoozeRevisionApi(id);
  }, []);

  // Bulk-completes every not-yet-done item scheduled for today.
  const markAllTodayCompleted = useCallback(() => {
    setRevisions((prev) => {
      const next = prev.map((r) =>
        r.bucket === "today" && !r.completed ? { ...r, completed: true } : r
      );
      next
        .filter((r) => r.bucket === "today" && r.completed)
        .forEach((r) => markRevisionCompleted(r.id));
      return next;
    });
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
    snoozeRevision,
    markAllTodayCompleted,
    refetchProfile,
  };
}
