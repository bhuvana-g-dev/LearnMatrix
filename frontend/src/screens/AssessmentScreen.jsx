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
  Map,
} from "lucide-react";
import BackButton from "../components/common/BackButton";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { ROLE_TITLES } from "../constants/roles";
import {
  generateDiagnosticAssessment,
  evaluateDiagnosticAssessment,
  generateRoadmap,
} from "../services/aiAssessmentService";

const LEVEL_COLORS = {
  Strong: "#22C55E",
  Intermediate: "#F59E0B",
  Weak: "#E0559C",
  "Not Attempted": "#9CA3AF",
};

/**
 * AssessmentScreen — the real diagnostic assessment flow (see
 * ARCHITECTURE.md's "core intelligence" upgrade): generates 2 Easy +
 * 2 Medium + 2 Hard questions PER selected skill (Assessment Planner +
 * QuestionGenerationAgent.run_mixed()), then after submission calls the
 * Evaluation Agent for a real skill-wise Strong/Intermediate/Weak table
 * — not just one overall percentage.
 *
 * KNOWN LIMITATION (intentional, for now): CorrectAnswer ships in the
 * initial fetch payload, so a student could technically read it from
 * DevTools' Network tab before answering. That's acceptable for a
 * proof-of-concept / development build, but NOT acceptable once this is
 * a real graded assessment — at that point, the answer key needs to stay
 * server-side entirely (§9 Phase 3 in ARCHITECTURE.md).
 *
 * Fetch state machine: "loading" -> "error" | "ready"
 * Quiz state machine (once "ready"): in-progress -> "evaluating" -> "submitted"
 */
