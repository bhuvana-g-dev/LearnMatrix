import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Download, Share2, Link2, Award } from "lucide-react";
import { COLORS, GRADIENTS } from "../../../constants/theme";

export default function CertificatePreviewModal({ certificate, onClose, onDownload, onShareLinkedIn, onCopyLink }) {
  return (
    <AnimatePresence>
      {certificate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 flex items-center justify-center p-4 sm:p-8"
          style={{ background: "rgba(59,32,99,0.55)", zIndex: 60 }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-3xl"
          >
            {/* Premium gradient border wrapper */}
            <div style={{ borderRadius: 28, padding: 3, background: GRADIENTS.purpleSky }}>
              <div
                className="relative p-8 sm:p-12"
                style={{ borderRadius: 26, background: "linear-gradient(135deg, #FDFBFF 0%, #F5EEFF 100%)" }}
              >
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.7)", border: "none", cursor: "pointer" }}
                  aria-label="Close"
                >
                  <X size={16} color={COLORS.textDark} />
                </button>

                {/* Certificate body — landscape layout */}
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center gap-2 mb-6">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: GRADIENTS.purplePink }}
                    >
                      <Award size={16} color="#fff" />
                    </div>
                    <span className="text-sm font-bold tracking-wide" style={{ color: COLORS.textDark }}>
                      LearnMatrix
                    </span>
                  </div>

                  <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: COLORS.textLight }}>
                    Certificate of Completion
                  </p>

                  <h2 className="text-2xl sm:text-3xl font-bold mt-3" style={{ color: COLORS.textDark }}>
                    {certificate.studentName}
                  </h2>

                  <p className="text-sm mt-3 max-w-md" style={{ color: COLORS.textMid }}>
                    has successfully completed the course
                  </p>
                  <p className="text-lg font-bold mt-1" style={{ color: "#8B5CF6" }}>
                    {certificate.courseName}
                  </p>
                  <p className="text-xs mt-1" style={{ color: COLORS.textMid }}>
                    under the {certificate.careerPath} career path, with a final score of{" "}
                    <span className="font-semibold">{certificate.score}%</span>
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 w-full max-w-lg">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: COLORS.textLight }}>Issue Date</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: COLORS.textDark }}>
                        {new Date(certificate.issueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: COLORS.textLight }}>Certificate ID</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: COLORS.textDark }}>{certificate.certificateId}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: COLORS.textLight }}>Mentor</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: COLORS.textDark }}>{certificate.mentor}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: COLORS.textLight }}>Status</p>
                      <p className="text-xs font-semibold mt-0.5 flex items-center justify-center gap-1" style={{ color: "#22C08E" }}>
                        <ShieldCheck size={12} /> {certificate.status}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full max-w-lg mt-10 pt-6" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <div className="text-left">
                      <p className="text-sm font-semibold italic" style={{ color: COLORS.textDark }}>LearnMatrix AI</p>
                      <p className="text-[10px]" style={{ color: COLORS.textLight }}>Authorized Signature</p>
                    </div>
                    <div
                      className="w-14 h-14 flex items-center justify-center"
                      style={{ borderRadius: 8, background: "rgba(139,92,246,0.12)" }}
                      aria-label="QR code placeholder"
                    >
                      <div className="grid grid-cols-3 gap-0.5">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} style={{ width: 6, height: 6, background: i % 2 === 0 ? "#8B5CF6" : "transparent" }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-center gap-3 mt-5">
              <button
                onClick={() => onDownload(certificate)}
                className="flex items-center gap-2 text-xs font-semibold"
                style={{ padding: "10px 20px", borderRadius: 9999, color: "#fff", border: "none", background: GRADIENTS.purplePink, cursor: "pointer" }}
              >
                <Download size={14} /> Download PDF
              </button>
              <button
                onClick={() => onShareLinkedIn(certificate)}
                className="flex items-center gap-2 text-xs font-semibold"
                style={{ padding: "10px 20px", borderRadius: 9999, color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.4)", background: "rgba(255,255,255,0.7)", cursor: "pointer" }}
              >
                <Share2 size={14} /> Share on LinkedIn
              </button>
              <button
                onClick={() => onCopyLink(certificate)}
                className="flex items-center gap-2 text-xs font-semibold"
                style={{ padding: "10px 20px", borderRadius: 9999, color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.4)", background: "rgba(255,255,255,0.7)", cursor: "pointer" }}
              >
                <Link2 size={14} /> Copy Verification Link
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
