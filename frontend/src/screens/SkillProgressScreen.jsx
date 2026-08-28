import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, XCircle, ArrowRight, Trophy, Sparkles, Compass, Zap, PartyPopper } from "lucide-react";
import BackButton from "../components/common/BackButton";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { getCachedRoadmap } from "../services/userProgressCache";

const PACE_STYLES = {
  "Fast-Track": { icon: Zap, color: "#D4A017", bg: "rgba(212,160,23,0.14)" },
  "Steady & Thorough": { icon: Compass, color: "#7C6FE0", bg: "rgba(124,111,224,0.14)" },
};

// Read-only skill pill — mastered ones get the green "done" treatment,
// everything else is clickable straight into that skill's Course
// Workspace (via onSelectSkill, same entry shape RoadmapDisplay uses).
function SkillPill({ label, mastered, onClick }) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileHover={onClick ? { y: -2 } : {}}
      whileTap={onClick ? { scale: 0.96 } : {}}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className="text-xs sm:text-sm font-medium"
      style={{
        padding: "9px 16px",
        borderRadius: 9999,
        background: mastered ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.5)",
        color: mastered ? "#15803D" : COLORS.textDark,
        border: mastered ? "1px solid rgba(34,197,94,0.3)" : `1px solid ${COLORS.border}`,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {mastered ? "✓ " : ""}
      {label}
    </motion.button>
  );
}

/**
 * SkillProgressScreen — what "Skill Selection" (My Career Path submenu)
 * becomes once a role is locked in (a saved roadmap exists). Picking
 * skills you "already know" only makes sense BEFORE the diagnostic —
 * App.jsx checks for a saved roadmap and renders this instead of
 * SkillSelectionScreen once one exists, so the nav link always shows
 * something meaningful instead of reopening the initial picker.
 *
 * Everything here is dynamic, straight off the saved roadmap
 * (backend/services/roadmap_service.py) — mastered/upcoming status per
 * skill is recomputed server-side every time a topic is completed in
 * the Learning Hub, so this page always reflects the latest state, no
 * matter which role happens to be the active one.
 */
