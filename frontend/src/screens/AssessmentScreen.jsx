import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft as ArrowLeftIcon,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import BackButton from "../components/common/BackButton";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { ROLE_TITLES } from "../constants/roles";
import { generateAssessmentQuestions } from "../services/aiAssessmentService";

/**
 * AssessmentScreen — the real, working assessment flow described in
 * ARCHITECTURE.md's Phase 0 slice: fetches questions from the Question
 * Generation Agent (with difficulty decided by the Difficulty Engine),
 * lets the student answer them one at a time, and scores locally.
 *
 * KNOWN LIMITATION (intentional, for now): CorrectAnswer ships in the
 * initial fetch payload, so a student could technically read it from
 * DevTools' Network tab before answering. That's acceptable for a
 * proof-of-concept / development build, but NOT acceptable once this is
 * a real graded assessment — at that point, scoring needs to move
 * server-side (the Evaluation Agent, §9 Phase 3 in ARCHITECTURE.md),
 * with the frontend never receiving the answer key up front.
 *
 * Fetch state machine: "loading" -> "error" | "ready"
 * Quiz state machine (once "ready"): in-progress -> "submitted"
 */
export default function AssessmentScreen({ selectedRole, selectedSkills, onBack }) {
  const [fetchState, setFetchState] = useState("loading"); // loading | error | ready
  const [errorMessage, setErrorMessage] = useState("");
  const [questions, setQuestions] = useState([]);
  const [difficulty, setDifficulty] = useState(null);
  const [difficultyReasoning, setDifficultyReasoning] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [TempID]: "OptionA" }
  const [submitted, setSubmitted] = useState(false);

  const roleTitle = ROLE_TITLES[selectedRole] || "General";

  const fetchQuestions = useCallback(async () => {
    setFetchState("loading");
    setErrorMessage("");
    try {
      // First-ever assessment for this session: no prior score/time
      // baseline yet, so the Difficulty Engine falls back to its
      // no-baseline path (see difficulty_engine.py) using neutral
      // mid-range defaults. Once quiz_results/learning_progress exist
      // (§9 Phase 3+), these signals come from real history instead.
      const result = await generateAssessmentQuestions({
        skill: roleTitle,
        topics: selectedSkills.length ? selectedSkills : [roleTitle],
        count: 3, // kept low for demo reliability — fewer tokens = faster
                  // generation, less exposure to Gemini overload windows.
                  // Bump back to 5+ once things are stable.
        signals: {
          previous_score: 50,
          time_taken_seconds: 0,
          expected_time_seconds: 0,
          confidence: 50,
          mistake_rate: 0,
        },
      });
      setQuestions(result.questions);
      setDifficulty(result.difficulty);
      setDifficultyReasoning(result.difficulty_reasoning);
      setFetchState("ready");
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.error || err.message || "Something went wrong generating your assessment."
      );
      setFetchState("error");
    }
  }, [roleTitle, selectedSkills]);

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentQuestion = questions[currentIndex];
  const selectedOption = currentQuestion ? answers[currentQuestion.TempID] : undefined;
  const isLastQuestion = currentIndex === questions.length - 1;
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.TempID]);

  const selectAnswer = (optionKey) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.TempID]: optionKey }));
  };

  const goNext = () => {
    if (!isLastQuestion) setCurrentIndex((i) => i + 1);
  };
  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleSubmit = () => setSubmitted(true);

  const handleRetake = () => {
    setCurrentIndex(0);
    setAnswers({});
    setSubmitted(false);
    fetchQuestions();
  };

  const score = submitted
    ? questions.filter((q) => answers[q.TempID] === q.CorrectAnswer).length
    : 0;
  const scorePercent = questions.length ? Math.round((score / questions.length) * 100) : 0;

  // ---------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------
  if (fetchState === "loading") {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20">
        <BackButton onClick={onBack} label="Back" />
        <div
          className="max-w-lg mx-auto flex flex-col items-center text-center gap-4 py-16 px-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
          >
            <Loader2 size={40} style={{ color: COLORS.purple }} />
          </motion.div>
          <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            Generating your assessment…
          </h3>
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            The Question Generation Agent is writing questions on{" "}
            {(selectedSkills.length ? selectedSkills : [roleTitle]).join(", ")}.
            This can take up to a minute on the first request.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------
  if (fetchState === "error") {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20">
        <BackButton onClick={onBack} label="Back" />
        <div
          className="max-w-lg mx-auto flex flex-col items-center text-center gap-4 py-14 px-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <XCircle size={40} style={{ color: "#E0559C" }} />
          <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            Couldn't generate your assessment
          </h3>
          <p className="text-sm" style={{ color: COLORS.textMid }}>{errorMessage}</p>
          <motion.button
            onClick={fetchQuestions}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="mt-2 flex items-center gap-2 font-semibold"
            style={{
              padding: "12px 24px",
              borderRadius: 9999,
              color: "#fff",
              border: "none",
              background: GRADIENTS.purpleSky,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={16} /> Try Again
          </motion.button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Results (submitted)
  // ---------------------------------------------------------------------
  if (submitted) {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20">
        <BackButton onClick={onBack} label="Back" />

        <div
          className="max-w-2xl mx-auto text-center py-10 px-8 mb-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: COLORS.textMid }}>
            Your Score
          </p>
          <p className="text-5xl font-extrabold mb-2" style={{ color: COLORS.textDark }}>
            {score}/{questions.length}
          </p>
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            {scorePercent}% correct · {difficulty || "Medium"} difficulty
          </p>
        </div>

        <div className="max-w-2xl mx-auto flex flex-col gap-4 mb-8">
          {questions.map((q, i) => {
            const chosen = answers[q.TempID];
            const isCorrect = chosen === q.CorrectAnswer;
            return (
              <div
                key={q.TempID}
                className="p-5"
                style={{ ...GLASS_CARD, borderRadius: 20 }}
              >
                <div className="flex items-start gap-3 mb-3">
                  {isCorrect ? (
                    <CheckCircle2 size={20} style={{ color: "#4ADE80", flexShrink: 0, marginTop: 2 }} />
                  ) : (
                    <XCircle size={20} style={{ color: "#E0559C", flexShrink: 0, marginTop: 2 }} />
                  )}
                  <p className="font-semibold" style={{ color: COLORS.textDark }}>
                    {i + 1}. {q.Question}
                  </p>
                </div>
                <div className="pl-8 text-sm space-y-1" style={{ color: COLORS.textMid }}>
                  <p>
                    Your answer:{" "}
                    <span style={{ color: isCorrect ? "#22C55E" : "#E0559C", fontWeight: 600 }}>
                      {chosen ? q[chosen] : "(skipped)"}
                    </span>
                  </p>
                  {!isCorrect && (
                    <p>
                      Correct answer:{" "}
                      <span style={{ color: "#22C55E", fontWeight: 600 }}>{q[q.CorrectAnswer]}</span>
                    </p>
                  )}
                  {q.Explanation && <p className="italic mt-1">{q.Explanation}</p>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="max-w-2xl mx-auto flex justify-center">
          <motion.button
            onClick={handleRetake}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 font-semibold"
            style={{
              padding: "14px 28px",
              borderRadius: 9999,
              color: "#fff",
              border: "none",
              background: GRADIENTS.purplePink,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
            }}
          >
            <RotateCcw size={16} /> Take Another Assessment
          </motion.button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // In-progress quiz
  // ---------------------------------------------------------------------
  if (!currentQuestion) return null;

  const optionKeys = ["OptionA", "OptionB", "OptionC", "OptionD"];

  return (
    <div className="px-4 sm:px-8 pt-10 pb-40">
      <BackButton onClick={onBack} label="Back" />

      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: COLORS.purple }} />
            <span className="text-xs font-semibold" style={{ color: COLORS.textMid }}>
              Question {currentIndex + 1} of {questions.length}
              {difficulty ? ` · ${difficulty}` : ""}
            </span>
          </div>
        </div>
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.4)" }}
        >
          <motion.div
            initial={false}
            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
            style={{ height: "100%", background: GRADIENTS.purpleSky, borderRadius: 9999 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.TempID}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.22 }}
          className="max-w-2xl mx-auto p-7"
          style={{ ...GLASS_CARD, borderRadius: 24 }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: COLORS.textLight }}>
            {currentQuestion.Topic}
          </p>
          <h3 className="text-lg font-bold mb-6" style={{ color: COLORS.textDark }}>
            {currentQuestion.Question}
          </h3>

          <div className="flex flex-col gap-3">
            {optionKeys.map((key) => {
              const isSelected = selectedOption === key;
              return (
                <motion.button
                  key={key}
                  onClick={() => selectAnswer(key)}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.99 }}
                  className="text-left px-5 py-3.5 font-medium"
                  style={{
                    borderRadius: 16,
                    border: `2px solid ${isSelected ? COLORS.purple : COLORS.border}`,
                    background: isSelected ? "rgba(192,132,252,0.18)" : "rgba(255,255,255,0.35)",
                    color: COLORS.textDark,
                    cursor: "pointer",
                  }}
                >
                  {currentQuestion[key]}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, padding: "0 16px 16px" }}
      >
        <div
          className="max-w-2xl mx-auto flex items-center justify-between gap-4 px-5 sm:px-7 py-4"
          style={{ ...GLASS_CARD, borderRadius: 26, boxShadow: "0 -8px 30px rgba(160,100,255,0.25)" }}
        >
          <motion.button
            onClick={goPrev}
            disabled={currentIndex === 0}
            whileHover={currentIndex > 0 ? { x: -2 } : {}}
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{
              color: COLORS.textMid,
              opacity: currentIndex === 0 ? 0.4 : 1,
              cursor: currentIndex === 0 ? "not-allowed" : "pointer",
              background: "none",
              border: "none",
            }}
          >
            <ArrowLeftIcon size={16} /> Previous
          </motion.button>

          {isLastQuestion ? (
            <motion.button
              disabled={!allAnswered}
              onClick={handleSubmit}
              whileHover={allAnswered ? { y: -2 } : {}}
              whileTap={allAnswered ? { scale: 0.98 } : {}}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 font-semibold"
              style={{
                padding: "14px 28px",
                borderRadius: 9999,
                color: "#fff",
                border: "none",
                background: allAnswered ? GRADIENTS.purpleSky : "#C9C4D6",
                opacity: allAnswered ? 1 : 0.65,
                cursor: allAnswered ? "pointer" : "not-allowed",
              }}
            >
              Submit Assessment <CheckCircle2 size={16} />
            </motion.button>
          ) : (
            <motion.button
              disabled={!selectedOption}
              onClick={goNext}
              whileHover={selectedOption ? { y: -2 } : {}}
              whileTap={selectedOption ? { scale: 0.98 } : {}}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 font-semibold"
              style={{
                padding: "14px 28px",
                borderRadius: 9999,
                color: "#fff",
                border: "none",
                background: selectedOption ? GRADIENTS.purpleSky : "#C9C4D6",
                opacity: selectedOption ? 1 : 0.65,
                cursor: selectedOption ? "pointer" : "not-allowed",
              }}
            >
              Next <ArrowRight size={16} />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
