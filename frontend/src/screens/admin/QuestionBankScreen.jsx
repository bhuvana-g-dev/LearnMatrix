import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, UploadCloud } from "lucide-react";
import { COLORS, GRADIENTS } from "../../constants/theme";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import QuestionTable from "../../components/admin/QuestionTable";
import PdfUploadModal from "../../components/admin/PdfUploadModal";

/**
 * QuestionBankScreen owns the useQuestionBank() hook and renders the table.
 * Add/Edit navigation is delegated up to AdminApp via onAddQuestion /
 * onEditQuestion / onPreviewQuestion so this screen stays focused on
 * View / Search / Filter / Deactivate.
 */
export default function QuestionBankScreen({ onAddQuestion, onEditQuestion, onPreviewQuestion }) {
  const qb = useQuestionBank();
  const [showPdfModal, setShowPdfModal] = useState(false);

  return (
    <div className="px-4 sm:px-8 pt-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: COLORS.textDark }}>Question Bank</h1>
          <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
            View, search, filter, add, edit, and deactivate questions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <motion.button
            onClick={() => setShowPdfModal(true)}
            whileHover={{ y: -2 }}
            className="flex items-center gap-2 text-sm font-semibold"
            style={{
              padding: "10px 18px",
              borderRadius: 9999,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(255,255,255,0.5)",
              color: COLORS.textDark,
              cursor: "pointer",
            }}
          >
            <UploadCloud size={15} /> Upload PDF
          </motion.button>

          <motion.button
            onClick={() => onAddQuestion()}
            whileHover={{ y: -2 }}
            className="flex items-center gap-2 text-sm font-semibold"
            style={{
              padding: "10px 20px",
              borderRadius: 9999,
              background: GRADIENTS.purplePink,
              color: "#fff",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
            }}
          >
            <Plus size={15} /> Add Question
          </motion.button>
        </div>
      </div>

      <QuestionTable
        questions={qb.questions}
        loading={qb.loading}
        error={qb.error}
        filters={qb.filters}
        onFilterChange={qb.updateFilter}
        onClearFilters={qb.clearFilters}
        onEdit={onEditQuestion}
        onPreview={onPreviewQuestion}
        onDeactivate={qb.deactivateQuestion}
        onReactivate={qb.reactivateQuestion}
      />

      {showPdfModal && (
        <PdfUploadModal
          onClose={() => setShowPdfModal(false)}
          onReview={(candidate) => {
            setShowPdfModal(false);
            onAddQuestion(candidate); // hand the extracted row to Add Question, pre-filled
          }}
        />
      )}
    </div>
  );
}
