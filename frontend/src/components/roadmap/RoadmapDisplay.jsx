import { motion } from "framer-motion";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";

export const LEVEL_COLORS = {
  Strong: "#22C55E",
  Intermediate: "#F59E0B",
  Weak: "#E0559C",
  "Not Attempted": "#9CA3AF",
};

/**
 * RoadmapDisplay — renders a Roadmap Agent result (services/roadmap_service.py's
 * Roadmap.to_dict() shape, whether freshly generated or loaded from
 * Firestore via GET /api/roadmap/<uid>).
 *
 * Used in two places:
 *  - AssessmentScreen.jsx, right after generating a fresh roadmap
 *  - RoadmapScreen.jsx ("My Roadmap" nav item), loading a saved one
 * Extracted here specifically so both stay visually identical without
 * copy-pasting the same ~100 lines of JSX twice.
 *
 * `showProgress` renders the currentWeek/completionPercent bar, which
 * only exists on a SAVED roadmap (fields set by roadmap_repository.py) —
 * a freshly-generated-but-not-yet-saved roadmap won't have them.
 */
export default function RoadmapDisplay({ roadmap, showProgress = false }) {
  return (
    <div className="p-6" style={{ ...GLASS_CARD, borderRadius: 24 }}>
      <h3 className="text-base font-bold mb-1" style={{ color: COLORS.textDark }}>
        Your Learning Roadmap
      </h3>
      <p className="text-sm mb-5" style={{ color: COLORS.textMid }}>
        {roadmap.entries.length > 0
          ? `${roadmap.totalWeeks}-week plan, weakest areas first`
          : "You're already strong across every skill tested — no revision needed."}
      </p>

      {showProgress && roadmap.entries.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5 text-xs font-semibold" style={{ color: COLORS.textMid }}>
            <span>Week {roadmap.currentWeek} of {roadmap.totalWeeks}</span>
            <span>{roadmap.completionPercent}% complete</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.4)" }}>
            <motion.div
              initial={false}
              animate={{ width: `${roadmap.completionPercent}%` }}
              transition={{ duration: 0.3 }}
              style={{ height: "100%", background: GRADIENTS.purpleSky, borderRadius: 9999 }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {roadmap.entries.map((entry) => (
          <div
            key={entry.skill}
            className="flex items-start gap-4 p-4"
            style={{ borderRadius: 16, background: "rgba(255,255,255,0.4)" }}
          >
            <div
              className="flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: GRADIENTS.purpleSky, color: "#fff",
              }}
            >
              {entry.week}
            </div>
            <div>
              <p className="font-semibold" style={{ color: COLORS.textDark }}>
                Week {entry.week}: {entry.skill}
                <span
                  className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full"
                  style={{ color: "#fff", background: LEVEL_COLORS[entry.currentLevel] || COLORS.textMid }}
                >
                  {entry.currentLevel}
                </span>
              </p>
              <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
                {entry.recommendation}
              </p>
            </div>
          </div>
        ))}

        {roadmap.includesProjectWeek && (
          <div
            className="flex items-start gap-4 p-4"
            style={{ borderRadius: 16, background: "rgba(255,255,255,0.4)" }}
          >
            <div
              className="flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: GRADIENTS.purplePink, color: "#fff",
              }}
            >
              {roadmap.totalWeeks}
            </div>
            <div>
              <p className="font-semibold" style={{ color: COLORS.textDark }}>
                Week {roadmap.totalWeeks}: Mini Project
              </p>
              <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
                Combine everything above into one small project to consolidate what you've learned.
              </p>
            </div>
          </div>
        )}
      </div>

      {roadmap.alreadyStrong.length > 0 && (
        <p className="text-xs mt-5" style={{ color: COLORS.textLight }}>
          Already strong (no revision scheduled): {roadmap.alreadyStrong.join(", ")}
        </p>
      )}
    </div>
  );
}
