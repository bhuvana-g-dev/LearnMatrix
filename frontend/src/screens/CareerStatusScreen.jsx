import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Compass, TrendingUp, Map as MapIcon } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { ROLES, ROLE_TITLES } from "../constants/roles";
import RoleSelectionScreen from "./RoleSelectionScreen";
import { loadSavedAssessmentResult, loadSavedRoadmap } from "../services/aiAssessmentService";

/**
 * CareerStatusScreen — what "My Career Path" shows once a student has
 * actually completed a diagnostic assessment, instead of the generic
 * role picker every time. First-time students (no saved assessment yet)
 * see the normal RoleSelectionScreen, completely unchanged — this file
 * only changes what RETURNING students see.
 *
 * Checks loadSavedAssessmentResult() (already built for the assessment
 * page's own "don't regenerate on refresh" fix) — reused here rather
 * than adding a second way to answer "has this student done this yet".
 */
export default function CareerStatusScreen({
  uid, roles, rolesLoading, selectedRole, onSelectRole, onContinue, onNavigate,
}) {
  const [checking, setChecking] = useState(true);
  const [hasAssessment, setHasAssessment] = useState(false);
  const [overallScore, setOverallScore] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [exploring, setExploring] = useState(false);

  const check = useCallback(async () => {
    if (!uid) {
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const [assessment, savedRoadmap] = await Promise.all([
        loadSavedAssessmentResult(uid),
        loadSavedRoadmap(uid),
      ]);
      if (assessment) {
        setHasAssessment(true);
        setOverallScore(assessment.evaluation?.overall?.scorePercent ?? null);
        setRoadmap(savedRoadmap);
      } else {
        setHasAssessment(false);
      }
    } catch {
      // Fail open — if the check itself breaks, don't block the student
      // from at least seeing the normal role picker.
      setHasAssessment(false);
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

  // First-time student, or exploring other roles -> the normal picker.
  if (!hasAssessment || exploring) {
    return (
      <div>
        {hasAssessment && exploring && (
          <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6">
            <button
              onClick={() => setExploring(false)}
              className="text-sm font-semibold"
              style={{ color: COLORS.textMid, background: "none", border: "none", cursor: "pointer" }}
            >
              ← Back to my status
            </button>
          </div>
        )}
        <RoleSelectionScreen
          roles={roles}
          rolesLoading={rolesLoading}
          selectedRole={selectedRole}
          onSelectRole={onSelectRole}
          onContinue={onContinue}
        />
      </div>
    );
  }

  const roleData = ROLES.find((r) => r.id === selectedRole);
  const roleTitle = ROLE_TITLES[selectedRole] || "Developer";
  const emoji = roleData?.emoji || "💻";

  return (
    <div className="px-4 sm:px-8 pt-10 pb-20">
      <div className="max-w-2xl mx-auto">
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
            You're becoming a
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-6" style={{ color: COLORS.textDark }}>
            {roleTitle}
          </h1>

          <div className="flex flex-wrap justify-center gap-4 mb-8">
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
                <MapIcon size={16} style={{ color: COLORS.purple }} />
                <span className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                  Week {roadmap.currentWeek} of {roadmap.totalWeeks} · {roadmap.completionPercent}% complete
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.button
              onClick={() => onNavigate("roadmap")}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2 font-semibold"
              style={{
                padding: "14px 28px", borderRadius: 9999, color: "#fff", border: "none",
                background: GRADIENTS.purpleSky, cursor: "pointer",
                boxShadow: "0 8px 20px rgba(212,160,23,0.35)",
              }}
            >
              Continue to My Roadmap <ArrowRight size={16} />
            </motion.button>

            <motion.button
              onClick={() => setExploring(true)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2 font-semibold"
              style={{
                padding: "14px 28px", borderRadius: 9999, color: COLORS.textDark,
                border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.5)",
                cursor: "pointer",
              }}
            >
              <Compass size={16} /> Explore Other Courses
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
