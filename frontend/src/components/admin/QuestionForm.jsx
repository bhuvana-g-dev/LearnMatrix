import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import { ROLES } from "../../constants/roles";
import { DIFFICULTIES, STATUSES, QUESTION_TYPES } from "../../constants/adminQuestionOptions";

const OPTION_LETTERS = ["A", "B", "C", "D"];

const EMPTY_QUESTION = {
  QuestionID: "",
  Role: "",
  Skill: "",
  Difficulty: "Easy",
  QuestionType: "MCQ",
  Question: "",
  OptionA: "",
  OptionB: "",
  OptionC: "",
  OptionD: "",
  CorrectAnswer: "A",
  Status: "Active",
};

const fieldStyle = (focused) => ({
  width: "100%",
  borderRadius: 14,
  background: "rgba(255,255,255,0.55)",
  border: `1.5px solid ${focused ? COLORS.purple : "rgba(255,255,255,0.7)"}`,
  boxShadow: focused ? "0 0 0 4px rgba(192,132,252,0.2)" : "none",
  padding: "11px 14px",
  fontSize: 14,
  color: COLORS.textDark,
  outline: "none",
  transition: "all .2s ease",
});

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: COLORS.textMid }}>
      {label}
      {children}
    </label>
  );
}

/**
 * QuestionForm — pure presentational form for Add/Edit Question.
 * `initialValues` (optional) pre-fills the form, e.g. from a PDF-extracted
 * candidate row or an existing question being edited. `isEditing` locks
 * QuestionID, since it's the permanent Firestore document key on the
 * backend (services/question_repository.py never lets it change).
 */
export default function QuestionForm({ initialValues, isEditing = false, onSubmit, onCancel, submitting }) {
  const [values, setValues] = useState({ ...EMPTY_QUESTION, ...initialValues });
  const [focused, setFocused] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setValues({ ...EMPTY_QUESTION, ...initialValues });
  }, [initialValues]);

  const set = (key) => (e) => setValues((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async () => {
    setFormError("");
    const required = ["QuestionID", "Role", "Skill", "Difficulty", "QuestionType", "Question", "OptionA", "OptionB", "OptionC", "OptionD", "CorrectAnswer"];
    const missing = required.filter((key) => !String(values[key] || "").trim());
    if (missing.length) {
      setFormError(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    try {
      await onSubmit(values);
    } catch (err) {
      setFormError(err?.response?.data?.error || err.message || "Failed to save question.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 sm:p-8"
      style={{ ...GLASS_CARD, borderRadius: 24 }}
    >
      <h2 className="text-lg font-bold mb-5" style={{ color: COLORS.textDark }}>
        {isEditing ? "Edit Question" : "Add Question"}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Question ID">
          <input
            value={values.QuestionID}
            onChange={set("QuestionID")}
            disabled={isEditing}
            placeholder="e.g. PY001"
            onFocus={() => setFocused("QuestionID")}
            onBlur={() => setFocused("")}
            style={{ ...fieldStyle(focused === "QuestionID"), opacity: isEditing ? 0.6 : 1 }}
          />
        </Field>

        <Field label="Role">
          <select value={values.Role} onChange={set("Role")} style={fieldStyle(focused === "Role")} onFocus={() => setFocused("Role")} onBlur={() => setFocused("")}>
            <option value="">Select role</option>
            {ROLES.map((r) => (
              <option key={r.id} value={r.title}>{r.title}</option>
            ))}
          </select>
        </Field>

        <Field label="Skill">
          <input
            value={values.Skill}
            onChange={set("Skill")}
            placeholder="e.g. Python"
            onFocus={() => setFocused("Skill")}
            onBlur={() => setFocused("")}
            style={fieldStyle(focused === "Skill")}
          />
        </Field>

        <Field label="Difficulty">
          <select value={values.Difficulty} onChange={set("Difficulty")} style={fieldStyle(focused === "Difficulty")} onFocus={() => setFocused("Difficulty")} onBlur={() => setFocused("")}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>

        <Field label="Question Type">
          <select value={values.QuestionType} onChange={set("QuestionType")} style={fieldStyle(focused === "QuestionType")} onFocus={() => setFocused("QuestionType")} onBlur={() => setFocused("")}>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select value={values.Status} onChange={set("Status")} style={fieldStyle(focused === "Status")} onFocus={() => setFocused("Status")} onBlur={() => setFocused("")}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Question">
            <textarea
              value={values.Question}
              onChange={set("Question")}
              rows={3}
              placeholder="Enter the question text"
              onFocus={() => setFocused("Question")}
              onBlur={() => setFocused("")}
              style={{ ...fieldStyle(focused === "Question"), resize: "vertical" }}
            />
          </Field>
        </div>

        {OPTION_LETTERS.map((letter) => (
          <Field key={letter} label={`Option ${letter}`}>
            <input
              value={values[`Option${letter}`]}
              onChange={set(`Option${letter}`)}
              placeholder={`Option ${letter}`}
              onFocus={() => setFocused(`Option${letter}`)}
              onBlur={() => setFocused("")}
              style={fieldStyle(focused === `Option${letter}`)}
            />
          </Field>
        ))}

        <Field label="Correct Answer">
          <select value={values.CorrectAnswer} onChange={set("CorrectAnswer")} style={fieldStyle(focused === "CorrectAnswer")} onFocus={() => setFocused("CorrectAnswer")} onBlur={() => setFocused("")}>
            {OPTION_LETTERS.map((letter) => (
              <option key={letter} value={letter}>{letter}</option>
            ))}
          </select>
        </Field>
      </div>

      {formError && (
        <p className="text-xs mt-4" style={{ color: "#E4568A" }}>{formError}</p>
      )}

      <div className="flex items-center gap-3 mt-6">
        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="font-semibold text-sm"
          style={{
            padding: "11px 24px",
            borderRadius: 9999,
            background: GRADIENTS.purplePink,
            color: "#fff",
            border: "none",
            boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
            cursor: "pointer",
            opacity: submitting ? 0.75 : 1,
          }}
        >
          {submitting ? "Saving..." : isEditing ? "Save Changes" : "Add Question"}
        </motion.button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-semibold"
            style={{ padding: "11px 20px", borderRadius: 9999, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textMid, cursor: "pointer" }}
          >
            Cancel
          </button>
        )}
      </div>
    </motion.div>
  );
}
