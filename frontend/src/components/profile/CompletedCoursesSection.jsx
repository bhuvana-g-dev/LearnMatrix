import { motion } from "framer-motion";
import { GraduationCap, Award, Lock } from "lucide-react";
import SectionCard from "./SectionCard";
import { COLORS } from "../../constants/theme";

/**
 * SECTION 4 — Completed Learning Progress.
 * Data comes from `courses` (completedCourses.js via
 * completedCoursesService.js), shown as a card timeline.
 */
export default function CompletedCoursesSection({ courses, onViewDetails }) {
  return (
    <SectionCard icon={GraduationCap} title="Completed Learning Progress" delay={0.15}>
      {courses && courses.length > 0 ? (
        <div className="flex flex-col gap-3">
          {courses.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex items-center justify-between gap-3 p-4"
              style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.3)" }}
            >
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate" style={{ color: COLORS.textDark }}>{c.moduleName}</h3>
                <p className="text-xs mt-0.5" style={{ color: COLORS.textMid }}>
                  Completed {c.completionDate} • Score {c.finalScore}
                </p>
                <div
                  className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold"
                  style={{ color: c.certificateAvailable ? "#8B5CF6" : COLORS.textLight }}
                >
                  {c.certificateAvailable ? <Award size={12} /> : <Lock size={12} />}
                  {c.certificateAvailable ? "Certificate available" : "Certificate locked"}
                </div>
              </div>
              <button
                onClick={() => onViewDetails(c)}
                className="text-xs font-semibold flex-shrink-0"
                style={{
                  padding: "8px 16px",
                  borderRadius: 9999,
                  color: "#8B5CF6",
                  border: "1px solid rgba(139,92,246,0.4)",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                View Details
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-center py-6" style={{ color: COLORS.textMid }}>
          No completed modules yet — keep learning to see them here.
        </p>
      )}
    </SectionCard>
  );
}
