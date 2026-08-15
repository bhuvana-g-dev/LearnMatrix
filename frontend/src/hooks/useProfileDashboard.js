import { useState, useEffect, useCallback, useMemo } from "react";
import { auth } from "../firebase";
import { getUserProfile } from "../services/profileService";
import { getAIInsights } from "../services/aiInsightsService";
import { loadSavedRoadmap } from "../services/aiAssessmentService";
import { getActivity } from "../services/activityService";
import { getRevisionSchedule } from "../services/revisionService";
import { getCertificate } from "../services/certificateService";

/**
 * useProfileDashboard — owns all state for the "My Profile" dashboard
 * (screens/ProfileScreen.jsx). Unlike the old useProfile.js (which mixed
 * real fields with constants/*.js dummy data), every value returned here
 * traces back to a real backend/Firestore source:
 *
 *   profile        -> services/profileService.js (Firebase Auth + Firestore users/{uid})
 *   aiInsights      -> services/aiInsightsService.js (saved diagnostic assessment)
 *   roadmap         -> GET /api/roadmap/<uid> (services/roadmap_service.py)
 *   activityDates   -> GET /api/activity/<uid> (services/activity_repository.py) — real day-level app-open log
 *   revision        -> GET /api/revisions/<uid> (services/revision_scheduler.py)
 *   certificate     -> GET /api/certificates/<uid> (services/certificate_service.py) —
 *                        issued the moment a career path/roadmap is started,
 *                        auto-flipped to "completed" once the roadmap's
 *                        mastered skills reach its total
 *
 * Nothing here is faked for a brand-new user — a field with no real
 * source yet (learning hours in minutes, achievements/badges) is simply
 * left out; the screen shows an honest empty state for those instead of
 * a placeholder number.
 */
export function useProfileDashboard() {
  const [profile, setProfile] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [activityDates, setActivityDates] = useState([]);
  const [revision, setRevision] = useState({ due: [], upcoming: [] });
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const uid = auth.currentUser?.uid;

    const [p, ai, rm, dates, rev, cert] = await Promise.all([
      getUserProfile(),
      getAIInsights(),
      uid ? loadSavedRoadmap(uid).catch(() => null) : Promise.resolve(null),
      uid ? getActivity(uid).catch(() => []) : Promise.resolve([]),
      uid ? getRevisionSchedule(uid).catch(() => ({ due: [], upcoming: [] })) : Promise.resolve({ due: [], upcoming: [] }),
      uid ? getCertificate(uid).catch(() => null) : Promise.resolve(null),
    ]);

    setProfile(p);
    setAiInsights(ai);
    setRoadmap(rm);
    setActivityDates(dates);
    setRevision(rev);
    setCertificate(cert);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (!mounted) return;
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetchProfile = useCallback(async () => {
    const p = await getUserProfile();
    setProfile(p);
  }, []);

  // ---- derived, honest stats (no fabricated numbers) ----

  const streak = useMemo(() => computeStreak(activityDates), [activityDates]);
  const weekActivity = useMemo(() => computeWeekActivity(activityDates), [activityDates]);

  const skillsMastered = roadmap?.masteredCount ?? 0;
  const totalSkills = roadmap?.totalSkills ?? 0;
  const overallProgressPercent = roadmap ? Math.round(roadmap.courseCompletionPercent) : 0;

  const topicsInProgress = (revision.due?.length || 0) + (revision.upcoming?.length || 0);
  const activeDaysCount = activityDates.length;

  const nextRevision = revision.due?.[0] || revision.upcoming?.[0] || null;

  return {
    profile,
    aiInsights,
    roadmap,
    revision,
    certificate,
    loading,
    refetchProfile,
    stats: {
      overallProgressPercent,
      skillsMastered,
      totalSkills,
      topicsInProgress,
      activeDaysCount,
      streak,
    },
    weekActivity,
    nextRevision,
  };
}

// A day counts toward the streak if it was pinged, checked from today
// backward (or from yesterday, if today hasn't been pinged yet — the
// streak isn't broken until a full day is missed).
function computeStreak(dates) {
  if (!dates || dates.length === 0) return 0;
  const set = new Set(dates);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  const todayStr = toDateStr(cursor);
  if (!set.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(toDateStr(cursor))) return 0;
  }

  let count = 0;
  while (set.has(toDateStr(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

// Mon -> Sun for the current calendar week, each day's real active/
// inactive state — no fabricated hour totals, since only day-level
// presence is tracked (services/activity_repository.py).
function computeWeekActivity(dates) {
  const set = new Set(dates || []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay(); // 0=Sun..6=Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label,
      active: set.has(toDateStr(d)),
      isToday: toDateStr(d) === toDateStr(today),
      isFuture: d > today,
    };
  });
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}
