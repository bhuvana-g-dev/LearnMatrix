import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, CheckCircle2, PlayCircle, ArrowLeft, Circle,
} from "lucide-react";
import BackButton from "../components/common/BackButton";
import TopicContentPane from "../components/learning/TopicContentPane";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { buildFlatTopicList, findStartingIndex } from "../utils/buildCourseNavigator";

/**
 * CourseWorkspaceScreen — Coursera-style layout:
 *   - Left sidebar: just the MODULE list (flat, like Coursera's
 *     "Course Material" panel) — clicking a module switches the main
 *     pane's list view to that module's contents.
 *   - Main pane, "list" view: collapsible sections per SKILL within the
 *     active module (Coursera's "Welcome to the Course" style
 *     sections), each listing its TOPICS as rows with an icon, title,
 *     and status subtitle. The current topic gets a highlighted row +
 *     "Resume" button, matching the reference screenshot.
 *   - Main pane, "content" view: TopicContentPane for whichever topic
 *     was clicked, with a small back link to return to the list.
 *
 * Same underlying data/logic as before (buildFlatTopicList +
 * TopicContentPane, both untouched) — this is a presentation-layer
 * rebuild only, no backend changes.
 *
 * Still never a locking mechanism: every topic row is clickable
 * regardless of its Verified/Current/Locked status — that status only
 * changes the small subtitle text and whether a checkmark shows.
 */
