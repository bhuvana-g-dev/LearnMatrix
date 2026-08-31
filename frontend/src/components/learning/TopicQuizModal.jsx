import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, XCircle, RotateCcw, ArrowRight, ArrowLeft as ArrowLeftIcon,
  X, Trophy, CalendarClock, Target, Layers, Check,
  Sparkles, Lightbulb, ListChecks, BookOpen, Rocket,
} from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import { getTopicQuiz, getTopicQuizAttempt, submitTopicQuiz } from "../../services/topicQuizService";
import { invalidateRoadmap } from "../../services/userProgressCache";

const OPTION_KEYS = ["OptionA", "OptionB", "OptionC", "OptionD"];
const OPTION_LETTERS = { OptionA: "A", OptionB: "B", OptionC: "C", OptionD: "D" };

// Revision PACE only — Fast/Moderate/Slow never decides content (that's
// CONTENT_LEVEL_COPY below, driven by Topic Mastery % instead). See
// backend/services/focus_band.py's module docstring for the split.
// `emoji` + `headline` are the ResultView's big "Keep Going! 🚀"-style
// banner text — kept separate from `detail` (the smaller explanatory line).
const CLASSIFICATION_COPY = {
  Fast: {
    color: "#22C55E",
    emoji: "🚀",
    headline: "Excellent work!",
    detail: "Strong grasp of this topic — you're on the quick track. Next check-in in 7 days.",
  },
  Moderate: {
    color: "#F59E0B",
    emoji: "💪",
    headline: "Nice progress!",
    detail: "Solid progress with room to firm up. One more pass recommended — next check-in in 5 days.",
  },
  Slow: {
    color: "#E0559C",
    emoji: "🌱",
    headline: "Keep Going!",
    detail: "This topic needs another round with simpler material. Next check-in in 3 days.",
  },
};

// Content LEVEL — driven purely by this attempt's Topic Mastery %
// (backend/services/focus_band.py::determine_content_level). Same four
// values as FOCUS_BAND_LABELS in TopicContentPane.jsx; the `items` list
// here is just this modal's own display of what that level means, so a
// learner (or evaluator) can see WHY the content pane below will look
// the way it does for this specific topic. Each item now carries its own
// icon + one-line description (Content Overview cards in ResultView).
const CONTENT_LEVEL_COPY = {
  fundamentals: {
    label: "FOUNDATION",
    color: "#E0559C",
    items: [
      { icon: Lightbulb, title: "Basic concepts", desc: "Understand the basics" },
      { icon: ListChecks, title: "Step-by-step explanation", desc: "Learn with clear steps" },
      { icon: BookOpen, title: "Simple examples", desc: "Real-world examples" },
      { icon: Target, title: "Easy practice", desc: "Practice makes perfect" },
    ],
  },
  application: {
    label: "APPLICATION",
    color: "#F59E0B",
    items: [
      { icon: Lightbulb, title: "Applied concepts", desc: "Put theory into practice" },
      { icon: ListChecks, title: "Worked examples", desc: "Follow guided solutions" },
      { icon: BookOpen, title: "Guided practice", desc: "Build with support" },
      { icon: Target, title: "Medium-difficulty questions", desc: "Test your understanding" },
    ],
  },
  advanced: {
    label: "ADVANCED",
    color: "#7C6FE0",
    items: [
      { icon: Lightbulb, title: "Deeper explanations", desc: "Go beyond the basics" },
      { icon: ListChecks, title: "Edge-case awareness", desc: "Spot the tricky bits" },
      { icon: BookOpen, title: "Harder practice", desc: "Push your limits" },
      { icon: Target, title: "Less hand-holding", desc: "Work more independently" },
    ],
  },
  polish: {
    label: "POLISH",
    color: "#22C55E",
    items: [
      { icon: Lightbulb, title: "Edge cases", desc: "Cover every scenario" },
      { icon: ListChecks, title: "Complex examples", desc: "Real production patterns" },
      { icon: BookOpen, title: "Real-world problems", desc: "Solve like a pro" },
      { icon: Target, title: "Hard practice", desc: "Sharpen your mastery" },
    ],
  },
};

const WEAK_AREA_LABELS = {
  fundamentals: "Fundamentals",
  application: "Application",
  advanced: "Advanced reasoning",
};

