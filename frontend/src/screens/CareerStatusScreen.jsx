import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, Compass, TrendingUp, Zap, Flame, BookOpen, Trophy, Sparkles } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { ROLES } from "../constants/roles";
import RoleSelectionScreen from "./RoleSelectionScreen";
import { loadSavedAssessmentResult, loadSavedRoadmap } from "../services/aiAssessmentService";
import { getActivity } from "../services/activityService";

const PACE_STYLES = {
  "Fast-Track": { icon: Zap, color: "#D4A017" },
  "Steady & Thorough": { icon: Compass, color: "#7C6FE0" },
};

/**
 * CareerStatusScreen — what "My Career Path" shows once a student has
 * completed a diagnostic assessment AND has a generated roadmap, instead
 * of the generic role picker every time.
 *
 * BUG FIX from the previous version: role name now comes from the
 * SAVED assessment (assessment.role, persisted in Firestore) instead of
 * careerPath.selectedRole — that's just in-memory React state
 * (useCareerPath.js starts it at `useState(null)`), so it silently
 * reset to null on every page refresh, falling back to a hardcoded
 * "Developer" default. The saved assessment's `role` field is the
 * actual source of truth and survives a refresh.
 *
 * BUG FIX ("exit role"): a saved assessment with NO roadmap yet (student
 * finished the diagnostic but never clicked "View Roadmap" on the
 * results screen) used to still count as "committed" here and show this
 * locked status card with a CTA into RoadmapScreen's "No roadmap yet"
 * dead end. That's not a real commitment yet — the role picker should
 * still be open at that point. Gated below on `hasAssessment && roadmap`.
 *
 * ONE-WAY DOOR, ON PURPOSE: once a student has a saved assessment AND a
 * roadmap for a role, this screen only ever shows their status for THAT
 * role — there's no "explore other courses" escape hatch here. Switching
 * courses is a deliberate action gated behind "Quit Role" in the
 * Learning Hub (RoadmapScreen.jsx), which requires typing a confirmation
 * phrase. Role Selection (the `!committed` branch below) opens back up
 * either after that quit succeeds, or any time a roadmap hasn't been
 * generated yet.
 */
