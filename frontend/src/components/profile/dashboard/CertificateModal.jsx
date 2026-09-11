import { useState } from "react";
import { X, Printer, Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import CertificateTemplate from "./CertificateTemplate";
import { COLORS } from "../../../constants/theme";

export default function CertificateModal({ certificate, studentName, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  if (!certificate) return null;

  // Rasterizes the actual on-screen certificate node (so it always
  // matches what's shown — one source of truth, no separate
  // server-side template to keep in sync) and embeds it as a single
  // full-bleed page. scale:2 keeps text crisp on retina/zoomed
  // screens; a plain toDataURL()/anchor download would work for PNG,
  // but a PDF is what "certificate" implies and prints reliably.
  async function handleDownload() {
    setDownloading(true);
    setDownloadError(false);
    try {
      const node = document.getElementById("certificate-print-area");
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);

      const safeCourse = (certificate.courseName || "Certificate").replace(/[^a-z0-9]+/gi, "-");
      const safeId = certificate.certificateId ? `-${certificate.certificateId}` : "";
      pdf.save(`LearnMatrix-${safeCourse}${safeId}.pdf`);
    } catch (err) {
      console.error("Certificate download failed:", err);
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

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

        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 text-xs font-semibold"
              style={{
                padding: "9px 18px",
                borderRadius: 10,
                color: "#fff",
                background: COLORS.purple,
                border: "none",
                cursor: downloading ? "wait" : "pointer",
                opacity: downloading ? 0.75 : 1,
              }}
            >
              {downloading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} />
              )}
              {downloading ? "Preparing..." : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
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
              <Printer size={13} /> Print
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
          {downloadError && (
            <p className="text-[11px]" style={{ color: "#B3261E" }}>
              Couldn't generate the PDF — try Print instead, or retry.
            </p>
          )}
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
