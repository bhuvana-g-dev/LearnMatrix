import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Loader2, XCircle, RotateCcw, ArrowRight, ArrowLeft as ArrowLeftIcon,
  X, Trophy, CalendarClock, Target, Layers,
} from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import { getTopicQuiz, submitTopicQuiz } from "../../services/topicQuizService";

const OPTION_KEYS = ["OptionA", "OptionB", "OptionC", "OptionD"];
const OPTION_LETTERS = { OptionA: "A", OptionB: "B", OptionC: "C", OptionD: "D" };

// Revision PACE only — Fast/Moderate/Slow never decides content (that's
// CONTENT_LEVEL_COPY below, driven by Topic Mastery % instead). See
// backend/services/focus_band.py's module docstring for the split.
const CLASSIFICATION_COPY = {
  Fast: {
    color: "#22C55E",
    headline: "Fast learner",
    detail: "Strong grasp of this topic — you're on the quick track. Next check-in in 7 days.",
  },
  Moderate: {
    color: "#F59E0B",
    headline: "Moderate learner",
    detail: "Solid progress with room to firm up. One more pass recommended — next check-in in 5 days.",
  },
  Slow: {
    color: "#E0559C",
    headline: "Needs more practice",
    detail: "This topic needs another round with simpler material. Next check-in in 3 days.",
  },
};

// Content LEVEL — driven purely by this attempt's Topic Mastery %
// (backend/services/focus_band.py::determine_content_level). Same four
// values as FOCUS_BAND_LABELS in TopicContentPane.jsx; the `items` list
// here is just this modal's own display of what that level means, so a
// learner (or evaluator) can see WHY the content pane below will look
// the way it does for this specific topic.
const CONTENT_LEVEL_COPY = {
  fundamentals: {
    label: "FOUNDATION",
    color: "#E0559C",
    items: ["Basic concepts", "Step-by-step explanation", "Simple examples", "Easy practice"],
  },
  application: {
    label: "APPLICATION",
    color: "#F59E0B",
    items: ["Applied concepts", "Worked examples", "Guided practice", "Medium-difficulty questions"],
  },
  advanced: {
    label: "ADVANCED",
    color: "#7C6FE0",
    items: ["Deeper explanations", "Edge-case awareness", "Harder practice", "Less hand-holding"],
  },
  polish: {
    label: "POLISH",
    color: "#22C55E",
    items: ["Edge cases", "Complex examples", "Real-world problems", "Hard practice"],
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
 * State machine: loading -> ready (in-progress) -> submitting -> result | error
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
            onClick={onClose}
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
            <div>
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
            <ResultView result={result} onContinue={onComplete} />
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ResultView({ result, onContinue }) {
  const copy = CLASSIFICATION_COPY[result.classification] || CLASSIFICATION_COPY.Moderate;
  const contentCopy = CONTENT_LEVEL_COPY[result.focusBand] || CONTENT_LEVEL_COPY.application;
  const weakAreaLabel = WEAK_AREA_LABELS[result.weakArea];

  return (
    <div className="flex flex-col items-center text-center gap-2 py-2">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center justify-center mb-1"
        style={{ width: 64, height: 64, borderRadius: "50%", background: `${copy.color}22` }}
      >
        <Trophy size={30} style={{ color: copy.color }} />
      </motion.div>

      <h3 className="text-2xl font-extrabold" style={{ color: COLORS.textDark }}>
        {result.scorePercent}%
      </h3>
      <p className="text-sm mb-1" style={{ color: COLORS.textMid }}>
        {result.correct} of {result.total} correct
      </p>

      {/* ---- Content decision: driven by Topic Mastery %, NOT the
          Fast/Moderate/Slow badge below. Same topic, different mastery,
          different content — this is the block that proves it. ---- */}
      <div
        className="flex flex-col gap-2.5 px-4 py-4 mb-3 w-full max-w-sm text-left"
        style={{ borderRadius: 14, border: `1.5px solid ${contentCopy.color}33`, background: `${contentCopy.color}0F` }}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: COLORS.textLight }}>
            <Layers size={13} /> Content Level
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
        <div className="flex flex-wrap gap-1.5">
          {contentCopy.items.map((item) => (
            <span
              key={item}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded-full"
              style={{ background: "rgba(255,255,255,0.7)", color: COLORS.textDark }}
            >
              <Target size={10} style={{ color: contentCopy.color }} /> {item}
            </span>
          ))}
        </div>
      </div>

      {/* ---- Revision pace: Fast/Moderate/Slow. Separate axis, never
          decides content — see backend/services/learner_classifier.py. ---- */}
      <span
        className="px-4 py-1.5 text-xs font-bold rounded-full mb-3"
        style={{ background: copy.color, color: "#fff" }}
      >
        {copy.headline}
      </span>

      <p className="text-sm leading-relaxed mb-5 max-w-sm" style={{ color: COLORS.textMid }}>
        {copy.detail}
      </p>

      <div
        className="flex items-center gap-2.5 px-4 py-3 mb-6 w-full max-w-sm"
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

      <motion.button
        onClick={onContinue}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 text-sm font-bold px-7 py-3"
        style={{ borderRadius: 9999, border: "none", color: "#fff", background: GRADIENTS.purpleSky, cursor: "pointer" }}
      >
        Continue <ArrowRight size={16} />
      </motion.button>
    </div>
  );
}
