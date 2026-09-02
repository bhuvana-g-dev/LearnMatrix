import { useState, useEffect, useCallback, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { getUserProfile } from "../services/profileService";
import { getAIInsights } from "../services/aiInsightsService";
import { getCachedRoadmap, getCachedAssessmentResult, invalidateRoadmap } from "../services/userProgressCache";
import { generateRoadmap } from "../services/aiAssessmentService";
import { getActivity } from "../services/activityService";
import { getRevisionSchedule } from "../services/revisionService";
import { getCertificate } from "../services/certificateService";
import { ROLES } from "../constants/roles";

/**
 * Self-heal for a real, observed failure mode: the diagnostic assessment
 * saves fine and users/{uid}.careerPath gets set, but the very next step
 * (AssessmentScreen.jsx's auto-call to generateRoadmap right after
 * evaluation) can silently fail (network blip, backend hiccup, user
 * navigating away mid-request) — its own catch only sets a
 * roadmapError the learner may never see. Result: Profile shows a real
 * career path + real Skill Progress/AI Insights (both sourced from the
 * assessment, which DID save), but Overall Progress/Skills Mastered/
 * Roadmap Completion/Achievements/Certificate all read from the
 * roadmap doc that never got created, so they're stuck at an honest
 * but misleading 0/empty.
 *
 * If we have a saved assessment (evaluation) but no roadmap, there's
 * nothing to lose by regenerating it right here — same inputs
 * AssessmentScreen.jsx would have used, just re-run automatically
 * instead of leaving the learner stuck until they retake the whole
 * assessment. roleId is resolved the same best-effort way
 * RoadmapScreen.jsx already does (title -> id via ROLES) since it
 * isn't persisted on the saved assessment itself; missing it just
 * means the assessed-skills-only roadmap shape instead of the full
 * role syllabus — still real, non-zero progress either way.
 */
async function selfHealMissingRoadmap(uid) {
  const savedAssessment = await getCachedAssessmentResult(uid).catch(() => null);
  if (!savedAssessment?.evaluation) return null; // nothing to rebuild from

  const roleEntry = ROLES.find((r) => r.title === savedAssessment.role);
  const rebuilt = await generateRoadmap(
    savedAssessment.evaluation,
    uid,
    savedAssessment.role || "",
    roleEntry?.id || ""
  );
  invalidateRoadmap(uid); // so every other screen picks up the just-rebuilt roadmap too
  return rebuilt;
}

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
  // uid/authReady are driven by Firebase's own onAuthStateChanged
  // listener rather than reading auth.currentUser synchronously.
  // auth.currentUser is briefly null after a page refresh — before
  // Firebase finishes restoring the session — even for an already
  // logged-in user. Reading it directly at mount time race-condition-ed
  // profile/roadmap/activity/revision/certificate into their empty
  // "no uid" fallbacks, and since the load effect had an empty deps
  // array it never re-ran once auth actually resolved, so the page got
  // stuck on that wrong snapshot (or on stale data from a previous
  // account) until a lucky refresh. Keying everything off this
  // listener's uid — and re-running whenever it changes — keeps the
  // dashboard synchronized with whoever is actually authenticated.
  const [uid, setUid] = useState(auth.currentUser?.uid ?? null);
  const [authReady, setAuthReady] = useState(false);

  const [profile, setProfile] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [activityDates, setActivityDates] = useState([]);
  const [revision, setRevision] = useState({ due: [], upcoming: [] });
  const [certificate, setCertificate] = useState(null);

  // `loading` gates only the fast, identity-critical fetch (profile +
  // AI insights) so the page paints quickly instead of blocking on
  // every card. `secondaryLoading` covers roadmap/activity/revision/
  // certificate, one of which (roadmap) does an extra recompute round
  // trip server-side and would otherwise hold up the whole screen.
  const [loading, setLoading] = useState(true);
  const [secondaryLoading, setSecondaryLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUid(firebaseUser?.uid ?? null);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const loadPrimary = useCallback(async () => {
    setLoading(true);
    const [p, ai] = await Promise.all([getUserProfile(), getAIInsights()]);
    setProfile(p);
    setAiInsights(ai);
    setLoading(false);
    return p; // returned (not read back from state) so callers avoid a stale-closure read of `profile`
  }, []);

  const loadSecondary = useCallback(async (currentUid, currentCareerPath) => {
    setSecondaryLoading(true);
    let [rm, dates, rev, cert] = await Promise.all([
      currentUid ? getCachedRoadmap(currentUid).catch(() => null) : Promise.resolve(null),
      currentUid ? getActivity(currentUid).catch(() => []) : Promise.resolve([]),
      currentUid ? getRevisionSchedule(currentUid).catch(() => ({ due: [], upcoming: [] })) : Promise.resolve({ due: [], upcoming: [] }),
      currentUid ? getCertificate(currentUid).catch(() => null) : Promise.resolve(null),
    ]);

    // A career path is set but no roadmap exists -> the post-assessment
    // roadmap generation step never landed. Try to rebuild it once
    // instead of showing a permanently stuck 0%/empty dashboard.
    if (currentUid && currentCareerPath && !rm) {
      rm = await selfHealMissingRoadmap(currentUid).catch(() => null);
      if (rm) {
        cert = await getCertificate(currentUid).catch(() => cert); // rebuild also (re)issues the certificate
      }
    }

    setRoadmap(rm);
    setActivityDates(dates);
    setRevision(rev);
    setCertificate(cert);
    setSecondaryLoading(false);
  }, []);

  // Waits for Firebase to actually confirm who's signed in (authReady)
  // before fetching anything, and re-fetches whenever uid changes —
  // covering login, logout, and switching accounts without a full page
  // reload — instead of the old "fetch once on mount" behavior.
  useEffect(() => {
    if (!authReady) return;
    let mounted = true;
    (async () => {
      const p = await loadPrimary();
      if (!mounted) return;
      await loadSecondary(uid, p?.careerPath);
    })();
    return () => {
      mounted = false;
    };
  }, [authReady, uid, loadPrimary, loadSecondary]);

  // Re-pulls everything, not just `profile` — an edit (e.g. career
  // path) can affect the roadmap/stats cards too, so a save should
  // bring the whole dashboard back in sync, not just the identity card.
  const refetchProfile = useCallback(async () => {
    const p = await getUserProfile();
    setProfile(p);
    await loadSecondary(uid, p?.careerPath);
  }, [uid, loadSecondary]);

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
    secondaryLoading,
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
