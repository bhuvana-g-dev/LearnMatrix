import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Zap, Compass } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";

export const LEVEL_COLORS = {
  Strong: "#22C55E",
  Intermediate: "#F59E0B",
  Weak: "#E0559C",
  "Not Attempted": "#9CA3AF",
};

const PACE_STYLES = {
  "Fast-Track": { icon: Zap, color: "#D4A017", bg: "rgba(212,160,23,0.14)" },
  "Steady & Thorough": { icon: Compass, color: "#7C6FE0", bg: "rgba(124,111,224,0.14)" },
};

/**
 * RoadmapDisplay — renders the FULL course roadmap: every selected
 * skill, not just the weak ones. Mastered skills (status="mastered")
 * render as a completed checklist up top; everything still to learn
 * (status="upcoming") renders as a connected week-by-week timeline
 * below it, ending in a Mini Project week if there's more than one.
 *
 * This shape comes from services/roadmap_service.py's restructured
 * Roadmap.to_dict() — entries now always include mastered skills
 * instead of excluding them, specifically so this component can show
 * "how far through the whole course" a student is, not just "here's
 * what's still wrong".
 */
export default function RoadmapDisplay({ roadmap, showProgress = false, onSelectEntry }) {
  const mastered = roadmap.entries.filter((e) => e.status === "mastered");
  const upcoming = roadmap.entries.filter((e) => e.status === "upcoming");
  const completionPercent = showProgress ? roadmap.completionPercent : roadmap.courseCompletionPercent;
  const paceStyle = PACE_STYLES[roadmap.paceLabel] || PACE_STYLES["Steady & Thorough"];
  const PaceIcon = paceStyle.icon;

  return (
    <div className="p-6" style={{ ...GLASS_CARD, borderRadius: 24 }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h3 className="text-base font-bold" style={{ color: COLORS.textDark }}>
          Your Full Course Roadmap
        </h3>
        <span
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full"
          style={{ color: paceStyle.color, background: paceStyle.bg }}
        >
          <PaceIcon size={13} /> {roadmap.paceLabel}
        </span>
      </div>
      <p className="text-sm mb-5" style={{ color: COLORS.textMid }}>
        {roadmap.masteredCount} of {roadmap.totalSkills} skill(s) already mastered
        {roadmap.upcomingCount > 0 ? ` · ${roadmap.totalWeeks}-week plan for the rest` : " · nothing left to schedule!"}
      </p>

      {/* Overall course completion — the honest full-course number, not just "this week's plan" */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5 text-xs font-semibold" style={{ color: COLORS.textMid }}>
          <span>Course Progress</span>
          <span>{completionPercent}% complete</span>
        </div>
        <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.4)" }}>
          <motion.div
            initial={false}
            animate={{ width: `${completionPercent}%` }}
            transition={{ duration: 0.4 }}
            style={{ height: "100%", background: GRADIENTS.purpleSky, borderRadius: 9999 }}
          />
        </div>
      </div>

      {/* Mastered skills — a completed checklist, not part of the week timeline */}
      {mastered.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: COLORS.textLight }}>
            Already Mastered
          </p>
          <div className="flex flex-col gap-2">
            {mastered.map((entry) => (
              <div
                key={entry.skill}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderRadius: 14, background: "rgba(34,197,94,0.08)" }}
              >
                <CheckCircle2 size={20} style={{ color: "#22C55E", flexShrink: 0 }} />
                <span className="text-sm font-semibold flex-1" style={{ color: COLORS.textDark }}>
                  {entry.skill}
                </span>
                <span className="text-xs" style={{ color: COLORS.textLight }}>
                  {entry.scorePercent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming weeks — a connected timeline, the actual path still ahead */}
      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: COLORS.textLight }}>
            What's Ahead
          </p>
          <div className="relative flex flex-col gap-3">
            {/* connecting line behind the week circles, giving it an actual "journey" feel */}
            <div
              className="absolute"
              style={{ left: 21, top: 18, bottom: 18, width: 2, background: "rgba(212,160,23,0.25)" }}
            />
            {upcoming.map((entry) => (
              <motion.div
                key={entry.skill}
                onClick={onSelectEntry ? () => onSelectEntry(entry) : undefined}
                whileHover={onSelectEntry ? { x: 3 } : {}}
                className="relative flex items-start gap-4 p-4"
                style={{
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.5)",
                  cursor: onSelectEntry ? "pointer" : "default",
                }}
              >
                <div
                  className="flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: GRADIENTS.purpleSky, color: "#fff",
                    boxShadow: "0 0 0 4px rgba(250,247,240,0.9)",
                  }}
                >
                  {entry.week}
                </div>
                <div className="flex-1">
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
                {onSelectEntry && (
                  <ArrowRight size={18} style={{ color: COLORS.textLight, flexShrink: 0, marginTop: 4 }} />
                )}
              </motion.div>
            ))}

            {roadmap.includesProjectWeek && (
              <div
                className="relative flex items-start gap-4 p-4"
                style={{ borderRadius: 16, background: "rgba(255,255,255,0.5)" }}
              >
                <div
                  className="flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: GRADIENTS.purplePink, color: "#fff",
                    boxShadow: "0 0 0 4px rgba(250,247,240,0.9)",
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
        </div>
      )}

      {upcoming.length === 0 && mastered.length > 0 && (
        <div className="text-center py-6">
          <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
            🎉 You've mastered every skill in this course!
          </p>
        </div>
      )}
    </div>
  );
}