export default function CourseWorkspaceScreen({ roadmap, compressedSyllabus, initialEntry, uid, onBack }) {
  const flatTopics = useMemo(() => buildFlatTopicList(roadmap, compressedSyllabus), [roadmap, compressedSyllabus]);
  const [activeIndex, setActiveIndex] = useState(() => findStartingIndex(flatTopics, initialEntry));
  const active = flatTopics[activeIndex] || null;

  const modules = useMemo(() => {
    const list = [];
    for (const t of flatTopics) {
      let mod = list.find((m) => m.name === t.module);
      if (!mod) {
        mod = { name: t.module, skills: [] };
        list.push(mod);
      }
      let sk = mod.skills.find((s) => s.name === t.skill);
      if (!sk) {
        sk = { name: t.skill, status: t.skillStatus, topics: [] };
        mod.skills.push(sk);
      }
      sk.topics.push(t);
    }
    return list;
  }, [flatTopics]);

  const [activeModuleName, setActiveModuleName] = useState(() => active?.module ?? modules[0]?.name ?? null);
  const [viewMode, setViewMode] = useState("content"); // "list" | "content"
  const [expandedSkills, setExpandedSkills] = useState(() => new Set(active ? [active.skill] : []));

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

  const activeModule = modules.find((m) => m.name === activeModuleName) || modules[0];

  const toggleSkill = (name) =>
    setExpandedSkills((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const openModule = (moduleName) => {
    setActiveModuleName(moduleName);
    setViewMode("list");
    const firstSkillInModule = modules.find((m) => m.name === moduleName)?.skills[0]?.name;
    setExpandedSkills(new Set(firstSkillInModule ? [firstSkillInModule] : []));
  };

  const openTopic = (flatIdx) => {
    setActiveIndex(flatIdx);
    setViewMode("content");
  };

  const moduleProgress = (mod) => {
    const total = mod.skills.reduce((n, s) => n + s.topics.length, 0);
    const verified = mod.skills.reduce((n, s) => n + s.topics.filter((t) => t.topicStatus === "Verified").length, 0);
    return { total, verified };
  };

  const STATUS_SUBTITLE = {
    Verified: "Already verified on your diagnostic",
    Current: "Recommended next",
    Locked: "Not yet studied",
  };

  return (
    <div className="px-4 sm:px-8 pt-10 pb-20">
      <BackButton onClick={onBack} label="Back to Roadmap" />

      <div className="flex gap-6 items-start">
        {/* Sidebar — flat module list, Coursera-style */}
        <div className="hidden sm:block p-4 flex-shrink-0" style={{ ...GLASS_CARD, borderRadius: 20, width: 240 }}>
          <p className="text-xs font-bold uppercase tracking-wide px-1 mb-1" style={{ color: COLORS.textLight }}>
            {roadmap.role || "Your Course"}
          </p>
          <p className="text-[11px] px-1 mb-3" style={{ color: COLORS.textLight }}>Course Material</p>
          <div className="flex flex-col gap-1">
            {modules.map((mod) => {
              const { total, verified } = moduleProgress(mod);
              const isActive = mod.name === activeModuleName;
              const isComplete = total > 0 && verified === total;
              return (
                <button
                  key={mod.name || "all"}
                  onClick={() => openModule(mod.name)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-left"
                  style={{
                    borderRadius: 10,
                    background: isActive ? "rgba(124,111,224,0.14)" : "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {isComplete ? (
                    <CheckCircle2 size={16} style={{ color: "#22C55E", flexShrink: 0 }} />
                  ) : (
                    <Circle size={16} style={{ color: isActive ? COLORS.purple : COLORS.border, flexShrink: 0 }} />
                  )}
                  <span
                    className="text-sm truncate"
                    style={{ color: isActive ? COLORS.purple : COLORS.textDark, fontWeight: isActive ? 700 : 600 }}
                  >
                    {mod.name || "Skills"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main pane */}
        <div className="flex-1 min-w-0">
          {viewMode === "content" && active ? (
            <div>
              <button
                onClick={() => setViewMode("list")}
                className="flex items-center gap-1.5 text-xs font-semibold mb-4"
                style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMid }}
              >
                <ArrowLeft size={14} /> Back to {active.module || "Course"} Contents
              </button>
              <TopicContentPane
                skill={active.skill}
                topic={active.topic}
                focusBand={active.focusBand}
                topicStatus={active.topicStatus}
                uid={uid}
                onNext={() => openTopic(activeIndex + 1)}
                onPrevious={() => openTopic(activeIndex - 1)}
                hasNext={activeIndex < flatTopics.length - 1}
                hasPrevious={activeIndex > 0}
              />
            </div>
          ) : (
            activeModule && (
              <div style={{ ...GLASS_CARD, borderRadius: 20, overflow: "hidden" }}>
                <div className="p-5" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <h2 className="text-lg font-extrabold" style={{ color: COLORS.textDark }}>
                    {activeModule.name || "Your Skills"}
                  </h2>
                  <p className="text-xs mt-1" style={{ color: COLORS.textMid }}>
                    {activeModule.skills.length} skill{activeModule.skills.length === 1 ? "" : "s"} ·{" "}
                    {activeModule.skills.reduce((n, s) => n + s.topics.length, 0)} topics
                  </p>
                </div>

                {activeModule.skills.map((sk) => {
                  const isOpen = expandedSkills.has(sk.name);
                  return (
                    <div key={sk.name} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <button
                        onClick={() => toggleSkill(sk.name)}
                        className="w-full flex items-center justify-between px-5 py-3.5"
                        style={{ background: "none", border: "none", cursor: "pointer" }}
                      >
                        <span className="text-sm font-bold" style={{ color: COLORS.textDark }}>{sk.name}</span>
                        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} style={{ display: "flex" }}>
                          <ChevronDown size={16} style={{ color: COLORS.textLight }} />
                        </motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: "hidden" }}
                          >
                            {sk.topics.map((t) => {
                              const flatIdx = flatTopics.indexOf(t);
                              const isCurrent = flatIdx === activeIndex;
                              return (
                                <div
                                  key={t.topic}
                                  onClick={() => openTopic(flatIdx)}
                                  className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                                  style={{ background: isCurrent ? "rgba(124,111,224,0.14)" : "transparent" }}
                                >
                                  {t.topicStatus === "Verified" ? (
                                    <CheckCircle2 size={18} style={{ color: "#22C55E", flexShrink: 0 }} />
                                  ) : (
                                    <PlayCircle size={18} style={{ color: COLORS.textLight, flexShrink: 0 }} />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className="text-sm truncate"
                                      style={{ color: isCurrent ? COLORS.purple : COLORS.textDark, fontWeight: isCurrent ? 700 : 500 }}
                                    >
                                      {t.topic}
                                    </p>
                                    <p className="text-[11px]" style={{ color: COLORS.textLight }}>
                                      {STATUS_SUBTITLE[t.topicStatus] || "Topic"}
                                    </p>
                                  </div>
                                  {isCurrent && (
                                    <span
                                      className="text-xs font-bold px-3.5 py-1.5 rounded-full flex-shrink-0"
                                      style={{ background: GRADIENTS.purplePink, color: "#fff" }}
                                    >
                                      Resume
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