/**
 * TopicQuizModal — Objective 3/4's actual student-facing surface.
 *
 * Sits as an overlay on top of TopicContentPane, opened when the
 * learner clicks "Next" on a topic (see that component's onNext
 * override). Takes the quiz (bank+AI questions from
 * services/topic_quiz_service.py), submits it, and shows the
 * Fast/Moderate/Slow classification + next revision date the backend's
 * Scikit-Learn classifier and revision_scheduler.py computed — then
 * calls onComplete() so the caller can advance to the next topic.
 *
 * On open, this ALWAYS checks getTopicQuizAttempt() first. If the
 * learner already has a recorded attempt for this topic (first open
 * after completing it, OR a revision retake from RevisionScheduleScreen),
 * it goes straight to "review" — the exact questions + their picks from
 * that attempt, replayed read-only. It does NOT call getTopicQuiz()
 * (no new/cached quiz fetch, no AI call) in that case. Only a learner
 * with zero attempts on this topic goes through the normal
 * loading -> ready (take quiz) -> submitting -> result flow.
 *
 * State machine: loading -> ready (in-progress) -> submitting -> result | error
 *                        -> review (prior attempt found)
 */
export default function TopicQuizModal({ skill, topic, uid, focusBand, onComplete, onClose }) {
  const [state, setState] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [QuestionID|TempID]: "OptionA" }
  const [result, setResult] = useState(null);
  const startedAtRef = useRef(null);

  const fetchQuiz = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    setCurrentIndex(0);
    setAnswers({});
    try {
      // Always check for a prior attempt FIRST — a topic that's already
      // been taken once must show that attempt's review, never a new
      // (or newly-generated) quiz, whether this is the first re-open or
      // a revision retake.
      const priorAttempt = await getTopicQuizAttempt(skill, topic, uid);
      if (priorAttempt) {
        setQuestions(priorAttempt.questions || []);
        setAnswers(priorAttempt.answers || {});
        setResult(priorAttempt);
        setState("review");
        return;
      }

      const quiz = await getTopicQuiz(skill, topic, focusBand);
      setQuestions(quiz.questions);
      startedAtRef.current = Date.now();
      setState("ready");
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong loading the quiz.");
      setState("error");
    }
  }, [skill, topic, focusBand, uid]);

  // Fresh attempt, skipping the getTopicQuizAttempt() check above on
  // purpose — that check is what makes a normal re-open show the read-
  // only review of the LAST attempt; retaking needs a brand new quiz
  // instead. Only reachable from ResultView/ReviewView's bottom button
  // when the last score was under 100% — see CONTINUE_OR_RETAKE below.
  // The backend already supports this (submitTopicQuiz returns an
  // incrementing attemptNumber); this modal just never triggered it.
  const startRetake = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    setCurrentIndex(0);
    setAnswers({});
    setResult(null);
    try {
      const quiz = await getTopicQuiz(skill, topic, focusBand);
      setQuestions(quiz.questions);
      startedAtRef.current = Date.now();
      setState("ready");
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong loading the quiz.");
      setState("error");
    }
  }, [skill, topic, focusBand]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const currentQuestion = questions[currentIndex];
  const qid = currentQuestion ? currentQuestion.QuestionID || currentQuestion.TempID : null;
  const selectedOption = qid ? answers[qid] : undefined;
  const isLastQuestion = currentIndex === questions.length - 1;
  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => answers[q.QuestionID || q.TempID]);

  const selectAnswer = (optionKey) => {
    if (state !== "ready") return;
    setAnswers((prev) => ({ ...prev, [qid]: optionKey }));
  };

  const goNext = () => {
    if (!isLastQuestion) setCurrentIndex((i) => i + 1);
  };
  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleSubmit = async () => {
    setState("submitting");
    const timeTakenSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
    try {
      const outcome = await submitTopicQuiz(skill, topic, {
        uid, questions, answers, timeTakenSeconds,
      });
      // Backend may have just flipped this skill to "mastered" on the
      // saved roadmap (services/roadmap_service.recompute_mastery_after_topic_progress)
      // — drop the 30s roadmap cache so Profile's Overall Progress /
      // Skills Mastered cards reflect it on next load instead of
      // reusing stale pre-quiz numbers. See services/userProgressCache.js.
      invalidateRoadmap(uid);
      setResult(outcome);
      setState("result");
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong submitting the quiz.");
      setState("error");
    }
  };

  const overlayStyle = {
    position: "fixed", inset: 0, zIndex: 100,
    background: "rgba(13,27,61,0.45)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  };
  const cardStyle = {
    ...GLASS_CARD, borderRadius: 28, width: "100%", maxWidth: 560,
    maxHeight: "90vh", overflowY: "auto", position: "relative",
    background: "rgba(255,255,255,0.97)",
  };

  return (
    <div style={overlayStyle}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={cardStyle}
      >
        {state !== "submitting" && (
          <button
            onClick={() => {
              // If a result already exists (the quiz was scored — either
              // the "result" screen just now, or "review" of a prior
              // attempt), closing via this X must still report it up,
              // exactly like Continue/onClose below do. Otherwise a user
              // who scores 10/10 and dismisses via X instead of clicking
              // "Continue" would never trigger passLesson() in the
              // parent, leaving the lesson stuck un-marked despite a
              // passing score.
              if ((state === "result" || state === "review") && result) {
                onComplete(result);
              } else {
                onClose();
              }
            }}
            className="absolute top-4 right-4"
            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight }}
            aria-label="Close quiz"
          >
            <X size={20} />
          </button>
        )}

        <div className="p-7">
          {/* ---------------- Loading ---------------- */}
          {state === "loading" && (
            <div className="flex flex-col items-center text-center gap-4 py-10">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}>
                <Loader2 size={36} style={{ color: COLORS.purple }} />
              </motion.div>
              <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
                Preparing your quiz…
              </h3>
              <p className="text-sm" style={{ color: COLORS.textMid }}>
                A quick {`10`}-question check on {topic}.
              </p>
            </div>
          )}

          {/* ---------------- Error ---------------- */}
          {state === "error" && (
            <div className="flex flex-col items-center text-center gap-4 py-8">
              <XCircle size={36} style={{ color: "#E0559C" }} />
              <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
                Couldn't load the quiz
              </h3>
              <p className="text-sm" style={{ color: COLORS.textMid }}>{errorMessage}</p>
              <motion.button
                onClick={fetchQuiz}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="mt-1 flex items-center gap-2 font-semibold"
                style={{
                  padding: "12px 24px", borderRadius: 9999, color: "#fff", border: "none",
                  background: GRADIENTS.purpleSky, cursor: "pointer",
                }}
              >
                <RotateCcw size={16} /> Try Again
              </motion.button>
            </div>
          )}

          {/* ---------------- In progress ---------------- */}
          {(state === "ready" || state === "submitting") && currentQuestion && (
            <div style={{ perspective: 1200 }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.textLight }}>
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span
                  className="px-2.5 py-0.5 text-[10px] font-bold rounded-full"
                  style={{ background: "rgba(212,160,23,0.14)", color: COLORS.purple }}
                >
                  {currentQuestion.Difficulty}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full mb-6" style={{ background: COLORS.border }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${((currentIndex + 1) / questions.length) * 100}%`,
                    background: GRADIENTS.purplePink,
                  }}
                />
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentIndex}
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -90, opacity: 0 }}
                  transition={{ duration: 0.32, ease: "easeInOut" }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <h3 className="text-base font-bold mb-5 leading-snug" style={{ color: COLORS.textDark }}>
                    {currentQuestion.Question}
                  </h3>

                  <div className="flex flex-col gap-2.5 mb-6">
                    {OPTION_KEYS.map((key) => {
                      const text = currentQuestion[key];
                      if (!text) return null;
                      const isSelected = selectedOption === key;
                      return (
                        <button
                          key={key}
                          onClick={() => selectAnswer(key)}
                          disabled={state === "submitting"}
                          className="flex items-center gap-3 px-4 py-3 text-left"
                          style={{
                            borderRadius: 14,
                            border: `2px solid ${isSelected ? COLORS.purple : COLORS.border}`,
                            background: isSelected ? "rgba(212,160,23,0.10)" : "rgba(255,255,255,0.5)",
                            cursor: state === "submitting" ? "default" : "pointer",
                          }}
                        >
                          <span
                            className="flex items-center justify-center flex-shrink-0 text-xs font-bold"
                            style={{
                              width: 24, height: 24, borderRadius: "50%",
                              background: isSelected ? GRADIENTS.purplePink : "transparent",
                              border: `1.5px solid ${isSelected ? "transparent" : COLORS.border}`,
                              color: isSelected ? "#fff" : COLORS.textLight,
                            }}
                          >
                            {OPTION_LETTERS[key]}
                          </span>
                          <span className="text-sm" style={{ color: COLORS.textDark }}>{text}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={goPrev}
                  disabled={currentIndex === 0 || state === "submitting"}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5"
                  style={{
                    borderRadius: 9999, border: `1px solid ${COLORS.border}`, background: "transparent",
                    color: currentIndex === 0 ? COLORS.textLight : COLORS.textDark,
                    cursor: currentIndex === 0 ? "default" : "pointer", opacity: currentIndex === 0 ? 0.5 : 1,
                  }}
                >
                  <ArrowLeftIcon size={14} /> Previous
                </button>

                {isLastQuestion ? (
                  <motion.button
                    onClick={handleSubmit}
                    disabled={!allAnswered || state === "submitting"}
                    whileHover={allAnswered ? { y: -2 } : {}}
                    whileTap={allAnswered ? { scale: 0.98 } : {}}
                    className="flex items-center gap-2 text-sm font-bold px-6 py-2.5"
                    style={{
                      borderRadius: 9999, border: "none", color: "#fff",
                      background: allAnswered ? GRADIENTS.purpleSky : "#C9C4D6",
                      opacity: allAnswered ? 1 : 0.65,
                      cursor: allAnswered ? "pointer" : "not-allowed",
                    }}
                  >
                    {state === "submitting" ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Submitting…
                      </>
                    ) : (
                      "Submit Quiz"
                    )}
                  </motion.button>
                ) : (
                  <button
                    onClick={goNext}
                    disabled={!selectedOption}
                    className="flex items-center gap-1.5 text-sm font-bold px-5 py-2.5"
                    style={{
                      borderRadius: 9999, border: "none", color: "#fff",
                      background: selectedOption ? GRADIENTS.purplePink : "#C9C4D6",
                      opacity: selectedOption ? 1 : 0.65,
                      cursor: selectedOption ? "pointer" : "not-allowed",
                    }}
                  >
                    Next <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ---------------- Result ---------------- */}
          {state === "result" && result && (
            <ResultView result={result} onContinue={() => onComplete(result)} onRetake={startRetake} />
          )}

          {/* ---------------- Review (prior attempt, read-only) ---------------- */}
          {state === "review" && result && (
            <ReviewView result={result} questions={questions} answers={answers} onClose={() => onComplete(result)} onRetake={startRetake} />
          )}
        </div>
      </motion.div>
    </div>
  );
}

/** Small SVG ring showing scorePercent, colored by classification —
 * the "20% / Score" circle in the redesigned ResultView. */
function ScoreRing({ percent, color, size = 116 }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.border} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div
        className="flex flex-col items-center justify-center"
        style={{ position: "absolute", inset: 0 }}
      >
        <span className="text-2xl font-extrabold" style={{ color: COLORS.textDark }}>{percent}%</span>
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: COLORS.textLight }}>Score</span>
      </div>
    </div>
  );
}

