import { useState } from "react";
import BackButton from "../../components/common/BackButton";
import QuestionForm from "../../components/admin/QuestionForm";
import { COLORS } from "../../constants/theme";
import { createQuestion, updateQuestion } from "../../services/adminQuestionService";

/**
 * QuestionUploadScreen — Add Question / Edit Question.
 * `initialValues` may come from: (a) nothing (blank Add), (b) an existing
 * question being edited, or (c) a PDF-extracted candidate row handed off
 * by PdfUploadModal via QuestionBankScreen's onAddQuestion(candidate).
 */
export default function QuestionUploadScreen({ initialValues, isEditing, onCancel, onSaved }) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const saved = isEditing
        ? await updateQuestion(values.QuestionID, values)
        : await createQuestion(values);
      onSaved(saved);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 pt-8 pb-12">
      <BackButton onClick={onCancel} label="Back to Question Bank" />
      <h1 className="text-2xl font-bold mb-1" style={{ color: COLORS.textDark }}>
        {isEditing ? "Edit Question" : "Add Question"}
      </h1>
      <p className="text-sm mb-6" style={{ color: COLORS.textMid }}>
        {isEditing
          ? "Update this question. It stays in place — nothing is duplicated."
          : "Fill in every field below, or review a PDF-extracted question."}
      </p>

      <div className="max-w-3xl">
        <QuestionForm
          initialValues={initialValues}
          isEditing={isEditing}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