export default function AssessmentScreen({ selectedRole, selectedSkills, onBack }) {
  const [fetchState, setFetchState] = useState("loading"); // loading | error | ready
  const [errorMessage, setErrorMessage] = useState("");
  const [questions, setQuestions] = useState([]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [TempID]: "OptionA" }
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null); // { skills: [...], overall: {...} }
  const [submitted, setSubmitted] = useState(false);
  const [roadmap, setRoadmap] = useState(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [roadmapError, setRoadmapError] = useState("");

  const roleTitle = ROLE_TITLES[selectedRole] || "General";
  const skillsForAssessment = selectedSkills.length ? selectedSkills : [roleTitle];

  const fetchQuestions = useCallback(async () => {
    setFetchState("loading");
    setErrorMessage("");
    try {
      const result = await generateDiagnosticAssessment({
        skills: skillsForAssessment,
        role: roleTitle,
      });
      setQuestions(result.questions);
      setFetchState("ready");
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.error || err.message || "Something went wrong generating your assessment."
      );
      setFetchState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSubmit = async () => {
    setEvaluating(true);
    try {
      const result = await evaluateDiagnosticAssessment(questions, answers);
      setEvaluation(result);
      setSubmitted(true);
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.error || err.message || "Something went wrong scoring your assessment."
      );
      setFetchState("error");
    } finally {
      setEvaluating(false);
    }
  };

  const handleRetake = () => {
    setCurrentIndex(0);
    setAnswers({});
    setSubmitted(false);
    setEvaluation(null);
    setRoadmap(null);
    setRoadmapError("");
    fetchQuestions();
  };

  const handleViewRoadmap = async () => {
    setLoadingRoadmap(true);
    setRoadmapError("");
    try {
      const result = await generateRoadmap(evaluation);
      setRoadmap(result);
    } catch (err) {
      setRoadmapError(err.message || "Couldn't generate your roadmap.");
    } finally {
      setLoadingRoadmap(false);
    }
  };

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
            Building your diagnostic assessment…
          </h3>
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            Generating Easy, Medium, and Hard questions for {skillsForAssessment.join(", ")}.
            This can take a little while with several skills selected.
          </p>
        </div>
      </div>
    );
  }

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
            Couldn't build your assessment
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

  if (submitted && evaluation) {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20">
        <BackButton onClick={onBack} label="Back" />

        <div
          className="max-w-3xl mx-auto text-center py-10 px-8 mb-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: COLORS.textMid }}>
            Overall Score
          </p>
          <p className="text-5xl font-extrabold mb-2" style={{ color: COLORS.textDark }}>
            {evaluation.overall.correct}/{evaluation.overall.total}
          </p>
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            {evaluation.overall.scorePercent}% correct across {evaluation.skills.length} skill(s)
          </p>
        </div>

        <div
          className="max-w-3xl mx-auto mb-8 overflow-hidden"
          style={{ ...GLASS_CARD, borderRadius: 24 }}
        >
          <div className="px-6 pt-5 pb-1">
            <h3 className="text-base font-bold" style={{ color: COLORS.textDark }}>
              Skill-wise Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: COLORS.textMid }}>
                  <th className="text-left font-semibold px-6 py-3">Skill</th>
                  <th className="text-center font-semibold px-3 py-3">Easy</th>
                  <th className="text-center font-semibold px-3 py-3">Medium</th>
                  <th className="text-center font-semibold px-3 py-3">Hard</th>
                  <th className="text-center font-semibold px-3 py-3">Score</th>
                  <th className="text-center font-semibold px-6 py-3">Level</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.skills.map((s) => {
                  const e = s.breakdown.Easy || { correct: 0, total: 0 };
                  const m = s.breakdown.Medium || { correct: 0, total: 0 };
                  const h = s.breakdown.Hard || { correct: 0, total: 0 };
                  return (
                    <tr key={s.skill} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td className="px-6 py-3 font-semibold" style={{ color: COLORS.textDark }}>
                        {s.skill}
                      </td>
                      <td className="text-center px-3 py-3" style={{ color: COLORS.textMid }}>
                        {e.correct}/{e.total}
                      </td>
                      <td className="text-center px-3 py-3" style={{ color: COLORS.textMid }}>
                        {m.correct}/{m.total}
                      </td>
                      <td className="text-center px-3 py-3" style={{ color: COLORS.textMid }}>
                        {h.correct}/{h.total}
                      </td>
                      <td className="text-center px-3 py-3 font-semibold" style={{ color: COLORS.textDark }}>
                        {s.scorePercent}%
                      </td>
                      <td className="text-center px-6 py-3">
                        <span
                          className="px-3 py-1 text-xs font-bold rounded-full"
                          style={{
                            color: "#fff",
                            background: LEVEL_COLORS[s.level] || COLORS.textMid,
                          }}
                        >
                          {s.level}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Learning Roadmap — Roadmap Agent, generated on demand from the evaluation above */}
        <div className="max-w-3xl mx-auto mb-8">
          {!roadmap && (
            <div className="flex flex-col items-center gap-3 py-6" style={{ ...GLASS_CARD, borderRadius: 24 }}>
              {roadmapError && (
                <p className="text-sm px-6 text-center" style={{ color: "#E0559C" }}>{roadmapError}</p>
              )}
              <motion.button
                onClick={handleViewRoadmap}
                disabled={loadingRoadmap}
                whileHover={!loadingRoadmap ? { y: -2 } : {}}
                whileTap={!loadingRoadmap ? { scale: 0.97 } : {}}
                className="flex items-center gap-2 font-semibold"
                style={{
                  padding: "14px 28px",
                  borderRadius: 9999,
                  color: "#fff",
                  border: "none",
                  background: GRADIENTS.purpleSky,
                  cursor: loadingRoadmap ? "not-allowed" : "pointer",
                  opacity: loadingRoadmap ? 0.7 : 1,
                }}
              >
                {loadingRoadmap ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Building your roadmap…
                  </>
                ) : (
                  <>
                    <Map size={16} /> View My Learning Roadmap
                  </>
                )}
              </motion.button>
            </div>
          )}

          {roadmap && (
            <div className="p-6" style={{ ...GLASS_CARD, borderRadius: 24 }}>
              <h3 className="text-base font-bold mb-1" style={{ color: COLORS.textDark }}>
                Your Learning Roadmap
              </h3>
              <p className="text-sm mb-5" style={{ color: COLORS.textMid }}>
                {roadmap.entries.length > 0
                  ? `${roadmap.totalWeeks}-week plan, weakest areas first`
                  : "You're already strong across every skill tested — no revision needed."}
              </p>

              <div className="flex flex-col gap-3">
                {roadmap.entries.map((entry) => (
                  <div
                    key={entry.skill}
                    className="flex items-start gap-4 p-4"
                    style={{ borderRadius: 16, background: "rgba(255,255,255,0.4)" }}
                  >
                    <div
                      className="flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: GRADIENTS.purpleSky, color: "#fff",
                      }}
                    >
                      {entry.week}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: COLORS.textDark }}>
                        Week {entry.week}: {entry.skill}
                        <span
                          className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full"
                          style={{ color: "#fff", background: LEVEL_COLORS[entry.currentLevel] || COLORS.textMid }}
                        >
                          {entry.currentLevel}
                        </span>
                      </p>
                      <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
                        {entry.recommendation}
                      </p>
                    </div>
                  </div>
                ))}

                {roadmap.includesProjectWeek && (
                  <div
                    className="flex items-start gap-4 p-4"
                    style={{ borderRadius: 16, background: "rgba(255,255,255,0.4)" }}
                  >
                    <div
                      className="flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: GRADIENTS.purplePink, color: "#fff",
                      }}
                    >
                      {roadmap.totalWeeks}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: COLORS.textDark }}>
                        Week {roadmap.totalWeeks}: Mini Project
                      </p>
                      <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
                        Combine everything above into one small project to consolidate what you've learned.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {roadmap.alreadyStrong.length > 0 && (
                <p className="text-xs mt-5" style={{ color: COLORS.textLight }}>
                  Already strong (no revision scheduled): {roadmap.alreadyStrong.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="max-w-3xl mx-auto flex flex-col gap-6 mb-8">
          {evaluation.skills.map((s) => (
            <div key={s.skill}>
              <p className="text-xs font-bold uppercase tracking-wide mb-2 px-1" style={{ color: COLORS.textLight }}>
                {s.skill}
              </p>
              <div className="flex flex-col gap-3">
                {questions
                  .filter((q) => q.Skill === s.skill)
                  .map((q, i) => {
                    const chosen = answers[q.TempID];
                    const isCorrect = chosen === q.CorrectAnswer;
                    return (
                      <div key={q.TempID} className="p-5" style={{ ...GLASS_CARD, borderRadius: 20 }}>
                        <div className="flex items-start gap-3 mb-3">
                          {isCorrect ? (
                            <CheckCircle2 size={20} style={{ color: "#4ADE80", flexShrink: 0, marginTop: 2 }} />
                          ) : (
                            <XCircle size={20} style={{ color: "#E0559C", flexShrink: 0, marginTop: 2 }} />
                          )}
                          <div>
                            <span
                              className="text-[10px] font-bold uppercase tracking-wide mr-2"
                              style={{ color: COLORS.purple }}
                            >
                              {q.Difficulty}
                            </span>
                            <p className="font-semibold inline" style={{ color: COLORS.textDark }}>
                              {i + 1}. {q.Question}
                            </p>
                          </div>
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
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto flex justify-center">
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
              {currentQuestion.Skill} · Question {currentIndex + 1} of {questions.length} · {currentQuestion.Difficulty}
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
              disabled={!allAnswered || evaluating}
              onClick={handleSubmit}
              whileHover={allAnswered && !evaluating ? { y: -2 } : {}}
              whileTap={allAnswered && !evaluating ? { scale: 0.98 } : {}}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 font-semibold"
              style={{
                padding: "14px 28px",
                borderRadius: 9999,
                color: "#fff",
                border: "none",
                background: allAnswered ? GRADIENTS.purpleSky : "#C9C4D6",
                opacity: allAnswered && !evaluating ? 1 : 0.65,
                cursor: allAnswered && !evaluating ? "pointer" : "not-allowed",
              }}
            >
              {evaluating ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Scoring…
                </>
              ) : (
                <>
                  Submit Assessment <CheckCircle2 size={16} />
                </>
              )}
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
