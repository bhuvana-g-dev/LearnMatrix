import { X, Printer } from "lucide-react";
import CertificateTemplate from "./CertificateTemplate";
import { COLORS } from "../../../constants/theme";

export default function CertificateModal({ certificate, studentName, onClose }) {
  if (!certificate) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(13,27,61,0.55)" }}
    >
      <div className="w-full max-w-3xl">
        <div id="certificate-print-area">
          <CertificateTemplate
            studentName={studentName}
            courseName={certificate.courseName}
            completedOn={certificate.completedOn}
            certificateId={certificate.certificateId}
          />
        </div>

        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 text-xs font-semibold"
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              color: "#fff",
              background: COLORS.purple,
              border: "none",
              cursor: "pointer",
            }}
          >
            <Printer size={13} /> Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 text-xs font-semibold"
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              color: COLORS.sky,
              background: COLORS.white,
              border: `1px solid ${COLORS.border}`,
              cursor: "pointer",
            }}
          >
            <X size={13} /> Close
          </button>
        </div>
      </div>

      {/* When printing, hide everything except the certificate itself */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #certificate-print-area, #certificate-print-area * { visibility: visible; }
          #certificate-print-area { position: fixed; inset: 0; }
        }
      `}</style>
    </div>
  );
}
