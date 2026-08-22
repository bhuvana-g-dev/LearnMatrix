import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronRight, CheckCircle2, ArrowLeft, Circle,
  Check, Code2, Monitor, Server, Database as DatabaseIcon, Wrench, Layers, Sparkles,
} from "lucide-react";
import BackButton from "../components/common/BackButton";
import TopicContentPane from "../components/learning/TopicContentPane";
import TopicQuizModal from "../components/learning/TopicQuizModal";
import LessonListPane from "../components/learning/LessonListPane";
import ProgressRing from "../components/learning/ProgressRing";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { buildFlatTopicList, findStartingIndex, topicProgressKey } from "../utils/buildCourseNavigator";
import { getLessons, compositeTopicKey } from "../services/lessonService";
import { getTopicProgress } from "../services/topicQuizService";
import {
  setLessonTotal, markLessonComplete, getCompletedLessons, getLessonScores, firstIncompleteIndex, LESSON_PASS_THRESHOLD,
} from "../utils/lessonProgress";

// Known skill sections get a purpose-picked icon, accent color, and one-line
// subtitle (mirrors the "Frontend / Backend / Database / Tools" set every
// generated roadmap tends to converge on). Anything else falls back to a
// generic icon + a color pulled from a fixed rotation so it still reads as
// "designed" rather than default-gray, and a generic subtitle.
const SKILL_META = {
  frontend: { icon: Monitor, color: "#7C6FE0", subtitle: "Learn the building blocks of the web" },
  backend: { icon: Server, color: "#22C55E", subtitle: "Develop the logic behind the scenes" },
  database: { icon: DatabaseIcon, color: "#3B82F6", subtitle: "Store and manage your data" },
  tools: { icon: Wrench, color: "#F97316", subtitle: "Boost your productivity" },
};
const SKILL_ACCENT_ROTATION = ["#7C6FE0", "#22C55E", "#3B82F6", "#F97316", "#EC4899", "#14B8A6"];
function getSkillMeta(name, index) {
  const known = SKILL_META[(name || "").trim().toLowerCase()];
  if (known) return known;
  return {
    icon: Layers,
    color: SKILL_ACCENT_ROTATION[index % SKILL_ACCENT_ROTATION.length],
    subtitle: "Explore the topics in this skill",
  };
}