export default function SkillProgressScreen({ uid, onNavigate, onSelectSkill }) {
  const [state, setState] = useState("loading"); // loading | empty | error | ready
  const [roadmap, setRoadmap] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchRoadmap = useCallback(async () => {
    if (!uid) {
      setState("error");
      setErrorMessage("You need to be logged in to view your skills.");
      return;
    }
    setState("loading");
    try {
      const result = await getCachedRoadmap(uid);
      if (result === null) {
        setState("empty");
      } else {
        setRoadmap(result);
        setState("ready");
      }
    } catch (err) {
      setErrorMessage(err.message || "Couldn't load your skills.");
      setState("error");
    }
  }, [uid]);

  useEffect(() => {
    fetchRoadmap();
  }, [fetchRoadmap]);

  if (state === "loading") {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20 flex justify-center">
        <div
          className="max-w-lg w-full flex flex-col items-center text-center gap-4 py-16 px-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}>
            <Loader2 size={40} style={{ color: COLORS.purple }} />
          </motion.div>
          <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            Loading your skills…
          </h3>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20 flex justify-center">
        <div
          className="max-w-lg w-full flex flex-col items-center text-center gap-4 py-14 px-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <XCircle size={40} style={{ color: "#E0559C" }} />
          <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            Couldn't load your skills
          </h3>
          <p className="text-sm" style={{ color: COLORS.textMid }}>{errorMessage}</p>
          <motion.button
            onClick={fetchRoadmap}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="mt-2 font-semibold"
            style={{
              padding: "12px 24px", borderRadius: 9999, color: "#fff", border: "none",
              background: GRADIENTS.purpleSky, cursor: "pointer",
            }}
          >
            Try Again
          </motion.button>
        </div>
      </div>
    );
  }

  // No roadmap yet — this page is only reachable pre-lock via the
  // regular skill-picker flow, so treat this as "not locked in yet"
  // and point back at the assessment rather than duplicating
  // SkillSelectionScreen's UI here.
  if (state === "empty") {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20 flex justify-center">
        <div
          className="max-w-lg w-full flex flex-col items-center text-center gap-4 py-16 px-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <Sparkles size={40} style={{ color: COLORS.purple }} />
          <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            No skills tracked yet
          </h3>
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            Finish the diagnostic assessment first — your known and in-progress
            skills show up here once your roadmap is built.
          </p>
          <motion.button
            onClick={() => onNavigate("initial-assessment")}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="mt-2 flex items-center gap-2 font-semibold"
            style={{
              padding: "14px 28px", borderRadius: 9999, color: "#fff", border: "none",
              background: GRADIENTS.purpleSky, cursor: "pointer",
            }}
          >
            Take the Assessment <ArrowRight size={16} />
          </motion.button>
        </div>
      </div>
    );
  }

  const mastered = roadmap.entries.filter((e) => e.status === "mastered");
  const inProgress = roadmap.entries.filter((e) => e.status !== "mastered");
  const paceStyle = PACE_STYLES[roadmap.paceLabel] || PACE_STYLES["Steady & Thorough"];
  const PaceIcon = paceStyle.icon;

  return (
    <div className="px-4 sm:px-8 pt-10 pb-20">
      <div className="mb-6">
        <BackButton onClick={() => onNavigate("role")} label="Back to My Career Path" />
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Current learning track */}
        <div className="p-6 mb-8" style={{ ...GLASS_CARD, borderRadius: 24 }}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: COLORS.textDark }}>
              {roadmap.role}
            </h1>
            <span
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full"
              style={{ color: paceStyle.color, background: paceStyle.bg }}
            >
              <PaceIcon size={13} /> {roadmap.paceLabel}
            </span>
          </div>
          <p className="text-sm mb-5" style={{ color: COLORS.textMid }}>
            Completed {roadmap.masteredCount} of {roadmap.totalSkills} skills · {roadmap.role}
          </p>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5 text-xs font-semibold" style={{ color: COLORS.textMid }}>
              <span>Overall Progress</span>
              <span>{roadmap.completionPercent}% complete</span>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.4)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${roadmap.completionPercent}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ height: "100%", background: GRADIENTS.purpleSky, borderRadius: 9999 }}
              />
            </div>
          </div>

          <motion.button
            onClick={() => onNavigate("roadmap")}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 font-semibold text-sm"
            style={{
              padding: "12px 24px", borderRadius: 9999, color: "#fff", border: "none",
              background: GRADIENTS.purpleSky, cursor: "pointer",
              boxShadow: "0 8px 20px rgba(192,132,252,0.35)",
            }}
          >
            Continue in Learning Hub <ArrowRight size={15} />
          </motion.button>
        </div>

        {/* Mastered skills */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={18} style={{ color: "#D4A017" }} />
            <h2 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
              Skills You've Mastered
            </h2>
          </div>
          <p className="text-xs mb-3" style={{ color: COLORS.textLight }}>
            Completed through the Learning Hub
          </p>
          {mastered.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.textMid }}>
              Nothing mastered yet — head to the Learning Hub to start your first skill.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {mastered.map((entry) => (
                <SkillPill key={entry.skill} label={entry.skill} mastered />
              ))}
            </div>
          )}
        </div>

        {/* In-progress skills */}
        <div>
          <h2 className="text-lg font-bold mb-1" style={{ color: COLORS.textDark }}>
            In Progress Skills
          </h2>
          <p className="text-xs mb-3" style={{ color: COLORS.textLight }}>
            Still working through these — tap one to jump back in
          </p>
          {inProgress.length === 0 ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.textMid }}>
              <PartyPopper size={16} style={{ color: "#D4A017" }} />
              You've mastered every skill in this track!
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {inProgress.map((entry) => (
                <SkillPill
                  key={entry.skill}
                  label={entry.skill}
                  onClick={onSelectSkill ? () => onSelectSkill(entry) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
