import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight as ChevronRightIcon, CheckCircle2, Circle, Menu, X } from "lucide-react";
import BackButton from "../components/common/BackButton";
import TopicContentPane from "../components/learning/TopicContentPane";
import { COLORS, GLASS_CARD } from "../constants/theme";
import { buildFlatTopicList, findStartingIndex } from "../utils/buildCourseNavigator";

/**
 * CourseWorkspaceScreen — the "Start My Learning Journey" destination.
 * A professional two-pane workspace: a full Role -> Module -> Skill ->
 * Topic navigator on the left (built by utils/buildCourseNavigator.js
 * from the SAME roadmap + compressedSyllabus data RoadmapScreen already
 * loaded — no extra fetch), and the selected topic's content on the
 * right via TopicContentPane (identical component LearningSessionScreen
 * uses, so content never diverges between the two entry points).
 *
 * NOTHING here is locked. Every topic in the navigator is clickable
 * regardless of its diagnostic status (Verified/Current/Locked) or its
 * skill's roadmap status (mastered/upcoming/not_assessed) — those only
 * drive small visual indicators (a checkmark on Verified topics, a
 * status dot on skills) and the STARTING focusBand content is fetched
 * at, never whether a topic can be opened. This is the actual
 * "overview, not a locking mechanism" requirement in practice.
 */
export default function CourseWorkspaceScreen({ roadmap, compressedSyllabus, initialEntry, onBack }) {
  const flatTopics = useMemo(() => buildFlatTopicList(roadmap, compressedSyllabus), [roadmap, compressedSyllabus]);
  const [activeIndex, setActiveIndex] = useState(() => findStartingIndex(flatTopics, initialEntry));
  const active = flatTopics[activeIndex] || null;

  const [expandedModules, setExpandedModules] = useState(
    () => new Set(active ? [active.module].filter(Boolean) : [])
  );
  const [expandedSkills, setExpandedSkills] = useState(() => new Set(active ? [active.skill] : []));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const toggleModule = (name) =>
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  const toggleSkill = (name) =>
    setExpandedSkills((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const selectTopic = (index) => {
    setActiveIndex(index);
    setMobileNavOpen(false);
  };

  if (!roadmap || flatTopics.length === 0) {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20">
        <BackButton onClick={onBack} label="Back to Roadmap" />
        <div className="max-w-lg mx-auto text-center py-16 px-8" style={{ ...GLASS_CARD, borderRadius: 28 }}>
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            Nothing to show yet — take the diagnostic assessment first to generate your roadmap.
          </p>
        </div>
      </div>
    );
  }

  // Groups the flat list back into Module -> Skill -> [Topic] purely for
  // sidebar rendering — buildFlatTopicList() stays the single source of
  // truth for ORDER; this just re-nests that same order for display.
  const modules = [];
  for (const t of flatTopics) {
    let mod = modules.find((m) => m.name === t.module);
    if (!mod) {
      mod = { name: t.module, skills: [] };
      modules.push(mod);
    }
    let sk = mod.skills.find((s) => s.name === t.skill);
    if (!sk) {
      sk = { name: t.skill, status: t.skillStatus, topics: [] };
      mod.skills.push(sk);
    }
    sk.topics.push(t);
  }

  const sidebar = (
    <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>
      <p className="text-xs font-bold uppercase tracking-wide px-3 mb-1" style={{ color: COLORS.textLight }}>
        {roadmap.role || "Your Course"}
      </p>
      {modules.map((mod) => (
        <div key={mod.name || "all"}>
          {mod.name && (
            <button
              onClick={() => toggleModule(mod.name)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold"
              style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textDark }}
            >
              <span>{mod.name}</span>
              <motion.span animate={{ rotate: expandedModules.has(mod.name) ? 90 : 0 }} style={{ display: "flex" }}>
                <ChevronRightIcon size={14} />
              </motion.span>
            </button>
          )}
          <AnimatePresence initial={false}>
            {(!mod.name || expandedModules.has(mod.name)) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden" }}
              >
                {mod.skills.map((sk) => {
                  const badgeColor =
                    sk.status === "mastered" ? "#22C55E" : sk.status === "not_assessed" ? "#8DA9C4" : "#F59E0B";
                  return (
                    <div key={sk.name} className="pl-2">
                      <button
                        onClick={() => toggleSkill(sk.name)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                        style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMid }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: badgeColor, flexShrink: 0 }} />
                        <span className="flex-1 text-left truncate">{sk.name}</span>
                        <motion.span animate={{ rotate: expandedSkills.has(sk.name) ? 90 : 0 }} style={{ display: "flex" }}>
                          <ChevronRightIcon size={12} />
                        </motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {expandedSkills.has(sk.name) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: "hidden" }}
                          >
                            {sk.topics.map((t) => {
                              const flatIdx = flatTopics.indexOf(t);
                              const isActive = flatIdx === activeIndex;
                              return (
                                <button
                                  key={t.topic}
                                  onClick={() => selectTopic(flatIdx)}
                                  className="w-full flex items-center gap-2 pl-6 pr-3 py-1.5 text-xs text-left"
                                  style={{
                                    background: isActive ? "rgba(124,111,224,0.14)" : "none",
                                    borderRadius: 8,
                                    border: "none",
                                    cursor: "pointer",
                                    color: isActive ? COLORS.purple : COLORS.textMid,
                                    fontWeight: isActive ? 700 : 500,
                                  }}
                                >
                                  {t.topicStatus === "Verified" ? (
                                    <CheckCircle2 size={12} style={{ color: "#22C55E", flexShrink: 0 }} />
                                  ) : (
                                    <Circle size={8} style={{ color: COLORS.border, flexShrink: 0 }} />
                                  )}
                                  <span className="truncate">{t.topic}</span>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );

  return (
    <div className="px-4 sm:px-8 pt-10 pb-20">
      <div className="flex items-center justify-between gap-3 mb-2">
        <BackButton onClick={onBack} label="Back to Roadmap" />
        <button
          onClick={() => setMobileNavOpen(true)}
          className="sm:hidden flex items-center gap-1.5 text-xs font-semibold px-3 py-2 mb-6"
          style={{ borderRadius: 9999, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.5)", color: COLORS.textDark }}
        >
          <Menu size={14} /> Course Contents
        </button>
      </div>

      <div className="flex gap-6 items-start">
        {/* Desktop sidebar */}
        <div className="hidden sm:block p-4 flex-shrink-0" style={{ ...GLASS_CARD, borderRadius: 20, width: 260 }}>
          {sidebar}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {active && (
            <TopicContentPane
              skill={active.skill}
              topic={active.topic}
              focusBand={active.focusBand}
              topicStatus={active.topicStatus}
              onNext={() => selectTopic(activeIndex + 1)}
              onPrevious={() => selectTopic(activeIndex - 1)}
              hasNext={activeIndex < flatTopics.length - 1}
              hasPrevious={activeIndex > 0}
            />
          )}
        </div>
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sm:hidden fixed inset-0 flex"
            style={{ background: "rgba(13,27,61,0.45)", zIndex: 50 }}
            onClick={() => setMobileNavOpen(false)}
          >
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              onClick={(e) => e.stopPropagation()}
              className="p-4 h-full overflow-y-auto"
              style={{ width: 280, background: "#FAF7F0" }}
            >
              <button
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-1.5 text-xs font-semibold mb-4"
                style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMid }}
              >
                <X size={14} /> Close
              </button>
              {sidebar}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
