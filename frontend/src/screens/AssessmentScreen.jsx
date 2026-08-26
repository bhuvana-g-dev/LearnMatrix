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
import RoadmapDisplay from "../components/roadmap/RoadmapDisplay";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { ROLE_TITLES } from "../constants/roles";
import {
  generateDiagnosticAssessment,
  evaluateDiagnosticAssessment,
  generateRoadmap,
  loadSavedAssessmentResult,
} from "../services/aiAssessmentService";

const LEVEL_COLORS = {
  Strong: "#22C55E",
  Intermediate: "#F59E0B",
  Weak: "#E0559C",
  "Not Attempted": "#9CA3AF",
};

/**
 * TypedAnswerInput — the text-entry counterpart to the 4 MCQ option
 * buttons, for FillBlank and CodeCompletion questions (backend:
 * services/assessment_planner.py's open-ended slots). Whatever gets
 * typed here is sent back exactly as-is in the `answers` payload — the
 * backend does the loose/AI-assisted equivalence check (see
 * services/answer_equivalence_service.py), this component doesn't try
 * to validate or format it.
 */
function TypedAnswerInput({ questionType, value, onChange, disabled }) {
  const isCode = questionType === "CodeCompletion";
  return (
    <div>
      <label
        className="block text-xs font-semibold mb-2 px-1"
        style={{ color: COLORS.textMid }}
      >
        {isCode ? "Type the missing code:" : "Type your answer:"}
      </label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isCode ? "e.g. range(5)" : "Your answer"}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={!isCode}
        className="w-full px-5 py-3.5 font-medium"
        style={{
          borderRadius: 16,
          border: `2px solid ${value ? COLORS.purple : COLORS.border}`,
          background: "rgba(255,255,255,0.5)",
          color: COLORS.textDark,
          outline: "none",
          fontFamily: isCode
            ? "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
            : "inherit",
        }}
      />
    </div>
  );
}

