import { motion } from "framer-motion";
import { ClipboardList, Sparkles } from "lucide-react";
import SectionCard from "./SectionCard";
import { COLORS, GRADIENTS } from "../../constants/theme";

function AssessmentCard({ assessment, onStart, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="p-4"
      style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.3)" }}
    >
      <h3 className="text-sm font-bold" style={{ color: COLORS.textDark }}>{assessment.name}</h3>
      <p className="text-xs mt-0.5" style={{ color: COLORS.textMid }}>{assessment.module}</p>

      <div className="flex flex-wrap gap-2 mt-3">
        <span className="text-[11px] px-2 py-1 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.5)", color: "#8B5CF6" }}>
          {assessment.date} • {assessment.time}
        </span>
        <span className="text-[11px] px-2 py-1 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.5)", color: "#8B5CF6" }}>
          {assessment.difficulty}
        </span>
        <span className="text-[11px] px-2 py-1 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.5)", color: "#8B5CF6" }}>
          {assessment.duration}
        </span>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs font-semibold" style={{ color: COLORS.textMid }}>{assessment.status}</span>
        <button
          onClick={() => onStart(assessment)}
          className="text-xs font-semibold"
          style={{
            padding: "8px 18px",
            borderRadius: 9999,
            color: "#fff",
            border: "none",
            background: GRADIENTS.purplePink,
            cursor: "pointer",
          }}
        >
          Start Assessment
        </button>
      </div>
    </motion.div>
  );
}

/**
 * SECTION 3 — Upcoming Assessments.
 * Data comes from `assessments` (upcomingAssessments.js via
 * assessmentService.js). Shows a friendly empty state when there are none.
 */
export default function UpcomingAssessmentsSection({ assessments, onStartAssessment }) {
  return (
    <SectionCard icon={ClipboardList} title="Upcoming Assessments" delay={0.1}>
      {assessments && assessments.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {assessments.map((a, i) => (
            <AssessmentCard key={a.id} assessment={a} onStart={onStartAssessment} delay={i * 0.05} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center py-8">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: GRADIENTS.purpleSky }}
          >
            <Sparkles size={18} color="#fff" />
          </div>
          <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>You're all caught up!</p>
          <p className="text-xs mt-1" style={{ color: COLORS.textMid }}>No assessments scheduled right now.</p>
        </div>
      )}
    </SectionCard>
  );
}
