import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Zap, Compass, ChevronDown, Rocket } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import TopicList from "./TopicList";

export const LEVEL_COLORS = {
  Strong: "#22C55E",
  Mastered: "#22C55E",
  Intermediate: "#F59E0B",
  Weak: "#E0559C",
  "Not Attempted": "#9CA3AF",
  "Recommended Start": "#8DA9C4",
};

const PACE_STYLES = {
  "Fast-Track": { icon: Zap, color: "#D4A017", bg: "rgba(212,160,23,0.14)" },
  "Steady & Thorough": { icon: Compass, color: "#7C6FE0", bg: "rgba(124,111,224,0.14)" },
};

/**
 * RoadmapDisplay — an OVERVIEW of the learner's complete curriculum,
 * organized Module -> Skill (or just a flat skill list when the role
 * has no module/category data). This is deliberately NOT a locking
 * mechanism: every skill shown here is clickable regardless of its
 * status (services/roadmap_service.py's mastered/upcoming/not_assessed
 * classification only decides the BADGE and the starting focus band —
 * it never gates access). Clicking any skill opens the Course
 * Workspace at that skill's current topic (or its first topic if the
 * skill has never been assessed).
 *
 * "not_assessed" skills — never claimed/assessed against the role's
 * curriculum — get a single quiet "Recommended Start" badge instead of
 * a loud, repeated "Not Assessed" state. Being unassessed just means
 * "start this one from the foundation"; it isn't a special/blocked
 * state worth calling out over and over, so it isn't its own separate
 * section anymore (a prior version made this its own big call-out
 * block, which the "Recommended Start" wording deliberately removes).
 *
 * `compressedSyllabus` (optional) — {roleId, skills: [{skill, topics}]}
 * from services/syllabus_compression_service.py. When present, every
 * skill's topic-level Verified/Current/Locked breakdown can expand
 * inline (TopicList) as a secondary action alongside the primary click.
 * "Locked" here is ONLY a scoring/diagnostic label (services'
 * VERIFIED/CURRENT/LOCKED topic status) — it does not restrict opening
 * that topic in the workspace; see CourseWorkspaceScreen.jsx, which
 * treats the whole topic tree as always-open.
 *
 * `onStartJourney` (optional) — renders the "Start My Learning
 * Journey" CTA at the end, which opens the Course Workspace at a
 * sensibly-chosen starting entry (first upcoming skill, else first
 * not-yet-assessed skill, else the first mastered one).
 */
