import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Zap, Compass, ChevronDown } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import TopicList from "./TopicList";

export const LEVEL_COLORS = {
  Strong: "#22C55E",
  Intermediate: "#F59E0B",
  Weak: "#E0559C",
  "Not Attempted": "#9CA3AF",
  "Not Assessed": "#8DA9C4",
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
 * what's still wrong". When the roadmap was generated with a roleId,
 * entries also include status="not_assessed" — role skills the learner
 * never claimed/assessed, rendered as their own "Not Yet Assessed"
 * section so they never silently vanish from the roadmap.
 *
 * `compressedSyllabus` (optional) — the object
 * services/syllabus_compression_service.py's get_compressed_role_syllabus
 * returns: {roleId, skills: [{skill, topics: [...]}]}. When provided,
 * every entry (mastered or upcoming) becomes clickable to expand its
 * topic-level Verified/Current/Locked breakdown (TopicList). Omit it
 * and entries render exactly as before — no expand affordance at all.
 */
export default function RoadmapDisplay({ roadmap, showProgress = false, onSelectEntry, compressedSyllabus }) {
  const [expandedSkill, setExpandedSkill] = useState(null);

  const topicsForSkill = (skillName) =>
    compressedSyllabus?.skills?.find((s) => s.skill === skillName)?.topics || null;

  const toggleExpand = (skillName) =>
    setExpandedSkill((current) => (current === skillName ? null : skillName));

  const mastered = roadmap.entries.filter((e) => e.status === "mastered");
  const upcoming = roadmap.entries.filter((e) => e.status === "upcoming");
  const notAssessed = roadmap.entries.filter((e) => e.status === "not_assessed");
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
        {roadmap.upcomingCount > 0
          ? ` · ${roadmap.totalWeeks}-week plan for the rest`
          : notAssessed.length === 0
          ? " · nothing left to schedule!"
          : ""}
        {notAssessed.length > 0 ? ` · ${notAssessed.length} not yet assessed` : ""}
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

      {roadmap.moduleOrder && roadmap.moduleOrder.length > 0 ? (
        /* Module-grouped view — used whenever the roadmap was generated
           with role_categories (data/role_skill_categories.py). Every
           skill in the role appears under its module, each with its own
           status badge (Mastered/Weak/Intermediate/Not Assessed), so a
           Full Stack Developer sees Module 1: Frontend, Module 2:
           Backend, etc. instead of one flat mastered/upcoming split. */
        <div className="flex flex-col gap-6">
          {roadmap.moduleOrder.map((moduleName, moduleIndex) => {
            const moduleEntries = roadmap.entries.filter((e) => e.module === moduleName);
            if (moduleEntries.length === 0) return null;
            const moduleMasteredCount = moduleEntries.filter((e) => e.status === "mastered").length;

            return (
              <div key={moduleName}>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.textLight }}>
                    Module {moduleIndex + 1}: {moduleName}
                  </p>
                  <span className="text-xs" style={{ color: COLORS.textLight }}>
                    {moduleMasteredCount}/{moduleEntries.length} mastered
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {moduleEntries.map((entry) => {
                    const topics = topicsForSkill(entry.skill);
                    const isExpanded = expandedSkill === entry.skill;
                    const badgeLabel = entry.status === "not_assessed" ? "Not Assessed" : entry.currentLevel;
                    const badgeColor =
                      entry.status === "not_assessed"
                        ? LEVEL_COLORS["Not Assessed"]
                        : LEVEL_COLORS[entry.currentLevel] || COLORS.textMid;
                    const rowBg =
                      entry.status === "mastered"
                        ? "rgba(34,197,94,0.08)"
                        : entry.status === "not_assessed"
                        ? "rgba(141,169,196,0.1)"
                        : "rgba(255,255,255,0.5)";
                    const clickable = topics ? () => toggleExpand(entry.skill) : undefined;

                    return (
                      <div key={entry.skill} style={{ borderRadius: 14, background: rowBg }}>
                        <div
                          onClick={clickable}
                          className="flex items-center gap-3 px-4 py-3"
                          style={{ cursor: clickable ? "pointer" : "default" }}
                        >
                          {entry.status === "mastered" && (
                            <CheckCircle2 size={18} style={{ color: "#22C55E", flexShrink: 0 }} />
                          )}
                          {entry.status === "upcoming" && (
                            <div
                              className="flex items-center justify-center font-bold text-xs flex-shrink-0"
                              style={{ width: 26, height: 26, borderRadius: "50%", background: GRADIENTS.purpleSky, color: "#fff" }}
                            >
                              {entry.week}
                            </div>
                          )}
                          {entry.status === "not_assessed" && <div style={{ width: 26, height: 26, flexShrink: 0 }} />}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                              {entry.skill}
                            </span>
                            {entry.status === "upcoming" && (
                              <p className="text-xs mt-0.5" style={{ color: COLORS.textMid }}>
                                {entry.recommendation}
                              </p>
                            )}
                          </div>
                          <span
                            className="px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0"
                            style={{ color: "#fff", background: badgeColor }}
                          >
                            {badgeLabel}
                          </span>
                          {entry.status === "mastered" && (
                            <span className="text-xs flex-shrink-0" style={{ color: COLORS.textLight }}>
                              {entry.scorePercent}%
                            </span>
                          )}
                          {topics && (
                            <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} style={{ display: "flex", flexShrink: 0 }}>
                              <ChevronDown size={16} style={{ color: COLORS.textLight }} />
                            </motion.span>
                          )}
                        </div>
                        {topics && isExpanded && (
                          <div className="px-4 pb-3">
                            <TopicList topics={topics} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {roadmap.includesProjectWeek && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: COLORS.textLight }}>
                Final Step
              </p>
              <div className="flex items-center gap-3 p-4" style={{ borderRadius: 14, background: "rgba(255,255,255,0.5)" }}>
                <div
                  className="flex items-center justify-center font-bold text-xs flex-shrink-0"
                  style={{ width: 26, height: 26, borderRadius: "50%", background: GRADIENTS.purplePink, color: "#fff" }}
                >
                  {roadmap.totalWeeks}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>Mini Project</p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.textMid }}>
                    Combine everything above into one small project to consolidate what you've learned.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Mastered skills — a completed checklist, not part of the week timeline */}
          {mastered.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: COLORS.textLight }}>
                Already Mastered
              </p>
              <div className="flex flex-col gap-2">
                {mastered.map((entry) => {
                  const topics = topicsForSkill(entry.skill);
                  const isExpanded = expandedSkill === entry.skill;
                  return (
                    <div key={entry.skill} style={{ borderRadius: 14, background: "rgba(34,197,94,0.08)" }}>
                      <div
                        onClick={topics ? () => toggleExpand(entry.skill) : undefined}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ cursor: topics ? "pointer" : "default" }}
                      >
                        <CheckCircle2 size={20} style={{ color: "#22C55E", flexShrink: 0 }} />
                        <span className="text-sm font-semibold flex-1" style={{ color: COLORS.textDark }}>
                          {entry.skill}
                        </span>
                        <span className="text-xs" style={{ color: COLORS.textLight }}>
                          {entry.scorePercent}%
                        </span>
                        {topics && (
                          <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} style={{ display: "flex" }}>
                            <ChevronDown size={16} style={{ color: COLORS.textLight }} />
                          </motion.span>
                        )}
                      </div>
                      {topics && isExpanded && (
                        <div className="px-4 pb-3">
                          <TopicList topics={topics} />
                        </div>
                      )}
                    </div>
                  );
                })}
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
                {upcoming.map((entry) => {
                  const topics = topicsForSkill(entry.skill);
                  const isExpanded = expandedSkill === entry.skill;
                  return (
                    <motion.div
                      key={entry.skill}
                      whileHover={onSelectEntry ? { x: 3 } : {}}
                      className="relative p-4"
                      style={{ borderRadius: 16, background: "rgba(255,255,255,0.5)" }}
                    >
                      <div
                        onClick={onSelectEntry ? () => onSelectEntry(entry) : undefined}
                        className="flex items-start gap-4"
                        style={{ cursor: onSelectEntry ? "pointer" : "default" }}
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
                        {topics && (
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(entry.skill);
                            }}
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            style={{
                              display: "flex", background: "none", border: "none",
                              cursor: "pointer", padding: 4, marginTop: 4, flexShrink: 0,
                            }}
                          >
                            <ChevronDown size={18} style={{ color: COLORS.textLight }} />
                          </motion.button>
                        )}
                        {!topics && onSelectEntry && (
                          <ArrowRight size={18} style={{ color: COLORS.textLight, flexShrink: 0, marginTop: 4 }} />
                        )}
                      </div>
                      {topics && isExpanded && (
                        <div className="pl-[52px]">
                          <TopicList topics={topics} />
                        </div>
                      )}
                    </motion.div>
                  );
                })}

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

          {/* Not-yet-assessed role skills — still part of the curriculum, just
              never claimed/assessed. Its own section (not merged into "upcoming")
              since there's no diagnostic score to schedule these by yet. */}
          {notAssessed.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: COLORS.textLight }}>
                Not Yet Assessed
              </p>
              <p className="text-xs mb-2.5" style={{ color: COLORS.textLight }}>
                Part of your role's full curriculum — take a diagnostic on these whenever you're ready.
              </p>
              <div className="flex flex-col gap-2">
                {notAssessed.map((entry) => {
                  const topics = topicsForSkill(entry.skill);
                  const isExpanded = expandedSkill === entry.skill;
                  return (
                    <div key={entry.skill} style={{ borderRadius: 14, background: "rgba(141,169,196,0.1)" }}>
                      <div
                        onClick={topics ? () => toggleExpand(entry.skill) : undefined}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ cursor: topics ? "pointer" : "default" }}
                      >
                        <span
                          className="px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0"
                          style={{ color: "#fff", background: LEVEL_COLORS["Not Assessed"] }}
                        >
                          Not Assessed
                        </span>
                        <span className="text-sm font-semibold flex-1" style={{ color: COLORS.textDark }}>
                          {entry.skill}
                        </span>
                        {topics && (
                          <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} style={{ display: "flex" }}>
                            <ChevronDown size={16} style={{ color: COLORS.textLight }} />
                          </motion.span>
                        )}
                      </div>
                      {topics && isExpanded && (
                        <div className="px-4 pb-3">
                          <TopicList topics={topics} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {upcoming.length === 0 && notAssessed.length === 0 && mastered.length > 0 && (
        <div className="text-center py-6">
          <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
            🎉 You've mastered every skill in this course!
          </p>
        </div>
      )}
    </div>
  );
}