function ResultView({ result, onContinue, onRetake }) {
  const copy = CLASSIFICATION_COPY[result.classification] || CLASSIFICATION_COPY.Moderate;
  const contentCopy = CONTENT_LEVEL_COPY[result.focusBand] || CONTENT_LEVEL_COPY.application;
  const weakAreaLabel = WEAK_AREA_LABELS[result.weakArea];
  // Perfect score only — auto-advances to the next lesson. Anything less
  // (even a passing score) turns this into a genuine retake instead of a
  // plain dismiss, so a learner who wants to nail a topic isn't stuck
  // with whatever they scored the first try.
  const isPerfect = result.scorePercent === 100;

  return (
    <div className="flex flex-col gap-5">
      {/* Illustrated header: score ring + trophy badge on the left,
          headline/subtext on the right — mirrors a Duolingo/Coursera-
          style "Keep Going!" result card. */}
      <div
        className="flex items-center gap-5 p-5 relative overflow-hidden"
        style={{ borderRadius: 22, background: `linear-gradient(135deg, ${copy.color}14, ${COLORS.lavender})` }}
      >
        <Sparkles size={16} style={{ position: "absolute", top: 14, left: 14, color: copy.color, opacity: 0.6 }} />
        <Sparkles size={11} style={{ position: "absolute", bottom: 16, left: 40, color: copy.color, opacity: 0.4 }} />
        <div style={{ position: "relative", flexShrink: 0 }}>
          <ScoreRing percent={result.scorePercent} color={copy.color} />
          <div
            className="flex items-center justify-center"
            style={{
              position: "absolute", top: -8, right: -8, width: 34, height: 34, borderRadius: "50%",
              background: `${copy.color}22`, border: `2px solid #fff`,
            }}
          >
            <Trophy size={16} style={{ color: copy.color }} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-extrabold leading-tight" style={{ color: COLORS.textDark }}>
            {copy.headline} {copy.emoji}
          </h3>
          <p className="text-xs mt-1" style={{ color: COLORS.textMid }}>
            You're learning and improving every day.
          </p>
          <span
            className="inline-block mt-2 px-3 py-1 text-[11px] font-bold rounded-full"
            style={{ background: `${copy.color}22`, color: copy.color }}
          >
            {result.correct} of {result.total} correct
          </span>
        </div>
      </div>

      {/* ---- Content Overview: driven by Topic Mastery %, NOT the
          Fast/Moderate/Slow badge above. Same topic, different mastery,
          different content — this is the block that proves it. ---- */}
      <div
        className="flex flex-col gap-3.5 px-4 py-4 w-full"
        style={{ borderRadius: 18, border: `1.5px solid ${contentCopy.color}33`, background: `${contentCopy.color}0A` }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: COLORS.textLight }}>
            <Layers size={13} /> Content Overview
          </span>
          <span
            className="px-3 py-1 text-[11px] font-extrabold rounded-full"
            style={{ background: contentCopy.color, color: "#fff" }}
          >
            {contentCopy.label}
          </span>
        </div>
        <p className="text-[11px]" style={{ color: COLORS.textMid }}>
          Topic Mastery: <strong style={{ color: COLORS.textDark }}>{result.masteryPercent}%</strong>
          {weakAreaLabel && (
            <>
              {" "}· Weak area: <strong style={{ color: COLORS.textDark }}>{weakAreaLabel}</strong>
            </>
          )}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {contentCopy.items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex flex-col gap-1.5 px-3 py-3"
                style={{ borderRadius: 14, background: "rgba(255,255,255,0.75)" }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{ width: 26, height: 26, borderRadius: 8, background: `${contentCopy.color}1F` }}
                >
                  <Icon size={13} style={{ color: contentCopy.color }} />
                </div>
                <span className="text-[11px] font-bold leading-tight" style={{ color: COLORS.textDark }}>{item.title}</span>
                <span className="text-[10px] leading-snug" style={{ color: COLORS.textLight }}>{item.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Revision pace: Fast/Moderate/Slow. Separate axis, never
          decides content — see backend/services/learner_classifier.py. ---- */}
      <div
        className="flex items-start gap-2.5 px-4 py-3.5 w-full"
        style={{ borderRadius: 16, background: `${copy.color}12` }}
      >
        <Rocket size={16} style={{ color: copy.color, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-xs font-bold" style={{ color: copy.color }}>{copy.headline}</p>
          <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: COLORS.textMid }}>{copy.detail}</p>
        </div>
      </div>

      <div
        className="flex items-center gap-2.5 px-4 py-3 w-full"
        style={{ borderRadius: 14, background: "rgba(212,160,23,0.10)" }}
      >
        <CalendarClock size={18} style={{ color: COLORS.purple, flexShrink: 0 }} />
        <span className="text-xs text-left" style={{ color: COLORS.textDark }}>
          Next revision scheduled for{" "}
          <strong>
            {new Date(result.nextReviewDate).toLocaleDateString(undefined, {
              weekday: "long", month: "short", day: "numeric",
            })}
          </strong>
        </span>
      </div>

      {isPerfect ? (
        <motion.button
          onClick={onContinue}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2 text-sm font-bold px-7 py-3.5 w-full"
          style={{ borderRadius: 9999, border: "none", color: "#fff", background: GRADIENTS.purpleSky, cursor: "pointer" }}
        >
          Perfect score — Next Lesson <ArrowRight size={16} />
        </motion.button>
      ) : (
        <motion.button
          onClick={onRetake}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2 text-sm font-bold px-7 py-3.5 w-full"
          style={{ borderRadius: 9999, border: `1.5px solid ${COLORS.purple}`, color: COLORS.purple, background: "rgba(212,160,23,0.08)", cursor: "pointer" }}
        >
          <RotateCcw size={16} /> Retake Quiz — Aim for 10/10
        </motion.button>
      )}
    </div>
  );
}