export default function CareerStatusScreen({
  uid, displayName, roles, rolesLoading, selectedRole, onSelectRole, onContinue, onNavigate,
}) {
  const [checking, setChecking] = useState(true);
  const [hasAssessment, setHasAssessment] = useState(false);
  const [checkError, setCheckError] = useState(false);
  const [roleTitle, setRoleTitle] = useState("");
  const [overallScore, setOverallScore] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [activeDates, setActiveDates] = useState([]);

  const check = useCallback(async () => {
    if (!uid) {
      setChecking(false);
      return;
    }
    setChecking(true);
    setCheckError(false);
    try {
      const [assessment, savedRoadmap, dates] = await Promise.all([
        loadSavedAssessmentResult(uid),
        loadSavedRoadmap(uid),
        getActivity(uid).catch(() => []), // streak is a nice-to-have, never block the page on it
      ]);
      if (assessment) {
        setHasAssessment(true);
        setRoleTitle(assessment.role || "Developer");
        setOverallScore(assessment.evaluation?.overall?.scorePercent ?? null);
        setRoadmap(savedRoadmap);
        setActiveDates(dates);
      } else {
        setHasAssessment(false);
      }
    } catch {
      // Do NOT treat a failed check as "this student never took the
      // assessment" — that silently sent students who'd already started
      // learning back through Role Selection -> Skill Selection from
      // scratch any time this request was slow (e.g. Render free-tier
      // cold start) or briefly failed. Surface a retry instead.
      setHasAssessment(false);
      setCheckError(true);
    } finally {
      setChecking(false);
    }
  }, [uid]);

  useEffect(() => {
    check();
  }, [check]);

  if (checking) {
    return (
      <div className="px-4 sm:px-8 pt-16 flex justify-center">
        <Loader2 size={28} className="animate-spin" style={{ color: COLORS.purple }} />
      </div>
    );
  }

  if (checkError) {
    return (
      <div className="px-4 sm:px-8 pt-16 flex flex-col items-center gap-3 text-center">
        <p className="text-sm" style={{ color: COLORS.textMid }}>
          Couldn't check your progress — the server may still be starting up.
        </p>
        <button
          onClick={check}
          className="text-sm font-semibold px-4 py-2"
          style={{ borderRadius: 9999, background: COLORS.purple, color: "#fff", border: "none", cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    );
  }

  // "Committed" = both an assessment AND a generated roadmap exist.
  // Assessment-without-roadmap is a half-finished state, not a real
  // commitment — Role Selection should still be open then (see the
  // "exit role" bug-fix note above).
  const committed = hasAssessment && !!roadmap;

  if (!committed) {
    return (
      <RoleSelectionScreen
        roles={roles}
        rolesLoading={rolesLoading}
        selectedRole={selectedRole}
        onSelectRole={onSelectRole}
        onContinue={onContinue}
      />
    );
  }

  const roleData = ROLES.find((r) => r.title === roleTitle || r.id === selectedRole);
  const emoji = roleData?.emoji || "💻";
  const firstName = (displayName || "").trim().split(" ")[0];
  const greeting = firstName ? `${firstName}, you're becoming a` : "You're becoming a";

  const paceStyle = roadmap ? PACE_STYLES[roadmap.paceLabel] || PACE_STYLES["Steady & Thorough"] : null;
  const PaceIcon = paceStyle?.icon;

  // Real classification from the saved roadmap (services/roadmap_service.py)
  // — never fabricated. "mastered" entries vs everything else (still
  // upcoming or not yet assessed), same split RoadmapDisplay uses.
  const entries = roadmap?.entries || [];
  const masteredSkills = entries.filter((e) => e.status === "mastered").map((e) => e.skill);
  const inProgressSkills = entries.filter((e) => e.status !== "mastered").map((e) => e.skill);

  // Same "what to work on next" pick RoadmapDisplay uses for its
  // suggested-start entry: first upcoming, else first not-yet-assessed,
  // else fall back to the first mastered skill.
  const continueEntry =
    entries.find((e) => e.status === "upcoming") ||
    entries.find((e) => e.status === "not_assessed") ||
    entries.find((e) => e.status === "mastered") ||
    null;

  // Last 7 calendar days, oldest to newest, each flagged active/inactive.
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    return { label: d.toLocaleDateString(undefined, { weekday: "narrow" }), active: activeDates.includes(iso) };
  });
  const streakCount = (() => {
    let count = 0;
    for (let i = last7Days.length - 1; i >= 0; i--) {
      if (last7Days[i].active) count++;
      else break;
    }
    return count;
  })();

  return (
    <div className="px-4 sm:px-8 pt-10 pb-20">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center py-12 px-8"
          style={{ ...GLASS_CARD, borderRadius: 32 }}
        >
          <div
            className="flex items-center justify-center text-4xl mx-auto mb-5"
            style={{
              width: 84, height: 84, borderRadius: 9999,
              background: GRADIENTS.purplePink,
              boxShadow: "0 8px 28px rgba(212,160,23,0.35)",
            }}
          >
            {emoji}
          </div>

          <p className="text-sm font-semibold mb-1" style={{ color: COLORS.textMid }}>
            {greeting}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-6" style={{ color: COLORS.textDark }}>
            {roleTitle}
          </h1>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {overallScore !== null && (
              <div
                className="flex items-center gap-2 px-4 py-2"
                style={{ borderRadius: 14, background: "rgba(255,255,255,0.5)" }}
              >
                <TrendingUp size={16} style={{ color: COLORS.purple }} />
                <span className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                  {overallScore}% on diagnostic assessment
                </span>
              </div>
            )}
            {roadmap && (
              <div
                className="flex items-center gap-2 px-4 py-2"
                style={{ borderRadius: 14, background: "rgba(255,255,255,0.5)" }}
              >
                <PaceIcon size={16} style={{ color: paceStyle.color }} />
                <span className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                  {roadmap.completionPercent}% through the course · {roadmap.paceLabel}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {/*
              `roadmap` is guaranteed truthy here now — this whole card
              only renders once `committed` (hasAssessment && roadmap) is
              true (see the gate above). Kept as a fallback rather than
              hardcoding "roadmap" in case that gate ever loosens again.
            */}
            <motion.button
              onClick={() => onNavigate(roadmap ? "roadmap" : "initial-assessment")}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2 font-semibold"
              style={{
                padding: "14px 28px", borderRadius: 9999, color: "#fff", border: "none",
                background: GRADIENTS.purpleSky, cursor: "pointer",
                boxShadow: "0 8px 20px rgba(212,160,23,0.35)",
              }}
            >
              {roadmap ? "Continue to My Roadmap" : "Continue to My Assessment"} <ArrowRight size={16} />
            </motion.button>
          </div>
        </motion.div>

        {/* Continue Learning + This Week's Activity, side by side on larger screens */}
        <div className="grid sm:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6 flex flex-col"
            style={{ ...GLASS_CARD, borderRadius: 24 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={16} style={{ color: COLORS.purple }} />
              <h3 className="text-sm font-bold" style={{ color: COLORS.textDark }}>
                Continue Learning
              </h3>
            </div>

            {continueEntry ? (
              <>
                <p className="text-base font-bold" style={{ color: COLORS.textDark }}>
                  {continueEntry.skill}
                </p>
                {continueEntry.module && (
                  <p className="text-xs mt-0.5" style={{ color: COLORS.textLight }}>
                    {continueEntry.module}
                  </p>
                )}

                {roadmap && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs font-semibold mb-1.5" style={{ color: COLORS.textMid }}>
                      <span>Course Progress</span>
                      <span>{roadmap.completionPercent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(13,27,61,0.06)" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${roadmap.completionPercent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: GRADIENTS.purpleSky }}
                      />
                    </div>
                  </div>
                )}

                <motion.button
                  onClick={() => onNavigate("roadmap")}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center gap-2 font-semibold mt-5"
                  style={{
                    padding: "12px 22px", borderRadius: 9999, color: "#fff", border: "none",
                    background: GRADIENTS.purpleSky, cursor: "pointer",
                  }}
                >
                  Continue Learning <ArrowRight size={14} />
                </motion.button>
              </>
            ) : (
              <p className="text-xs" style={{ color: COLORS.textLight }}>
                Head to the Learning Hub to start your first skill.
              </p>
            )}
          </motion.div>

          {/* Real activity streak — actual recorded login days, not decorative */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="p-6"
            style={{ ...GLASS_CARD, borderRadius: 24 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: COLORS.textDark }}>
                This Week's Activity
              </h3>
              {streakCount > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold" style={{ color: "#E0559C" }}>
                  <Flame size={14} /> {streakCount}-day streak
                </span>
              )}
            </div>
            <div className="flex justify-between gap-2">
              {last7Days.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="text-[10px] font-semibold" style={{ color: COLORS.textLight }}>
                    {day.label}
                  </span>
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: day.active ? GRADIENTS.purpleSky : "rgba(13,27,61,0.06)",
                    }}
                  >
                    {day.active && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Skill breakdown, straight from the saved roadmap's real
            mastered/upcoming/not_assessed classification — same source
            RoadmapDisplay uses, so this never drifts from My Roadmap. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="p-6"
          style={{ ...GLASS_CARD, borderRadius: 24 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={16} style={{ color: COLORS.purple }} />
            <h3 className="text-sm font-bold" style={{ color: COLORS.textDark }}>
              Skills You've Mastered
            </h3>
          </div>
          <p className="text-xs mb-3" style={{ color: COLORS.textLight }}>
            Completed through the Learning Hub
          </p>

          {masteredSkills.length === 0 ? (
            <p className="text-xs mb-2" style={{ color: COLORS.textLight }}>
              Nothing mastered yet — head to the Learning Hub to start your first skill.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-2">
              {masteredSkills.map((skill) => (
                <span
                  key={skill}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(34,197,94,0.12)", color: "#16A34A" }}
                >
                  {skill}
                </span>
              ))}
            </div>
          )}

          {inProgressSkills.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-5 mb-1">
                <Sparkles size={14} style={{ color: COLORS.purple }} />
                <h4 className="text-sm font-bold" style={{ color: COLORS.textDark }}>
                  In Progress Skills
                </h4>
              </div>
              <p className="text-xs mb-3" style={{ color: COLORS.textLight }}>
                Still working through these — tap one to jump back in
              </p>
              <div className="flex flex-wrap gap-2">
                {inProgressSkills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => onNavigate("roadmap")}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{
                      background: "rgba(255,255,255,0.6)",
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.textMid,
                      cursor: "pointer",
                    }}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