// Per-technology badge (short abbreviation + brand-ish color pair) shown next
// to each topic row. Covers the technologies that show up across generated
// roadmaps most often; anything unrecognized still gets a legible badge via
// a deterministic color/abbreviation derived from its own name, so the list
// never falls back to a bare gray dot.
const TECH_BADGES = {
  html5: { abbr: "5", bg: "#FEE2D5", color: "#E44D26" },
  html: { abbr: "5", bg: "#FEE2D5", color: "#E44D26" },
  css3: { abbr: "3", bg: "#D6E9FB", color: "#264DE4" },
  css: { abbr: "3", bg: "#D6E9FB", color: "#264DE4" },
  javascript: { abbr: "JS", bg: "#FEF3C7", color: "#CA8A04" },
  typescript: { abbr: "TS", bg: "#DBEAFE", color: "#2563EB" },
  bootstrap: { abbr: "B", bg: "#EDE4FB", color: "#7C3AED" },
  "tailwind css": { abbr: "~", bg: "#CFFAFE", color: "#0891B2" },
  tailwind: { abbr: "~", bg: "#CFFAFE", color: "#0891B2" },
  "react.js": { abbr: "R", bg: "#DFF5FD", color: "#0EA5E9" },
  react: { abbr: "R", bg: "#DFF5FD", color: "#0EA5E9" },
  "node.js": { abbr: "N", bg: "#DCFCE7", color: "#22C55E" },
  node: { abbr: "N", bg: "#DCFCE7", color: "#22C55E" },
  "express.js": { abbr: "Ex", bg: "#E5E7EB", color: "#374151" },
  express: { abbr: "Ex", bg: "#E5E7EB", color: "#374151" },
  mongodb: { abbr: "M", bg: "#D8F5E3", color: "#10B981" },
  mysql: { abbr: "Y", bg: "#DCEEFB", color: "#1D63A8" },
  postgresql: { abbr: "P", bg: "#DCEAFB", color: "#336699" },
  postgres: { abbr: "P", bg: "#DCEAFB", color: "#336699" },
  git: { abbr: "Git", bg: "#FEE2D5", color: "#F05033" },
  github: { abbr: "Hub", bg: "#E5E7EB", color: "#111827" },
  docker: { abbr: "D", bg: "#DBEAFE", color: "#2496ED" },
  redis: { abbr: "R", bg: "#FEE2E2", color: "#DC2626" },
  graphql: { abbr: "GQL", bg: "#F5D9F8", color: "#E10098" },
  "next.js": { abbr: "N", bg: "#E5E7EB", color: "#111827" },
  "vue.js": { abbr: "V", bg: "#DCFCE7", color: "#42B883" },
  vue: { abbr: "V", bg: "#DCFCE7", color: "#42B883" },
  angular: { abbr: "A", bg: "#FEE2E2", color: "#DD0031" },
};
const BADGE_BG_ROTATION = ["#EDE4FB", "#D6E9FB", "#DCFCE7", "#FEF3C7", "#FEE2E2", "#CFFAFE"];
const BADGE_COLOR_ROTATION = ["#7C3AED", "#264DE4", "#22C55E", "#CA8A04", "#DC2626", "#0891B2"];
function getTopicBadge(name) {
  const key = (name || "").trim().toLowerCase();
  if (TECH_BADGES[key]) return TECH_BADGES[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const idx = hash % BADGE_BG_ROTATION.length;
  const abbr = (name || "?").trim().slice(0, 2).toUpperCase() || "?";
  return { abbr, bg: BADGE_BG_ROTATION[idx], color: BADGE_COLOR_ROTATION[idx] };
}

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

  // Bumped whenever a lesson is marked complete, so flatTopics (and the
  // sidebar ticks derived from it) recompute even though roadmap/
  // compressedSyllabus/topicProgress themselves didn't change — see
  // utils/lessonProgress.js, read synchronously from localStorage.
  const [lessonProgressVersion, setLessonProgressVersion] = useState(0);

  const flatTopics = useMemo(
    () => buildFlatTopicList(roadmap, compressedSyllabus, topicProgress, uid),
    [roadmap, compressedSyllabus, topicProgress, uid, lessonProgressVersion]
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

  // Lessons layer: Topic -> ordered list of bite-sized Lessons -> content
  // per lesson. Owned here (not inside LessonListPane) because the
  // "content" view that follows a lesson selection also needs the
  // lesson's Title (composite topic key) and the full list (Next/
  // Previous between lessons) — see LessonListPane.jsx's docstring.
  const [lessonState, setLessonState] = useState("loading"); // loading | error | ready
  const [lessonErrorMessage, setLessonErrorMessage] = useState("");
  const [lessons, setLessons] = useState([]);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  // Which of the CURRENT topic's lessons are already finished — see
  // utils/lessonProgress.js. Drives LessonListPane's per-lesson ticks
  // and where "Resume" lands when the topic is reopened.
  const [completedLessons, setCompletedLessons] = useState(new Set());
  // { [lessonOrder]: scorePercent } for the current topic's passed
  // lessons — drives the "Scored X%" mark shown on the quiz card once
  // lessonQuizDone is true (TopicContentPane).
  const [lessonScores, setLessonScores] = useState({});

  const fetchLessonsForActiveTopic = useCallback(async () => {
    if (!active) return;
    setLessonState("loading");
    setLessonErrorMessage("");
    try {
      const result = await getLessons(active.skill, active.topic);
      setLessons(result);
      setLessonState("ready");
      // Cache the lesson count so isTopicFullyComplete() can answer
      // synchronously (no network) — see buildCourseNavigator.js.
      setLessonTotal(uid, active.skill, active.topic, result.length);
      setCompletedLessons(getCompletedLessons(uid, active.skill, active.topic));
      setLessonScores(getLessonScores(uid, active.skill, active.topic));
      // Resume where the learner left off in THIS topic, instead of
      // always restarting at lesson 1.
      setActiveLessonIndex(firstIncompleteIndex(uid, active.skill, active.topic, result));
    } catch (err) {
      setLessonErrorMessage(err.message || "Something went wrong loading the lesson breakdown.");
      setLessonState("error");
    }
  }, [active, uid]);

  // Marks the lesson identified by `lessonOrder` as finished — called
  // ONLY from the lesson-quiz modal's onComplete, and only when the
  // score clears LESSON_PASS_THRESHOLD (see the lessonQuizTarget modal
  // near the bottom of this file). Refreshes this topic's local tick
  // set, the sidebar's topic tick (via lessonProgressVersion), and
  // LessonListPane's checkmarks.
  const passLesson = useCallback((lessonOrder, scorePercent) => {
    if (!active) return;
    markLessonComplete(uid, active.skill, active.topic, lessonOrder, scorePercent);
    setCompletedLessons(getCompletedLessons(uid, active.skill, active.topic));
    setLessonScores(getLessonScores(uid, active.skill, active.topic));
    setLessonProgressVersion((v) => v + 1);
  }, [active, uid]);

  // { skill, topic (composite "{topic} — {lessonTitle}"), focusBand,
  // lessonOrder } | null — the per-LESSON quiz, opened from inside a
  // lesson's content view (TopicContentPane's onTakeLessonQuiz). This is
  // now the ONLY quiz in Course Workspace — the old whole-topic "Test"
  // list item (10 questions covering the whole topic at once) was
  // removed as a duplicate once every lesson got its own pass/fail test.
  const [lessonQuizTarget, setLessonQuizTarget] = useState(null);

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

  // Lesson-level completion fraction (0-100) across a set of topics —
  // only counting topics whose Lessons breakdown has actually been
  // opened (see utils/lessonProgress.js). Returns null when none of
  // them have lesson data yet, so the sidebar falls back to its plain
  // empty/complete icon instead of drawing an empty ring. Powers the
  // partial ProgressRing shown for a skill/module that's e.g. 2 of 4
  // lessons done, sitting between the empty Circle and solid
  // CheckCircle2 states.
  const lessonPercent = (topics) => {
    const withData = topics.filter((t) => t.lessonProgress);
    if (withData.length === 0) return null;
    const completed = withData.reduce((n, t) => n + t.lessonProgress.completed, 0);
    const total = withData.reduce((n, t) => n + t.lessonProgress.total, 0);
    if (!total) return null;
    return (completed / total) * 100;
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
              const modPercent = lessonPercent(mod.skills.flatMap((s) => s.topics));
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
                      ) : modPercent > 0 ? (
                        <ProgressRing percent={modPercent} size={16} strokeWidth={2} color={COLORS.purple} />
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
                            const skPercent = lessonPercent(sk.topics);
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
                                ) : skPercent > 0 ? (
                                  <ProgressRing percent={skPercent} size={12} strokeWidth={2} color={COLORS.purple} />
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
                  completedOrders={completedLessons}
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
                lessonQuizDone={completedLessons.has(lessons[activeLessonIndex].Order)}
                lessonQuizScore={lessonScores[lessons[activeLessonIndex].Order]}
                onTakeLessonQuiz={() =>
                  setLessonQuizTarget({
                    skill: active.skill,
                    topic: compositeTopicKey(active.topic, lessons[activeLessonIndex].Title),
                    focusBand: active.focusBand,
                    lessonOrder: lessons[activeLessonIndex].Order,
                  })
                }
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
                hasPrevious={activeLessonIndex > 0}
              />
            </div>
          ) : (
            activeModule && (
              <div>
                {/* Course header banner — role + a short, generated tagline.
                    Purely decorative framing for the skill list below it. */}
                <div
                  className="flex items-center gap-4 p-5 mb-5"
                  style={{ ...GLASS_CARD, borderRadius: 22 }}
                >
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 56, height: 56, borderRadius: 18, background: GRADIENTS.purpleSky }}
                  >
                    <Code2 size={26} color="#fff" />
                  </div>
                  <div className="min-w-0">
                    <span
                      className="inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-1.5"
                      style={{ background: "rgba(124,111,224,0.14)", color: "#7C6FE0" }}
                    >
                      Course Material
                    </span>
                    <h2 className="text-xl font-extrabold truncate" style={{ color: COLORS.textDark }}>
                      {roadmap.role || activeModule.name || "Your Skills"}
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: COLORS.textMid }}>
                      {activeModule.skills.length} skill{activeModule.skills.length === 1 ? "" : "s"} ·{" "}
                      {activeModule.skills.reduce((n, s) => n + s.topics.length, 0)} topics on your path
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {activeModule.skills.map((sk, skIndex) => {
                    const isOpen = expandedSkills.has(sk.name);
                    const meta = getSkillMeta(sk.name, skIndex);
                    const SkillIcon = meta.icon;
                    return (
                      <div
                        key={sk.name}
                        style={{
                          borderRadius: 20,
                          overflow: "hidden",
                          background: isOpen ? `${meta.color}14` : COLORS.white,
                          border: `1px solid ${isOpen ? `${meta.color}33` : COLORS.border}`,
                        }}
                      >
                        <button
                          onClick={() => toggleSkill(sk.name)}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                          style={{ background: "none", border: "none", cursor: "pointer" }}
                        >
                          <div
                            className="flex items-center justify-center flex-shrink-0"
                            style={{ width: 42, height: 42, borderRadius: 14, background: meta.color }}
                          >
                            <SkillIcon size={20} color="#fff" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-extrabold truncate" style={{ color: COLORS.textDark }}>{sk.name}</p>
                            <p className="text-[11px] truncate" style={{ color: COLORS.textLight }}>{meta.subtitle}</p>
                          </div>
                          <span
                            className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                            style={{ background: `${meta.color}1F`, color: meta.color }}
                          >
                            {sk.topics.length} topic{sk.topics.length === 1 ? "" : "s"}
                          </span>
                          <motion.span animate={{ rotate: isOpen ? 180 : 0 }} style={{ display: "flex", flexShrink: 0 }}>
                            <ChevronDown size={16} style={{ color: COLORS.textLight }} />
                          </motion.span>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              style={{ overflow: "hidden", background: COLORS.white }}
                            >
                              <div className="px-2.5 pb-2.5 flex flex-col gap-0.5">
                                {sk.topics.map((t) => {
                                  const flatIdx = flatTopics.indexOf(t);
                                  const isCurrent = flatIdx === activeIndex && (viewMode === "lessons" || viewMode === "content");
                                  const badge = getTopicBadge(t.topic);
                                  const isVerified = t.topicStatus === "Verified";
                                  return (
                                    // Single clickable row — the topic itself IS the "learning
                                    // resources" entry point now (the old separate quiz sub-row
                                    // was removed: each lesson has its own pass/fail test).
                                    <div
                                      key={t.topic}
                                      onClick={() => openTopic(flatIdx)}
                                      className="flex items-center gap-3 px-2.5 py-2.5 cursor-pointer"
                                      style={{
                                        borderRadius: 14,
                                        background: isCurrent ? `${meta.color}14` : "transparent",
                                      }}
                                    >
                                      <div
                                        className="flex items-center justify-center flex-shrink-0"
                                        style={{
                                          width: 20,
                                          height: 20,
                                          borderRadius: "50%",
                                          border: `2px solid ${isVerified ? "#22C55E" : isCurrent ? meta.color : COLORS.border}`,
                                          background: isVerified ? "#22C55E" : isCurrent ? meta.color : "transparent",
                                        }}
                                      >
                                        {isVerified && <Check size={11} color="#fff" strokeWidth={3} />}
                                        {!isVerified && isCurrent && (
                                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                                        )}
                                      </div>
                                      <div
                                        className="flex items-center justify-center flex-shrink-0"
                                        style={{ width: 34, height: 34, borderRadius: 10, background: badge.bg }}
                                      >
                                        <span className="text-[11px] font-extrabold" style={{ color: badge.color }}>
                                          {badge.abbr}
                                        </span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p
                                          className="text-sm truncate"
                                          style={{ color: isCurrent ? meta.color : COLORS.textDark, fontWeight: isCurrent ? 700 : 600 }}
                                        >
                                          {t.topic}
                                        </p>
                                        <p className="text-[11px] truncate" style={{ color: COLORS.textLight }}>
                                          {STATUS_SUBTITLE[t.topicStatus] || "Topic"}
                                        </p>
                                      </div>
                                      {isCurrent ? (
                                        <span
                                          className="text-[11px] font-bold px-3 py-1.5 rounded-full flex-shrink-0"
                                          style={{ background: GRADIENTS.purplePink, color: "#fff" }}
                                        >
                                          Resume
                                        </span>
                                      ) : (
                                        <ChevronRight size={16} style={{ color: COLORS.textLight, flexShrink: 0 }} />
                                      )}
                                    </div>
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

                {/* Footer flourish — small motivational sign-off under the list. */}
                <div className="flex items-center gap-2 justify-center mt-6 mb-2">
                  <Sparkles size={14} style={{ color: "#7C6FE0" }} />
                  <p className="text-xs font-semibold italic" style={{ color: COLORS.textLight }}>
                    Small steps to big dreams
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Per-LESSON quiz — the only quiz left in Course Workspace now that
          the whole-topic "Test" list item is gone (see the Learning
          Resources item above). Keyed by the composite "{topic} —
          {lessonTitle}" string. A lesson only gets marked complete
          (passLesson) when the score clears LESSON_PASS_THRESHOLD —
          Coursera-style, score to complete. */}
      {lessonQuizTarget && (
        <TopicQuizModal
          skill={lessonQuizTarget.skill}
          topic={lessonQuizTarget.topic}
          focusBand={lessonQuizTarget.focusBand}
          uid={uid}
          onClose={() => setLessonQuizTarget(null)}
          onComplete={(result) => {
            if (result?.scorePercent >= LESSON_PASS_THRESHOLD) {
              passLesson(lessonQuizTarget.lessonOrder, result.scorePercent);
            }
            setLessonQuizTarget(null);
            // Perfect score (10/10) only — auto-advance to the next
            // lesson, same as clicking Next inside the lesson content
            // view. Anything less stays put: the modal's own button
            // already turned into "Retake Quiz" for that case instead
            // of calling onComplete at all (see TopicQuizModal.jsx).
            if (result?.scorePercent === 100) {
              if (activeLessonIndex < lessons.length - 1) {
                setActiveLessonIndex((i) => i + 1);
              } else {
                setViewMode("lessons");
              }
            }
          }}
        />
      )}
    </div>
  );
}