/**
 * ReviewView — read-only playback of a topic's most recent attempt.
 * Shown instead of the take-quiz flow whenever
 * getTopicQuizAttempt() finds a prior attempt (see fetchQuiz() above):
 * this topic's "Test" already has a result on record, so we never fetch
 * or generate a new quiz — we just replay exactly what was asked and
 * exactly what the learner picked, with each option colored by
 * correct/wrong/missed.
 */
function ReviewView({ result, questions, answers, onClose, onRetake }) {
  const copy = CLASSIFICATION_COPY[result.classification] || CLASSIFICATION_COPY.Moderate;
  const isPerfect = result.scorePercent === 100;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center gap-1.5 pb-1">
        <span
          className="px-3 py-1 text-[11px] font-bold rounded-full mb-1"
          style={{ background: "rgba(212,160,23,0.14)", color: COLORS.purple }}
        >
          Already taken · reviewing your last attempt
        </span>
        <h3 className="text-2xl font-extrabold" style={{ color: COLORS.textDark }}>
          {result.scorePercent}%
        </h3>
        <p className="text-sm" style={{ color: COLORS.textMid }}>
          {result.correct} of {result.total} correct
        </p>
        <span
          className="px-4 py-1 text-xs font-bold rounded-full mt-1"
          style={{ background: copy.color, color: "#fff" }}
        >
          {copy.headline}
        </span>
        {result.nextReviewDate && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 mt-2 w-full"
            style={{ borderRadius: 14, background: "rgba(212,160,23,0.10)" }}
          >
            <CalendarClock size={16} style={{ color: COLORS.purple, flexShrink: 0 }} />
            <span className="text-xs text-left" style={{ color: COLORS.textDark }}>
              Next revision scheduled for{" "}
              <strong>
                {new Date(result.nextReviewDate).toLocaleDateString(undefined, {
                  weekday: "long", month: "short", day: "numeric",
                })}
              </strong>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((q, idx) => {
          const qid = q.QuestionID || q.TempID;
          const chosen = answers[qid];
          const correctKey = q.CorrectAnswer;
          return (
            <div key={qid || idx} className="pb-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: COLORS.textLight }}>
                Question {idx + 1} of {questions.length}
              </p>
              <p className="text-sm font-bold mb-3 leading-snug" style={{ color: COLORS.textDark }}>
                {q.Question}
              </p>
              <div className="flex flex-col gap-2">
                {OPTION_KEYS.map((key) => {
                  const text = q[key];
                  if (!text) return null;
                  const isChosen = chosen === key;
                  const isCorrectOption = correctKey === key;
                  let borderColor = COLORS.border;
                  let bg = "rgba(255,255,255,0.5)";
                  if (isCorrectOption) {
                    borderColor = "#22C55E";
                    bg = "rgba(34,197,94,0.10)";
                  } else if (isChosen && !isCorrectOption) {
                    borderColor = "#E0559C";
                    bg = "rgba(224,85,156,0.10)";
                  }
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 px-4 py-2.5"
                      style={{ borderRadius: 12, border: `2px solid ${borderColor}`, background: bg }}
                    >
                      <span
                        className="flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: isCorrectOption ? "#22C55E" : isChosen ? "#E0559C" : "transparent",
                          border: `1.5px solid ${isCorrectOption || isChosen ? "transparent" : COLORS.border}`,
                          color: isCorrectOption || isChosen ? "#fff" : COLORS.textLight,
                        }}
                      >
                        {isCorrectOption ? <Check size={12} /> : isChosen ? <XCircle size={12} /> : OPTION_LETTERS[key]}
                      </span>
                      <span className="text-sm" style={{ color: COLORS.textDark }}>{text}</span>
                      {isChosen && (
                        <span className="ml-auto text-[10px] font-bold uppercase" style={{ color: isCorrectOption ? "#22C55E" : "#E0559C" }}>
                          Your answer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {isPerfect ? (
        <motion.button
          onClick={onClose}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2 text-sm font-bold px-7 py-3 self-center"
          style={{ borderRadius: 9999, border: "none", color: "#fff", background: GRADIENTS.purpleSky, cursor: "pointer" }}
        >
          Perfect score — Next Lesson <ArrowRight size={16} />
        </motion.button>
      ) : (
        <motion.button
          onClick={onRetake}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2 text-sm font-bold px-7 py-3 self-center"
          style={{ borderRadius: 9999, border: `1.5px solid ${COLORS.purple}`, color: COLORS.purple, background: "rgba(212,160,23,0.08)", cursor: "pointer" }}
        >
          <RotateCcw size={16} /> Retake Quiz — Aim for 10/10
        </motion.button>
      )}
    </div>
  );
}
