import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, CheckCircle2, PlayCircle, ArrowLeft, Circle, BookOpen, ClipboardCheck,
} from "lucide-react";
import BackButton from "../components/common/BackButton";
import TopicContentPane from "../components/learning/TopicContentPane";
import TopicQuizModal from "../components/learning/TopicQuizModal";
import LessonListPane from "../components/learning/LessonListPane";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { buildFlatTopicList, findStartingIndex, topicProgressKey } from "../utils/buildCourseNavigator";
import { getLessons, compositeTopicKey } from "../services/lessonService";
import { getTopicProgress } from "../services/topicQuizService";

/**
 * CourseWorkspaceScreen — Coursera-style layout, THREE-level main pane:
 *   - Left sidebar: just the MODULE list — clicking a module switches
 *     the main pane's list view to that module's contents.
 *   - Main pane, "list" view: collapsible sections per SKILL within the
 *     active module, each listing its TOPICS. Each topic is a small
 *     header (not itself clickable) followed by TWO clickable items —
 *     "Learning Resources" and "Test" — matching Coursera's per-item
 *     list. Test opens TopicQuizModal directly. Learning Resources
 *     opens...
 *   - Main pane, "lessons" view (NEW): the topic's ordered Lesson
 *     breakdown (services/lesson_service.py, generated + cached on
 *     first visit — see LessonListPane.jsx). Selecting a lesson opens...
 *   - Main pane, "content" view: TopicContentPane, now scoped to ONE
 *     LESSON — its `topic` prop is a composite "{topic} — {lessonTitle}"
 *     key (lessonService.compositeTopicKey()), which the backend's
 *     existing get_topic_package() treats as just another topic string
 *     for AI-notes caching + resource lookup, so no new content-fetching
 *     code was needed. Next/Previous move between LESSONS of the same
 *     topic (not between topics) — running off either end returns to
 *     the lessons list.
 *
 * Same underlying roadmap/syllabus data as before (buildFlatTopicList,
 * unchanged) — the Lessons layer sits ENTIRELY between the existing
 * Topic list and the existing TopicContentPane, touching neither.
 *
 * Still never a locking mechanism: every topic's two items are
 * clickable regardless of its Verified/Current/Locked status — that
 * status only changes the small subtitle text and whether a checkmark
 * shows.
 */
