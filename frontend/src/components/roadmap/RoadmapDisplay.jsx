import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Zap, Compass, ChevronDown, Rocket, Flag } from "lucide-react";
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

// Authentic-brand-colored monogram per skill — a small, subject-specific
// touch (real HTML5/CSS3/JS/etc. hex values) instead of a generic
// placeholder circle, so the path actually looks like the technologies
// it represents. `label` stays short (2-4 chars) to fit the node.
// Unmapped skills fall back to a neutral navy monogram of their initials.
const SKILL_VISUALS = {
  html5: { label: "5", bg: "#E44D26", fg: "#fff" },
  html: { label: "5", bg: "#E44D26", fg: "#fff" },
  css3: { label: "3", bg: "#264DE4", fg: "#fff" },
  css: { label: "3", bg: "#264DE4", fg: "#fff" },
  javascript: { label: "JS", bg: "#F7DF1E", fg: "#0D1B3D" },
  typescript: { label: "TS", bg: "#3178C6", fg: "#fff" },
  bootstrap: { label: "B", bg: "#7952B3", fg: "#fff" },
  "tailwind css": { label: "~", bg: "#38BDF8", fg: "#fff" },
  tailwind: { label: "~", bg: "#38BDF8", fg: "#fff" },
  "react.js": { label: "⚛", bg: "#20232A", fg: "#61DAFB" },
  react: { label: "⚛", bg: "#20232A", fg: "#61DAFB" },
  "node.js": { label: "N", bg: "#3C873A", fg: "#fff" },
  node: { label: "N", bg: "#3C873A", fg: "#fff" },
  express: { label: "Ex", bg: "#000000", fg: "#fff" },
  "express.js": { label: "Ex", bg: "#000000", fg: "#fff" },
  mongodb: { label: "M", bg: "#13AA52", fg: "#fff" },
  mysql: { label: "SQL", bg: "#00758F", fg: "#fff" },
  postgresql: { label: "SQL", bg: "#336791", fg: "#fff" },
  sql: { label: "SQL", bg: "#00758F", fg: "#fff" },
  firebase: { label: "F", bg: "#F5820D", fg: "#fff" },
  git: { label: "Git", bg: "#F1502F", fg: "#fff" },
  github: { label: "Git", bg: "#171515", fg: "#fff" },
  docker: { label: "D", bg: "#2496ED", fg: "#fff" },
  python: { label: "Py", bg: "#3776AB", fg: "#FFD43B" },
  java: { label: "J", bg: "#5382A1", fg: "#fff" },
};

