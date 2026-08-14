import { motion } from "framer-motion";
import { Target, ArrowRight } from "lucide-react";
import SectionCard from "./SectionCard";
import { COLORS, GRADIENTS } from "../../constants/theme";

/**
 * SECTION 2 — Current Learning Progress.
 * All values come from `progress` (learningProgress.js via
 * learningProgressService.js), so the bar/percentages update dynamically.
 */
export default function LearningProgressSection({ progress, onContinueLearning }) {
  if (!progress) return null;

  const eta = progress.estimatedCompletionDate
    ? new Date(progress.estimatedCompletionDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "TBD";

  return (
    <SectionCard icon={Target} title="Current Learning Progress" subtitle={progress.careerPath} delay={0.05}>
      <p className="text-sm" style={{ color: COLORS.textMid }}>
        Module: <span className="font-semibold" style={{ color: COLORS.textDark }}>{progress.currentModule}</span>
      </p>
      <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
        Topic: <span className="font-semibold" style={{ color: COLORS.textDark }}>{progress.currentTopic}</span>
      </p>

      <div className="mt-5">
        <div className="flex justify-between text-xs font-semibold mb-1.5" style={{ color: COLORS.textMid }}>
          <span>Overall Progress</span>
          <span>{progress.progressPercent}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.4)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress.progressPercent}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: GRADIENTS.purplePink }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6">
        <div>
          <p className="text-xs" style={{ color: COLORS.textLight }}>Completed Skills</p>
          <p className="text-base font-bold" style={{ color: COLORS.textDark }}>{progress.completedSkills}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: COLORS.textLight }}>Remaining Skills</p>
          <p className="text-base font-bold" style={{ color: COLORS.textDark }}>{progress.remainingSkills}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: COLORS.textLight }}>Est. Completion</p>
          <p className="text-base font-bold" style={{ color: COLORS.textDark }}>{eta}</p>
        </div>
      </div>

      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={onContinueLearning}
        className="flex items-center gap-2 mt-6 text-xs sm:text-sm font-semibold"
        style={{
          padding: "12px 26px",
          borderRadius: 9999,
          color: "#fff",
          border: "none",
          background: GRADIENTS.purpleSky,
          cursor: "pointer",
          boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
        }}
      >
        Continue Learning <ArrowRight size={15} />
      </motion.button>
    </SectionCard>
  );
}
