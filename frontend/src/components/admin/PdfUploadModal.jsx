import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, X, FileText, ArrowRight } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import { extractQuestionsFromPdf } from "../../services/adminQuestionService";

/**
 * PdfUploadModal — lets the admin upload a PDF, shows the candidate
 * questions the backend extracted (utils/pdf_question_extractor.py), and
 * hands the chosen row off via onReview so QuestionUploadScreen can open
 * QuestionForm pre-filled with it. Nothing is saved to Firestore here —
 * extraction is read-only until the admin submits the form.
 */
export default function PdfUploadModal({ onClose, onReview }) {
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState(null);
  const inputRef = useRef(null);

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setError("");
    try {
      const results = await extractQuestionsFromPdf(file);
      setCandidates(results);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Failed to extract PDF.");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(59,32,99,0.4)", zIndex: 60 }}
      />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        className="p-6 sm:p-8 w-full max-w-xl"
        style={{
          ...GLASS_CARD,
          borderRadius: 24,
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 61,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: COLORS.textDark }}>Upload PDF</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={18} color={COLORS.textMid} />
          </button>
        </div>

        {!candidates && (
          <>
            <div
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center text-center cursor-pointer"
              style={{
                border: `2px dashed ${COLORS.border}`,
                borderRadius: 18,
                padding: "36px 20px",
                background: "rgba(255,255,255,0.35)",
              }}
            >
              <UploadCloud size={26} color={COLORS.purple} />
              <p className="text-sm font-semibold mt-3" style={{ color: COLORS.textDark }}>
                {file ? file.name : "Click to choose a PDF"}
              </p>
              <p className="text-xs mt-1" style={{ color: COLORS.textLight }}>
                Questions with A/B/C/D options are auto-detected
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
            </div>

            {error && <p className="text-xs mt-3" style={{ color: "#E4568A" }}>{error}</p>}

            <motion.button
              onClick={handleExtract}
              disabled={!file || extracting}
              whileHover={{ y: -2 }}
              className="w-full font-semibold text-sm mt-5"
              style={{
                padding: "12px 0",
                borderRadius: 9999,
                background: GRADIENTS.purplePink,
                color: "#fff",
                border: "none",
                cursor: file ? "pointer" : "not-allowed",
                opacity: !file || extracting ? 0.65 : 1,
              }}
            >
              {extracting ? "Extracting..." : "Extract Questions"}
            </motion.button>
          </>
        )}

        {candidates && (
          <>
            <p className="text-xs mb-4" style={{ color: COLORS.textMid }}>
              Found {candidates.length} candidate question{candidates.length === 1 ? "" : "s"}. Pick one to
              review and complete its QuestionID, Skill, Difficulty and Status before saving.
            </p>
            <div className="flex flex-col gap-2.5">
              {candidates.map((c, idx) => (
                <button
                  key={idx}
                  onClick={() => onReview(c)}
                  className="text-left flex items-start justify-between gap-3"
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    background: "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                  }}
                >
                  <span className="flex items-start gap-2">
                    <FileText size={15} color={COLORS.purple} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span className="text-sm" style={{ color: COLORS.textDark }}>
                      {c.Question || "(no question text detected)"}
                    </span>
                  </span>
                  <ArrowRight size={15} color={COLORS.textLight} style={{ flexShrink: 0 }} />
                </button>
              ))}
              {candidates.length === 0 && (
                <p className="text-sm" style={{ color: COLORS.textMid }}>
                  No questions could be detected in this PDF. Try Add Question to enter it manually.
                </p>
              )}
            </div>
            <button
              onClick={() => setCandidates(null)}
              className="text-xs font-semibold mt-5"
              style={{ background: "none", border: "none", color: COLORS.textMid, cursor: "pointer" }}
            >
              ← Upload a different PDF
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