/**
 * AssessmentScreen — the real diagnostic assessment flow (see
 * ARCHITECTURE.md's "core intelligence" upgrade): generates 5 Easy +
 * 5 Medium + 5 Hard questions PER selected skill (Assessment Planner +
 * QuestionGenerationAgent.run_chunked()), 4 of which are typed-answer
 * (FillBlank or CodeCompletion, auto-detected per skill — see
 * services/assessment_planner.py) instead of multiple-choice, then
 * after submission calls the
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
export default function AssessmentScreen({ selectedRole, selectedSkills, uid, onBack }) {
  // "checking" (new): looking for a previously completed & saved result
  // BEFORE generating anything new — this is what stops a page refresh
  // from silently burning a fresh AI call and discarding the student's
  // actual first attempt. Only an explicit "Take Another Assessment"
  // click should ever call fetchQuestions() after the initial check.
  const [fetchState, setFetchState] = useState("checking"); // checking | loading | error | ready
  const [errorMessage, setErrorMessage] = useState("");
  const [questions, setQuestions] = useState([]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [TempID]: "OptionA" | <typed answer text> }
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null); // { skills: [...], overall: {...} }
  const [submitted, setSubmitted] = useState(false);
  const [roadmap, setRoadmap] = useState(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [roadmapError, setRoadmapError] = useState("");

  // No fallback to a generic "General" role/quiz here on purpose — a
  // diagnostic assessment only ever makes sense for a role the student
  // actually chose. If selectedRole is missing (e.g. this screen was
  // reached before Role Selection, or selectedRole reset on a refresh),
  // the "no role selected" state below sends them back instead of
  // silently generating a generic quiz.
  const roleTitle = ROLE_TITLES[selectedRole] || "";
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
    // No role selected -> there's nothing valid to generate a diagnostic
    // for. Stay in "checking" (renders the "no role selected" state
    // below) instead of falling through to a generic quiz.
    if (!selectedRole) return;

    // No uid (not logged in / auth not ready yet) -> can't check for a
    // saved result, just go straight to generating one.
    if (!uid) {
      fetchQuestions();
      return;
    }
    (async () => {
      try {
        const saved = await loadSavedAssessmentResult(uid);
        if (saved) {
          // Found a previously completed attempt — show IT, don't
          // generate a new one. Loads straight into the results view.
          setQuestions(saved.questions);
          setAnswers(saved.answers);
          setEvaluation(saved.evaluation);
          setSubmitted(true);
          setFetchState("ready");
        } else {
          fetchQuestions();
        }
      } catch {
        // Couldn't check (e.g. transient network issue) — fail open to
        // the normal generation flow rather than blocking the student.
        fetchQuestions();
      }
    })();
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
    let evalResult;
    try {
      // Passing uid/role/skills also SAVES the full result to Firestore
      // (backend/services/assessment_repository.py) — this is the write
      // side of the "don't regenerate on refresh" fix.
      evalResult = await evaluateDiagnosticAssessment(
        questions, answers, uid, roleTitle, skillsForAssessment
      );
      setEvaluation(evalResult);
      setSubmitted(true);
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.error || err.message || "Something went wrong scoring your assessment."
      );
      setFetchState("error");
      setEvaluating(false);
      return;
    }
    setEvaluating(false);

    // Auto-generate the roadmap right after evaluation succeeds, so this
    // no longer depends on the "View My Learning Roadmap" button/UI at all.
    // Use evalResult directly (not the `evaluation` state var, which won't
    // have committed yet inside this same function).
    setLoadingRoadmap(true);
    setRoadmapError("");
    try {
      // selectedRole is already the role ID (e.g. "frontend" — see
      // constants/roles.js), so no title->id lookup needed here, unlike
      // RoadmapScreen.jsx which only has the saved role TITLE to work with.
      const roadmapResult = await generateRoadmap(evalResult, uid, roleTitle, selectedRole);
      setRoadmap(roadmapResult);
    } catch (err) {
      setRoadmapError(err.message || "Couldn't generate your roadmap.");
    } finally {
      setLoadingRoadmap(false);
    }
  };

  const handleRetake = () => {
    setCurrentIndex(0);
    setAnswers({});
    setSubmitted(false);
    setEvaluation(null);
    setRoadmap(null);
    setRoadmapError("");
    fetchQuestions(); // explicit retake -> generate a genuinely new assessment
  };

  const handleViewRoadmap = async () => {
    setLoadingRoadmap(true);
    setRoadmapError("");
    try {
      // selectedRole is already the role ID (e.g. "frontend" — see
      // constants/roles.js), so no title->id lookup needed here, unlike
      // RoadmapScreen.jsx which only has the saved role TITLE to work with.
      const result = await generateRoadmap(evaluation, uid, roleTitle, selectedRole);
      setRoadmap(result);
    } catch (err) {
      setRoadmapError(err.message || "Couldn't generate your roadmap.");
    } finally {
      setLoadingRoadmap(false);
    }
  };

  if (!selectedRole) {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20">
        <BackButton onClick={onBack} label="Back" />
        <div
          className="max-w-lg mx-auto flex flex-col items-center text-center gap-4 py-16 px-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            Choose a role first
          </h3>
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            The diagnostic assessment is built around a specific role's skills —
            pick a role in My Career Path before taking it.
          </p>
        </div>
      </div>
    );
  }

  if (fetchState === "checking" || fetchState === "loading") {
    const isChecking = fetchState === "checking";
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
            {isChecking ? "Checking for a previous attempt…" : "Building your diagnostic assessment…"}
          </h3>
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            {isChecking
              ? "One moment — making sure you don't already have a completed assessment."
              : `Generating Easy, Medium, and Hard questions for ${skillsForAssessment.join(", ")}. This can take a little while with several skills selected.`}
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
            <RoadmapDisplay
              roadmap={roadmap}
              showProgress={false}
              compressedSyllabus={roadmap.compressedSyllabus}
            />
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
                    const isMcq = q.QuestionType === "MCQ" || !q.QuestionType;
                    // Real backend correctness, not a client-side guess —
                    // for FillBlank/CodeCompletion this can be TRUE even
                    // when `chosen` isn't byte-identical to CorrectAnswer
                    // (see services/answer_equivalence_service.py's loose/
                    // AI-assisted match). Re-deriving this with `===` here
                    // would wrongly show a correct typed answer as wrong.
                    const isCorrect = evaluation.questionResults?.[q.TempID] ?? false;
                    const chosenDisplay = !chosen ? null : isMcq ? q[chosen] : chosen;
                    const correctDisplay = isMcq ? q[q.CorrectAnswer] : q.CorrectAnswer;
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
                              {chosenDisplay ?? "(skipped)"}
                            </span>
                          </p>
                          {!isCorrect && (
                            <p>
                              Correct answer:{" "}
                              <span style={{ color: "#22C55E", fontWeight: 600 }}>{correctDisplay}</span>
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
  const optionLetters = { OptionA: "A", OptionB: "B", OptionC: "C", OptionD: "D" };
  const DIFFICULTY_COLORS = { Easy: "#22C55E", Medium: "#D4A017", Hard: "#E0559C" };

  return (
    <div className="px-4 sm:px-8 pt-10 pb-40">
      <BackButton onClick={onBack} label="Back" />

      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: COLORS.purple }} />
            <span className="text-xs font-semibold" style={{ color: COLORS.textMid }}>
              {currentQuestion.Skill} · Question {currentIndex + 1} of {questions.length}
            </span>
          </div>
          <span
            className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full"
            style={{
              color: "#fff",
              background: DIFFICULTY_COLORS[currentQuestion.Difficulty] || COLORS.textMid,
            }}
          >
            {currentQuestion.Difficulty}
          </span>
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
          <span
            className="inline-block px-3 py-1 text-[11px] font-bold mb-3 rounded-full"
            style={{ color: COLORS.purple, background: "rgba(212,160,23,0.14)" }}
          >
            {currentQuestion.Topic}
          </span>
          {currentQuestion.QuestionType === "CodeCompletion" ? (
            <pre
              className="text-sm mb-6 p-4 overflow-x-auto"
              style={{
                borderRadius: 14,
                background: "rgba(13,27,61,0.92)",
                color: "#E5E7EB",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {currentQuestion.Question}
            </pre>
          ) : (
            <h3 className="text-lg font-bold mb-6" style={{ color: COLORS.textDark }}>
              {currentQuestion.Question}
            </h3>
          )}

          <div className="flex flex-col gap-3">
            {currentQuestion.QuestionType === "FillBlank" || currentQuestion.QuestionType === "CodeCompletion" ? (
              <TypedAnswerInput
                key={currentQuestion.TempID}
                questionType={currentQuestion.QuestionType}
                value={selectedOption || ""}
                onChange={selectAnswer}
                disabled={submitted}
              />
            ) : (
              optionKeys.map((key) => {
                const isSelected = selectedOption === key;
                return (
                  <motion.button
                    key={key}
                    onClick={() => selectAnswer(key)}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.99 }}
                    className="flex items-center gap-3.5 text-left px-5 py-3.5 font-medium"
                    style={{
                      borderRadius: 16,
                      border: `2px solid ${isSelected ? COLORS.purple : COLORS.border}`,
                      background: isSelected ? "rgba(212,160,23,0.14)" : "rgba(255,255,255,0.35)",
                      color: COLORS.textDark,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      className="flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: isSelected ? GRADIENTS.purpleSky : "rgba(13,27,61,0.06)",
                        color: isSelected ? "#fff" : COLORS.textMid,
                        transition: "all .2s ease",
                      }}
                    >
                      {optionLetters[key]}
                    </span>
                    {currentQuestion[key]}
                  </motion.button>
                );
              })
            )}
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
            whileHover={currentIndex > 0 ? { y: -2 } : {}}
            whileTap={currentIndex > 0 ? { scale: 0.97 } : {}}
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{
              padding: "14px 24px",
              borderRadius: 9999,
              color: COLORS.textDark,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(255,255,255,0.5)",
              opacity: currentIndex === 0 ? 0.4 : 1,
              cursor: currentIndex === 0 ? "not-allowed" : "pointer",
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