export default function CourseWorkspaceScreen({ roadmap, compressedSyllabus, initialEntry, uid, onBack }) {
  // Per-topic focus bands from the learner's actual topic-quiz results
  // (backend/routes/topic_quiz_routes.py's GET .../progress) — starts
  // empty (every topic falls back to its skill-level default band) and
  // fills in / updates as topics are quizzed. Keyed by
  // topicProgressKey(skill, topic) -> FocusBand, matching what
  // buildFlatTopicList expects.
  const [topicProgress, setTopicProgress] = useState({});

  const fetchTopicProgress = useCallback(async () => {
    if (!uid) return;
    try {
      const rows = await getTopicProgress(uid);
      const map = {};
      for (const row of rows) {
        if (row.FocusBand) map[topicProgressKey(row.Skill, row.Topic)] = row.FocusBand;
      }
      setTopicProgress(map);
    } catch {
      // Non-fatal — every topic just keeps using its skill-level
      // default band, same as before this feature existed.
    }
  }, [uid]);

  useEffect(() => {
    fetchTopicProgress();
  }, [fetchTopicProgress]);

  const flatTopics = useMemo(
    () => buildFlatTopicList(roadmap, compressedSyllabus, topicProgress),
    [roadmap, compressedSyllabus, topicProgress]
  );
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
  const [viewMode, setViewMode] = useState("lessons"); // "list" | "lessons" | "content"
  const [expandedSkills, setExpandedSkills] = useState(() => new Set(active ? [active.skill] : []));
  const [sidebarExpandedModule, setSidebarExpandedModule] = useState(() => active?.module ?? modules[0]?.name ?? null);
  const [quizTarget, setQuizTarget] = useState(null); // { skill, topic, focusBand } | null — Coursera-style "Test" item, opened from the list

  // Lessons layer: Topic -> ordered list of bite-sized Lessons -> content
  // per lesson. Owned here (not inside LessonListPane) because the
  // "content" view that follows a lesson selection also needs the
  // lesson's Title (composite topic key) and the full list (Next/
  // Previous between lessons) — see LessonListPane.jsx's docstring.
  const [lessonState, setLessonState] = useState("loading"); // loading | error | ready
  const [lessonErrorMessage, setLessonErrorMessage] = useState("");
  const [lessons, setLessons] = useState([]);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);

  const fetchLessonsForActiveTopic = useCallback(async () => {
    if (!active) return;
    setLessonState("loading");
    setLessonErrorMessage("");
    try {
      const result = await getLessons(active.skill, active.topic);
      setLessons(result);
      setLessonState("ready");
    } catch (err) {
      setLessonErrorMessage(err.message || "Something went wrong loading the lesson breakdown.");
      setLessonState("error");
    }
  }, [active]);

  // Refetch whenever the ACTIVE TOPIC changes (not on every render, and
  // not when only activeLessonIndex/viewMode change within the same topic).
  useEffect(() => {
    fetchLessonsForActiveTopic();
  }, [active?.skill, active?.topic]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const jumpToSkillFromSidebar = (moduleName, skillName) => {
    setActiveModuleName(moduleName);
    setViewMode("list");
    setExpandedSkills(new Set([skillName]));
  };

  const openTopic = (flatIdx) => {
    setActiveIndex(flatIdx);
    setActiveLessonIndex(0);
    setViewMode("lessons");
  };

  const openLesson = (lessonIdx) => {
    setActiveLessonIndex(lessonIdx);
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
              const isExpanded = sidebarExpandedModule === mod.name;
              return (
                <div key={mod.name || "all"}>
                  <div
                    className="flex items-center gap-1 px-1 py-0.5"
                    style={{ borderRadius: 10, background: isActive ? "rgba(124,111,224,0.14)" : "none" }}
                  >
                    <button
                      onClick={() => openModule(mod.name)}
                      className="flex-1 flex items-center gap-2.5 px-2 py-2 text-left min-w-0"
                      style={{ background: "none", border: "none", cursor: "pointer" }}
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
                    <button
                      onClick={() => setSidebarExpandedModule((prev) => (prev === mod.name ? null : mod.name))}
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{ width: 26, height: 26, borderRadius: 8, background: "none", border: "none", cursor: "pointer" }}
                      aria-label={isExpanded ? `Collapse ${mod.name}` : `Expand ${mod.name}`}
                    >
                      <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} style={{ display: "flex" }}>
                        <ChevronDown size={14} style={{ color: COLORS.textLight }} />
                      </motion.span>
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="flex flex-col gap-0.5 pl-6 py-1">
                          {mod.skills.map((sk) => {
                            const skVerified = sk.topics.filter((t) => t.topicStatus === "Verified").length;
                            const skComplete = sk.topics.length > 0 && skVerified === sk.topics.length;
                            const isSkillActive = isActive && expandedSkills.has(sk.name) && viewMode === "list";
                            return (
                              <button
                                key={sk.name}
                                onClick={() => jumpToSkillFromSidebar(mod.name, sk.name)}
                                className="flex items-center gap-2 px-2 py-1.5 text-left"
                                style={{
                                  borderRadius: 8,
                                  background: isSkillActive ? "rgba(124,111,224,0.10)" : "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                {skComplete ? (
                                  <CheckCircle2 size={12} style={{ color: "#22C55E", flexShrink: 0 }} />
                                ) : (
                                  <Circle size={12} style={{ color: COLORS.border, flexShrink: 0 }} />
                                )}
                                <span
                                  className="text-xs truncate"
                                  style={{
                                    color: isSkillActive ? COLORS.purple : COLORS.textMid,
                                    fontWeight: isSkillActive ? 700 : 500,
                                  }}
                                >
                                  {sk.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main pane */}
        <div className="flex-1 min-w-0">
          {viewMode === "lessons" && active ? (
            <div>
              <button
                onClick={() => setViewMode("list")}
                className="flex items-center gap-1.5 text-xs font-semibold mb-4"
                style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMid }}
              >
                <ArrowLeft size={14} /> Back to {active.module || "Course"} Contents
              </button>
              <div style={{ ...GLASS_CARD, borderRadius: 20, padding: 24 }}>
                <LessonListPane
                  topic={active.topic}
                  state={lessonState}
                  errorMessage={lessonErrorMessage}
                  lessons={lessons}
                  onSelectLesson={openLesson}
                  onRetry={fetchLessonsForActiveTopic}
                />
              </div>
            </div>
          ) : viewMode === "content" && active && lessons[activeLessonIndex] ? (
            <div>
              <button
                onClick={() => setViewMode("lessons")}
                className="flex items-center gap-1.5 text-xs font-semibold mb-4"
                style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMid }}
              >
                <ArrowLeft size={14} /> Back to {active.topic} Lessons
              </button>
              <TopicContentPane
                skill={active.skill}
                topic={compositeTopicKey(active.topic, lessons[activeLessonIndex].Title)}
                focusBand={active.focusBand}
                topicStatus={active.topicStatus}
                onTakeTest={() => setQuizTarget({ skill: active.skill, topic: active.topic, focusBand: active.focusBand })}
                onNext={() =>
                  activeLessonIndex < lessons.length - 1
                    ? setActiveLessonIndex((i) => i + 1)
                    : setViewMode("lessons")
                }
                onPrevious={() =>
                  activeLessonIndex > 0
                    ? setActiveLessonIndex((i) => i - 1)
                    : setViewMode("lessons")
                }
                hasNext
                hasPrevious
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
                              const isCurrent = flatIdx === activeIndex && (viewMode === "lessons" || viewMode === "content");
                              return (
                                <div key={t.topic} style={{ background: isCurrent ? "rgba(124,111,224,0.08)" : "transparent" }}>
                                  {/* Topic header — label only, not itself clickable; the two
                                      items below it (Learning Resources / Test) are the actual
                                      navigation targets, matching Coursera's per-item list. */}
                                  <div className="flex items-center gap-3 px-5 pt-3 pb-1">
                                    {t.topicStatus === "Verified" ? (
                                      <CheckCircle2 size={18} style={{ color: "#22C55E", flexShrink: 0 }} />
                                    ) : (
                                      <PlayCircle size={18} style={{ color: COLORS.textLight, flexShrink: 0 }} />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className="text-sm truncate"
                                        style={{ color: isCurrent ? COLORS.purple : COLORS.textDark, fontWeight: isCurrent ? 700 : 600 }}
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

                                  {/* Item 1 — Learning Resources */}
                                  <div
                                    onClick={() => openTopic(flatIdx)}
                                    className="flex items-center gap-3 pl-11 pr-5 py-2.5 cursor-pointer"
                                  >
                                    <BookOpen size={15} style={{ color: COLORS.purple, flexShrink: 0 }} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                                        Learning Resources
                                      </p>
                                      <p className="text-[11px]" style={{ color: COLORS.textLight }}>
                                        Notes, videos &amp; articles for this topic
                                      </p>
                                    </div>
                                  </div>

                                  {/* Item 2 — Test */}
                                  <div
                                    onClick={() => setQuizTarget({ skill: t.skill, topic: t.topic, focusBand: t.focusBand })}
                                    className="flex items-center gap-3 pl-11 pr-5 py-2.5 pb-3.5 cursor-pointer"
                                  >
                                    <ClipboardCheck size={15} style={{ color: COLORS.purple, flexShrink: 0 }} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                                        Test
                                      </p>
                                      <p className="text-[11px]" style={{ color: COLORS.textLight }}>
                                        10-question quiz · sets your next revision date
                                      </p>
                                    </div>
                                  </div>
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

      {quizTarget && (
        <TopicQuizModal
          skill={quizTarget.skill}
          topic={quizTarget.topic}
          focusBand={quizTarget.focusBand}
          uid={uid}
          onClose={() => setQuizTarget(null)}
          onComplete={() => {
            setQuizTarget(null);
            // Refresh so this topic's (and any other's) focus band
            // reflects the attempt just submitted — the content pane
            // re-fetches automatically since focusBand is one of its
            // fetch dependencies (see TopicContentPane.jsx). Also what
            // flips this topic's sidebar status to "Verified" (tick),
            // see buildCourseNavigator.js.
            fetchTopicProgress();

            // Auto-advance to the next topic in the flat list, if
            // there is one — same "open a topic" behavior as clicking
            // it in the sidebar (openTopic), landing on its Lessons view.
            if (activeIndex < flatTopics.length - 1) {
              openTopic(activeIndex + 1);
            }
          }}
        />
      )}
    </div>
  );
}