export default function RoadmapDisplay({ roadmap, showProgress = false, onSelectEntry, compressedSyllabus, onStartJourney }) {
  const [expandedSkill, setExpandedSkill] = useState(null);

  const topicsForSkill = (skillName) =>
    compressedSyllabus?.skills?.find((s) => s.skill === skillName)?.topics || null;

  // The ONE specific topic the learner should be studying right now for
  // a skill — so opening the workspace passes a real topic name instead
  // of falling back to the skill name. Returns null when there's no
  // compressedSyllabus for this skill (role/skill not topic-seeded yet)
  // — callers already fall back to the skill name in that case.
  const currentTopicForSkill = (skillName) => {
    const topics = topicsForSkill(skillName);
    const current = topics?.find((t) => t.status === "Current");
    return (current || topics?.[0])?.title || null;
  };

  const withCurrentTopic = (entry) => ({ ...entry, currentTopic: currentTopicForSkill(entry.skill) });

  const toggleExpand = (skillName) =>
    setExpandedSkill((current) => (current === skillName ? null : skillName));

  const mastered = roadmap.entries.filter((e) => e.status === "mastered");
  const upcoming = roadmap.entries.filter((e) => e.status === "upcoming");
  const notAssessed = roadmap.entries.filter((e) => e.status === "not_assessed");
  const completionPercent = showProgress ? roadmap.completionPercent : roadmap.courseCompletionPercent;
  const paceStyle = PACE_STYLES[roadmap.paceLabel] || PACE_STYLES["Steady & Thorough"];
  const PaceIcon = paceStyle.icon;

  // Every skill, in one flat list, grouped by module when module data
  // exists — a single unified rendering path instead of maintaining two
  // separate "module view" / "flat view" branches (a prior version of
  // this component did, and it doubled the surface area for every
  // change). Order within a group: mastered, then upcoming (already
  // worst-first from the backend), then not-assessed.
  const orderedGroups =
    roadmap.moduleOrder && roadmap.moduleOrder.length > 0
      ? roadmap.moduleOrder
          .map((name) => ({ name, entries: roadmap.entries.filter((e) => e.module === name) }))
          .filter((g) => g.entries.length > 0)
      : [{ name: null, entries: roadmap.entries }];

  const suggestedStartEntry = upcoming[0] || notAssessed[0] || mastered[0] || null;

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
        {roadmap.upcomingCount > 0 ? ` · ${roadmap.totalWeeks}-week personalized plan for the rest` : ""}
        {notAssessed.length > 0 ? ` · ${notAssessed.length} ready to start from the basics` : ""}
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

      <div className="flex flex-col gap-6">
        {orderedGroups.map((group, groupIndex) => (
          <div key={group.name || "all-skills"}>
            {group.name && (
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.textLight }}>
                  Module {groupIndex + 1}: {group.name}
                </p>
                <span className="text-xs" style={{ color: COLORS.textLight }}>
                  {group.entries.filter((e) => e.status === "mastered").length}/{group.entries.length} mastered
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {group.entries.map((entry) => {
                const topics = topicsForSkill(entry.skill);
                const isExpanded = expandedSkill === entry.skill;
                const isMastered = entry.status === "mastered";
                const isNotAssessed = entry.status === "not_assessed";

                const badgeLabel = isMastered ? "Mastered" : isNotAssessed ? "Recommended Start" : entry.currentLevel;
                const badgeColor = LEVEL_COLORS[badgeLabel] || COLORS.textMid;
                const rowBg = isMastered
                  ? "rgba(34,197,94,0.08)"
                  : isNotAssessed
                  ? "rgba(141,169,196,0.08)"
                  : "rgba(255,255,255,0.5)";

                // Every skill is clickable, regardless of status — the
                // roadmap is an overview, never a lock. Topic-expand
                // (when topic data exists) is a secondary control via
                // stopPropagation, never the only way to act on a row.
                const primaryClick = onSelectEntry ? () => onSelectEntry(withCurrentTopic(entry)) : undefined;

                return (
                  <div key={entry.skill} style={{ borderRadius: 14, background: rowBg }}>
                    <div
                      onClick={primaryClick}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ cursor: primaryClick ? "pointer" : "default" }}
                    >
                      {isMastered ? (
                        <CheckCircle2 size={20} style={{ color: "#22C55E", flexShrink: 0 }} />
                      ) : entry.status === "upcoming" ? (
                        <div
                          className="flex items-center justify-center font-bold text-xs flex-shrink-0"
                          style={{ width: 26, height: 26, borderRadius: "50%", background: GRADIENTS.purpleSky, color: "#fff" }}
                        >
                          {entry.week}
                        </div>
                      ) : (
                        <div style={{ width: 20, height: 20, flexShrink: 0 }} />
                      )}

                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                          {entry.skill}
                        </span>
                        {entry.status === "upcoming" && (
                          <p className="text-xs mt-0.5" style={{ color: COLORS.textMid }}>{entry.recommendation}</p>
                        )}
                      </div>

                      {isMastered && (
                        <span className="text-xs flex-shrink-0" style={{ color: COLORS.textLight }}>
                          {entry.scorePercent}%
                        </span>
                      )}
                      <span
                        className="px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0"
                        style={{ color: "#fff", background: badgeColor }}
                      >
                        {badgeLabel}
                      </span>

                      {topics && (
                        <motion.span
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(entry.skill);
                          }}
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          style={{ display: "flex", flexShrink: 0, cursor: "pointer" }}
                        >
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
        ))}

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

      {upcoming.length === 0 && notAssessed.length === 0 && mastered.length > 0 && (
        <div className="text-center py-6">
          <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
            🎉 You've mastered every skill in this course!
          </p>
        </div>
      )}

      {onStartJourney && (
        <motion.button
          onClick={() => onStartJourney(suggestedStartEntry ? withCurrentTopic(suggestedStartEntry) : null)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 font-bold text-sm mt-6"
          style={{
            padding: "16px 24px", borderRadius: 9999, color: "#fff", border: "none",
            background: GRADIENTS.purplePink, cursor: "pointer",
            boxShadow: "0 10px 24px rgba(192,132,252,0.4)",
          }}
        >
          <Rocket size={18} /> Start My Learning Journey
        </motion.button>
      )}
    </div>
  );
}
