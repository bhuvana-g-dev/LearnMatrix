import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2, XCircle, RotateCcw, BookOpen, Code2, CheckCircle2,
  ExternalLink, Youtube, FileText, Github, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck,
} from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import { getTopicPackage } from "../../services/learningContentService";

const RESOURCE_ICONS = { documentation: FileText, github: Github };

// Learner-facing resource grouping: Practice vs Reference & Reading —
// video is handled separately below as ONE primary recommendation, not
// part of either section (see module docstring). The actual split by
// resource comes from the backend's pkg.resourcesByCategory (see
// services/learning_content_service.py's _group_by_category()), so a
// resource's category here always matches what the admin Resource
// Management screen shows it grouped under.
const CATEGORY_SECTIONS = [
  { key: "practice", label: "🎯 Practice" },
  { key: "reference", label: "📖 Reference & Reading" },
];

const DIFFICULTY_COLORS = { Beginner: "#22C55E", Intermediate: "#F59E0B", Advanced: "#E0559C" };

const FOCUS_BAND_LABELS = {
  fundamentals: "Fundamentals",
  application: "Applying It",
  advanced: "Advanced",
  polish: "Quick Reference",
};

function formatDuration(totalSeconds) {
  if (!totalSeconds) return "";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatViewCount(count) {
  if (!count) return "";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} view${count === 1 ? "" : "s"}`;
}

function formatPublishedDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short" });
  } catch {
    return "";
  }
}

/**
 * TopicContentPane — the actual content-delivery view for ONE topic:
 * AI-generated (cached) notes at the student's current focusBand, ONE
 * primary recommended video (never a search-results wall — see
 * services/learning_content_service.py's _select_primary_and_alternates()),
 * any other admin-verified resources, and optional Previous/Next
 * topic navigation.
 *
 * Shared by LearningSessionScreen.jsx (standalone, no Previous/Next)
 * and CourseWorkspaceScreen.jsx (embedded in the full course
 * navigator, with Previous/Next wired to the flattened topic list) —
 * one implementation, two homes, so the actual content rendering can
 * never drift between them.
 *
 * `topicStatus` (optional) — "Verified" | "Current" | "Locked" from
 * the compressed syllabus. Display-only: a small "already verified"
 * note for Verified topics, nothing special for the others. Never
 * disables anything — every topic renders identically regardless of
 * this value.
 *
 * The post-topic quiz (Objective 3) is NOT launched from here anymore —
 * it's its own "Test" heading next to "Learning Resources" in
 * CourseWorkspaceScreen's topic list (Coursera-style item list, one row
 * per learning item type), opened via TopicQuizModal from that screen
 * directly. Next/Previous here just move between topics.
 */
export default function TopicContentPane({
  skill, topic, focusBand, topicStatus, resourceTopic,
  onNext, onPrevious, hasNext = false, hasPrevious = false, onTakeTest,
  onTakeLessonQuiz, lessonQuizDone, lessonQuizScore, lessonQuizFailedScore, // optional — lesson-scoped quiz CTA, only passed from the Lessons flow (CourseWorkspaceScreen)
}) {
  const [state, setState] = useState("loading"); // loading | error | ready
  const [errorMessage, setErrorMessage] = useState("");
  const [pkg, setPkg] = useState(null);
  const [showMoreVideos, setShowMoreVideos] = useState(false);

  const fetchContent = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    setShowMoreVideos(false);
    try {
      // resourceTopic (optional) — the plain topic name, used only to
      // match admin-managed resources when `topic` above is a
      // lesson-composited key. See learningContentService.js's docstring.
      const result = await getTopicPackage(skill, topic, focusBand, resourceTopic);
      setPkg(result);
      setState("ready");
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong loading this topic.");
      setState("error");
    }
  }, [skill, topic, focusBand, resourceTopic]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  if (state === "loading") {
    return (
      <div
        className="max-w-2xl mx-auto flex flex-col items-center text-center gap-4 py-16 px-8"
        style={{ ...GLASS_CARD, borderRadius: 28 }}
      >
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}>
          <Loader2 size={40} style={{ color: COLORS.purple }} />
        </motion.div>
        <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
          Preparing your learning session…
        </h3>
        <p className="text-sm" style={{ color: COLORS.textMid }}>
          Loading notes on {topic}. The first time anyone studies this at your
          level, this takes a little longer — after that it's instant for everyone.
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        className="max-w-2xl mx-auto flex flex-col items-center text-center gap-4 py-14 px-8"
        style={{ ...GLASS_CARD, borderRadius: 28 }}
      >
        <XCircle size={40} style={{ color: "#E0559C" }} />
        <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
          Couldn't load this topic
        </h3>
        <p className="text-sm" style={{ color: COLORS.textMid }}>{errorMessage}</p>
        <motion.button
          onClick={fetchContent}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="mt-2 flex items-center gap-2 font-semibold"
          style={{
            padding: "12px 24px", borderRadius: 9999, color: "#fff", border: "none",
            background: GRADIENTS.purpleSky, cursor: "pointer",
          }}
        >
          <RotateCcw size={16} /> Try Again
        </motion.button>
      </div>
    );
  }

  const { notes, resourcesByCategory, primaryVideo, alternateVideos } = pkg;
  const categorySections = CATEGORY_SECTIONS.map((section) => ({
    ...section,
    items: resourcesByCategory?.[section.key] || [],
  })).filter((s) => s.items.length > 0);
  const hasAnyResources = !!primaryVideo || categorySections.length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className="px-3 py-1 text-[11px] font-bold rounded-full"
          style={{ color: COLORS.purple, background: "rgba(212,160,23,0.14)" }}
        >
          {skill}
        </span>
        <span
          className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide rounded-full"
          style={{ color: "#fff", background: GRADIENTS.purpleSky }}
        >
          {FOCUS_BAND_LABELS[focusBand] || focusBand}
        </span>
        {topicStatus === "Verified" && (
          <span
            className="flex items-center gap-1 px-3 py-1 text-[11px] font-bold rounded-full"
            style={{ color: "#fff", background: "#22C55E" }}
          >
            <CheckCircle2 size={11} /> Already verified on your diagnostic
          </span>
        )}
      </div>

      {/* Notes */}
      <div className="p-7 mb-6" style={{ ...GLASS_CARD, borderRadius: 24 }}>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={18} style={{ color: COLORS.purple }} />
          <h1 className="text-xl font-extrabold" style={{ color: COLORS.textDark }}>
            {notes.title}
          </h1>
        </div>
        <p className="text-sm mb-6" style={{ color: COLORS.textMid }}>{notes.summary}</p>

        <div className="flex flex-col gap-5">
          {notes.sections.map((section, i) => (
            <div key={i}>
              <h3 className="text-sm font-bold mb-1.5" style={{ color: COLORS.textDark }}>
                {section.heading}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: COLORS.textMid }}>
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {notes.codeExample && (
          <div className="mt-6">
            <div className="flex items-center gap-1.5 mb-2">
              <Code2 size={14} style={{ color: COLORS.textLight }} />
              <span className="text-xs font-semibold" style={{ color: COLORS.textLight }}>
                Example
              </span>
            </div>
            <pre
              className="text-xs p-4 overflow-x-auto"
              style={{ borderRadius: 14, background: "rgba(13,27,61,0.06)", color: COLORS.textDark }}
            >
              <code>{notes.codeExample}</code>
            </pre>
          </div>
        )}

        <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.textLight }}>
            Key Takeaways
          </p>
          <div className="flex flex-col gap-1.5">
            {notes.keyTakeaways.map((point, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 size={14} style={{ color: "#22C55E", flexShrink: 0, marginTop: 3 }} />
                <span className="text-sm" style={{ color: COLORS.textDark }}>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Learning resources — ONE recommended video (matched to this
          learner's level for THIS topic), not a results list; other
          admin-verified resource types shown below it. */}
      <div className="p-6 mb-6" style={{ ...GLASS_CARD, borderRadius: 24 }}>
        <h3 className="text-base font-bold mb-4" style={{ color: COLORS.textDark }}>
          Learning Resources
        </h3>

        {!hasAnyResources ? (
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            No learning resources available.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {primaryVideo && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: COLORS.textLight }}>
                  📺 Recommended Video
                </p>
                <a
                  href={primaryVideo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col sm:flex-row no-underline overflow-hidden"
                  style={{ borderRadius: 18, background: "rgba(255,255,255,0.5)" }}
                >
                  <div className="relative flex-shrink-0" style={{ width: "100%", maxWidth: 280, aspectRatio: "16/9", background: "rgba(13,27,61,0.08)" }}>
                    {primaryVideo.thumbnail && (
                      <img
                        src={primaryVideo.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ position: "absolute", inset: 0 }}
                      />
                    )}
                    {primaryVideo.durationSeconds > 0 && (
                      <span
                        className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded"
                        style={{ background: "rgba(0,0,0,0.75)", color: "#fff" }}
                      >
                        {formatDuration(primaryVideo.durationSeconds)}
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {primaryVideo.difficulty && (
                        <span
                          className="px-2 py-0.5 text-[10px] font-bold rounded-full"
                          style={{ background: DIFFICULTY_COLORS[primaryVideo.difficulty] || COLORS.textMid, color: "#fff" }}
                        >
                          {primaryVideo.difficulty}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold leading-snug" style={{ color: COLORS.textDark }}>
                      {primaryVideo.title}
                    </span>
                    {primaryVideo.channelName && (
                      <span className="text-xs" style={{ color: COLORS.textMid }}>{primaryVideo.channelName}</span>
                    )}
                    {(primaryVideo.viewCount > 0 || primaryVideo.publishedAt) && (
                      <span className="text-[11px]" style={{ color: COLORS.textLight }}>
                        {[formatViewCount(primaryVideo.viewCount), formatPublishedDate(primaryVideo.publishedAt)].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    <span
                      className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold w-fit px-4 py-2 rounded-full"
                      style={{ background: GRADIENTS.purpleSky, color: "#fff" }}
                    >
                      <Youtube size={13} /> Watch Video
                    </span>
                  </div>
                </a>

                {alternateVideos?.length > 0 && (
                  <div className="mt-2.5">
                    <button
                      onClick={() => setShowMoreVideos((v) => !v)}
                      className="flex items-center gap-1 text-xs font-semibold"
                      style={{ color: COLORS.textMid, background: "none", border: "none", cursor: "pointer" }}
                    >
                      More resources ({alternateVideos.length})
                      <motion.span animate={{ rotate: showMoreVideos ? 180 : 0 }} style={{ display: "flex" }}>
                        <ChevronDown size={14} />
                      </motion.span>
                    </button>
                    {showMoreVideos && (
                      <div className="flex flex-col gap-2 mt-2.5">
                        {alternateVideos.map((v) => (
                          <a
                            key={v.id}
                            href={v.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 px-3 py-2 no-underline"
                            style={{ borderRadius: 12, background: "rgba(255,255,255,0.4)" }}
                          >
                            {v.thumbnail && (
                              <img src={v.thumbnail} alt="" style={{ width: 56, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                            )}
                            <span className="text-xs font-medium flex-1 truncate" style={{ color: COLORS.textDark }}>
                              {v.title}
                            </span>
                            <ExternalLink size={12} style={{ color: COLORS.textLight, flexShrink: 0 }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {categorySections.map((section) => (
              <div key={section.key}>
                <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: COLORS.textLight }}>
                  {section.label}
                </p>
                <div className="flex flex-col gap-2.5">
                  {section.items.map((r) => {
                    const Icon = RESOURCE_ICONS[r.type] || FileText;
                    return (
                      <a
                        key={r.id}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 no-underline"
                        style={{ borderRadius: 14, background: "rgba(255,255,255,0.4)" }}
                      >
                        <Icon size={18} style={{ color: COLORS.purple, flexShrink: 0 }} />
                        <span className="text-sm font-medium flex-1" style={{ color: COLORS.textDark }}>
                          {r.title}
                        </span>
                        {r.difficulty && (
                          <span
                            className="px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0"
                            style={{ background: DIFFICULTY_COLORS[r.difficulty] || COLORS.textMid, color: "#fff" }}
                          >
                            {r.difficulty}
                          </span>
                        )}
                        <ExternalLink size={14} style={{ color: COLORS.textLight, flexShrink: 0 }} />
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {onTakeLessonQuiz && (() => {
        // Already attempted this lesson's quiz but didn't clear the pass
        // mark yet — show that in red instead of the generic first-attempt
        // prompt, so a returning learner immediately sees why they're back
        // here instead of re-reading the same "Ready to test yourself?" copy.
        const hasFailedAttempt = !lessonQuizDone && typeof lessonQuizFailedScore === "number";
        return (
        <motion.button
          onClick={onTakeLessonQuiz}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-between gap-3 p-5 mb-6 text-left"
          style={{
            ...GLASS_CARD, borderRadius: 20, cursor: "pointer",
            border: `1px solid ${lessonQuizDone ? "#22C55E" : hasFailedAttempt ? "#DC2626" : COLORS.border}`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 40, height: 40, borderRadius: 12, background: lessonQuizDone ? "#22C55E" : hasFailedAttempt ? "#DC2626" : GRADIENTS.purplePink }}
            >
              {lessonQuizDone ? <CheckCircle2 size={20} style={{ color: "#fff" }} /> : <ClipboardCheck size={20} style={{ color: "#fff" }} />}
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: hasFailedAttempt ? "#DC2626" : COLORS.textDark }}>
                {lessonQuizDone ? "Lesson completed" : hasFailedAttempt ? "Not passed yet" : "Ready to test yourself?"}
              </p>
              <p className="text-[11px]" style={{ color: hasFailedAttempt ? "#DC2626" : COLORS.textLight }}>
                {lessonQuizDone
                  ? (typeof lessonQuizScore === "number"
                      ? `You scored ${lessonQuizScore}% · high enough to mark this lesson done`
                      : "You scored high enough to mark this lesson done")
                  : hasFailedAttempt
                    ? `You scored ${lessonQuizFailedScore}% last time · retake to pass this lesson`
                    : "Quick quiz on this lesson · pass it to mark this lesson done"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {lessonQuizDone && typeof lessonQuizScore === "number" && (
              <span
                className="text-xs font-bold px-3 py-2 rounded-full"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22C55E" }}
              >
                {lessonQuizScore}%
              </span>
            )}
            {hasFailedAttempt && (
              <span
                className="text-xs font-bold px-3 py-2 rounded-full"
                style={{ background: "rgba(220,38,38,0.12)", color: "#DC2626" }}
              >
                {lessonQuizFailedScore}%
              </span>
            )}
            <span
              className="text-xs font-bold px-4 py-2 rounded-full"
              style={{ background: lessonQuizDone ? "#22C55E" : hasFailedAttempt ? "#DC2626" : GRADIENTS.purplePink, color: "#fff" }}
            >
              {lessonQuizDone ? "Retake" : hasFailedAttempt ? "Retake Test" : "Take Test"}
            </span>
          </div>
        </motion.button>
        );
      })()}

      {onTakeTest && (
        <motion.button
          onClick={onTakeTest}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-between gap-3 p-5 mb-6 text-left"
          style={{ ...GLASS_CARD, borderRadius: 20, border: `1px solid ${COLORS.border}`, cursor: "pointer" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 40, height: 40, borderRadius: 12, background: GRADIENTS.purplePink }}
            >
              <ClipboardCheck size={20} style={{ color: "#fff" }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: COLORS.textDark }}>Ready to test yourself?</p>
              <p className="text-[11px]" style={{ color: COLORS.textLight }}>
                10-question quiz on {topic} · sets your next revision date
              </p>
            </div>
          </div>
          <span
            className="text-xs font-bold px-4 py-2 rounded-full flex-shrink-0"
            style={{ background: GRADIENTS.purplePink, color: "#fff" }}
          >
            Take Test
          </span>
        </motion.button>
      )}

      {(onNext || onPrevious) && (
        <div className="flex items-center justify-between gap-3">
          <motion.button
            onClick={onPrevious}
            disabled={!hasPrevious}
            whileHover={hasPrevious ? { x: -2 } : {}}
            className="flex items-center gap-1.5 text-sm font-semibold px-5 py-3"
            style={{
              borderRadius: 9999, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.5)",
              color: hasPrevious ? COLORS.textDark : COLORS.textLight,
              cursor: hasPrevious ? "pointer" : "default", opacity: hasPrevious ? 1 : 0.5,
            }}
          >
            <ChevronLeft size={16} /> Previous
          </motion.button>
          <motion.button
            onClick={onNext}
            disabled={!hasNext}
            whileHover={hasNext ? { x: 2 } : {}}
            className="flex items-center gap-1.5 text-sm font-bold px-5 py-3"
            style={{
              borderRadius: 9999, border: "none", background: hasNext ? GRADIENTS.purplePink : COLORS.border,
              color: "#fff", cursor: hasNext ? "pointer" : "default", opacity: hasNext ? 1 : 0.6,
            }}
          >
            Next <ChevronRight size={16} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