function skillVisual(skillName) {
  const key = (skillName || "").trim().toLowerCase();
  if (SKILL_VISUALS[key]) return SKILL_VISUALS[key];
  const initials = (skillName || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return { label: initials || "?", bg: COLORS.sky, fg: "#fff" };
}

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
 * Visual metaphor: since "roadmap" is the literal name of this screen
 * and the entries genuinely are an ordered path (mastered -> current ->
 * ahead), each module renders its skills strung along a connecting
 * vertical line, gold where already walked, faint dashed where still
 * ahead — a real path, not just a numbered list.
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
        <h3 className="text-base font-bold tracking-tight" style={{ color: COLORS.textDark }}>
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
      <div className="mb-7">
        <div className="flex items-center justify-between mb-1.5 text-xs font-semibold" style={{ color: COLORS.textMid }}>
          <span>Course Progress</span>
          <span>{completionPercent}% complete</span>
        </div>
        <div className="relative w-full h-2.5 rounded-full overflow-visible" style={{ background: "rgba(255,255,255,0.4)" }}>
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <motion.div
              initial={false}
              animate={{ width: `${completionPercent}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ height: "100%", background: GRADIENTS.purpleSky, borderRadius: 9999 }}
            />
          </div>
          {/* Little flag pin riding the edge of progress — the "you are here" marker on the path */}
          <motion.div
            initial={false}
            animate={{ left: `${completionPercent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute top-1/2"
            style={{ transform: "translate(-50%, -50%)" }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 18, height: 18, background: COLORS.sky, border: "2px solid #fff", boxShadow: "0 2px 6px rgba(13,27,61,0.35)" }}
            >
              <Flag size={9} style={{ color: COLORS.purple }} />
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex flex-col gap-7">
        {orderedGroups.map((group, groupIndex) => {
          const modMastered = group.entries.filter((e) => e.status === "mastered").length;

          return (
            <div key={group.name || "all-skills"}>
              {group.name && (
                <div className="flex items-center gap-3 mb-3.5">
                  <div
                    className="flex items-center justify-center rounded-xl font-bold text-xs flex-shrink-0"
                    style={{ width: 30, height: 30, background: GRADIENTS.purpleSky, color: "#fff" }}
                  >
                    {groupIndex + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.textDark }}>
                      Module {groupIndex + 1}: {group.name}
                    </p>
                  </div>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: COLORS.textLight }}>
                    {modMastered}/{group.entries.length} mastered
                  </span>
                </div>
              )}

              {/* The path — a connecting line strung through every skill node in
                  this module. Solid gold up through what's mastered, then a
                  faint dashed continuation for what's still ahead, so the list
                  reads as one route being walked rather than disconnected rows. */}
              <div className="relative flex flex-col gap-2 pl-[15px]">
                <div
                  className="absolute top-3 bottom-3 left-0 w-0.5"
                  style={{
                    background: `linear-gradient(to bottom, ${COLORS.purple} 0%, ${COLORS.purple} ${
                      group.entries.length > 1 ? (modMastered / (group.entries.length - 1)) * 100 : 100
                    }%, transparent ${group.entries.length > 1 ? (modMastered / (group.entries.length - 1)) * 100 : 100}%, transparent 100%)`,
                  }}
                />
                <div
                  className="absolute top-3 bottom-3 left-0 w-0.5"
                  style={{
                    background: "repeating-linear-gradient(to bottom, rgba(141,169,196,0.35) 0 4px, transparent 4px 8px)",
                    zIndex: -1,
                  }}
                />

                {group.entries.map((entry, entryIndex) => {
                  const topics = topicsForSkill(entry.skill);
                  const isExpanded = expandedSkill === entry.skill;
                  const isMastered = entry.status === "mastered";
                  const isNotAssessed = entry.status === "not_assessed";
                  const isCurrent = entry === suggestedStartEntry;
                  const visual = skillVisual(entry.skill);

                  const badgeLabel = isMastered ? "Mastered" : isNotAssessed ? "Recommended Start" : entry.currentLevel;
                  const badgeColor = LEVEL_COLORS[badgeLabel] || COLORS.textMid;
                  const rowBg = isMastered
                    ? "rgba(34,197,94,0.08)"
                    : isCurrent
                    ? "rgba(212,160,23,0.10)"
                    : isNotAssessed
                    ? "rgba(141,169,196,0.08)"
                    : "rgba(255,255,255,0.5)";

                  // Every skill is clickable, regardless of status — the
                  // roadmap is an overview, never a lock. Topic-expand
                  // (when topic data exists) is a secondary control via
                  // stopPropagation, never the only way to act on a row.
                  const primaryClick = onSelectEntry ? () => onSelectEntry(withCurrentTopic(entry)) : undefined;

                  return (
                    <motion.div
                      key={entry.skill}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: entryIndex * 0.03 }}
                      style={{ borderRadius: 14, background: rowBg, marginLeft: -15 }}
                    >
                      <div
                        onClick={primaryClick}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ cursor: primaryClick ? "pointer" : "default" }}
                      >
                        {/* Node on the path — a real brand-colored monogram
                            for the technology, with a mastered check or
                            "you are here" ring layered on top. */}
                        <div className="relative flex-shrink-0" style={{ width: 34, height: 34 }}>
                          <div
                            className="flex items-center justify-center w-full h-full font-bold text-[11px]"
                            style={{
                              borderRadius: 10,
                              background: visual.bg,
                              color: visual.fg,
                              boxShadow: isCurrent ? `0 0 0 3px rgba(212,160,23,0.35)` : "none",
                            }}
                          >
                            {visual.label}
                          </div>
                          {isMastered && (
                            <div
                              className="absolute flex items-center justify-center rounded-full"
                              style={{ width: 15, height: 15, bottom: -3, right: -3, background: "#22C55E", border: "2px solid #fff" }}
                            >
                              <CheckCircle2 size={9} style={{ color: "#fff" }} fill="#22C55E" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                            {entry.skill}
                          </span>
                          {isCurrent && entry.recommendation && (
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
                    </motion.div>
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

      {upcoming.length === 0 && notAssessed.length === 0 && mastered.length > 0 && (
        <div className="text-center py-6">
          <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
            🎉 You've mastered every skill in this course!
          </p>
        </div>
      )}

      {/* Motivational strip — a little breathing room before the CTA,
          only while there's still ground left to cover. */}
      {(upcoming.length > 0 || notAssessed.length > 0) && (
        <div
          className="relative overflow-hidden flex items-center gap-3 px-4 py-3 mt-6"
          style={{ borderRadius: 16, background: "rgba(212,160,23,0.10)", border: "1px solid rgba(212,160,23,0.18)" }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 34, height: 34, background: GRADIENTS.purpleSky }}
          >
            <Rocket size={16} style={{ color: "#fff" }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: COLORS.textDark }}>Stay consistent, keep building!</p>
            <p className="text-xs" style={{ color: COLORS.textMid }}>Little progress every day leads to big results.</p>
          </div>
        </div>
      )}

      {onStartJourney && (
        <motion.button
          onClick={() => onStartJourney(suggestedStartEntry ? withCurrentTopic(suggestedStartEntry) : null)}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 font-bold text-sm mt-4"
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
