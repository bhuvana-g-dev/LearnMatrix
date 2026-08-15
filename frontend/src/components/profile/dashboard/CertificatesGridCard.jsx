import { useState } from "react";
import { Award, ShieldCheck, Hourglass, Eye } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";
import DashCard, { DashCardTitle } from "./DashCard";
import CertificateModal from "./CertificateModal";

/**
 * Shows the ONE certificate tied to whatever career path the student's
 * current roadmap is for (backend/services/certificate_service.py) —
 * not a list of unrelated courses. It's issued the moment they start a
 * career path and auto-completes once their roadmap is fully mastered.
 * The actual certificate graphic (CertificateTemplate.jsx) only opens
 * once it's genuinely completed — an in_progress course has no
 * completion date yet, so there's nothing honest to show there.
 */
export default function CertificatesGridCard({ certificate, studentName }) {
  const [viewing, setViewing] = useState(false);
  const isCompleted = certificate?.status === "completed";

  return (
    <DashCard>
      <DashCardTitle icon={Award} iconColor={DASH.accentPurple}>
        Certificate
      </DashCardTitle>

      {!certificate ? (
        <div className="flex flex-col items-center text-center gap-2 py-6">
          <Award size={28} color={DASH.textLight} />
          <p className="text-xs" style={{ color: DASH.textLight }}>
            Start a career path to begin your certificate.
          </p>
        </div>
      ) : (
        <div
          className="p-5 flex flex-col gap-3"
          style={{
            borderRadius: 16,
            border: `1px solid ${DASH.accentPurpleSoft}`,
            background: `linear-gradient(135deg, ${DASH.accentPurpleSoft}, transparent)`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold" style={{ color: DASH.textLight }}>
                Certificate of Completion
              </p>
              <p className="text-base font-bold" style={{ color: DASH.textPrimary }}>
                {certificate.courseName}
              </p>
            </div>
            <span
              className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
              style={{
                background: isCompleted ? DASH.accentGreenSoft : DASH.accentTealSoft,
                color: isCompleted ? DASH.accentGreen : DASH.accentTeal,
              }}
            >
              {isCompleted ? <ShieldCheck size={12} /> : <Hourglass size={12} />}
              {isCompleted ? "Completed" : "In Progress"}
            </span>
          </div>

          <p className="text-sm" style={{ color: DASH.textMid }}>
            Awarded to <span className="font-semibold" style={{ color: DASH.textPrimary }}>{studentName}</span>
          </p>

          <div className="flex items-center justify-between text-[11px] pt-2 border-t" style={{ color: DASH.textLight, borderColor: DASH.border }}>
            <span>Started {certificate.startedOn}</span>
            <span>{certificate.completedOn ? `Completed ${certificate.completedOn}` : "Keep going to finish it"}</span>
          </div>
          <p className="text-[10px]" style={{ color: DASH.textLight }}>
            Certificate ID: {certificate.certificateId}
          </p>

          {isCompleted && (
            <button
              type="button"
              onClick={() => setViewing(true)}
              className="inline-flex items-center justify-center gap-2 text-xs font-semibold mt-1"
              style={{
                padding: "9px 0",
                borderRadius: 10,
                color: "#fff",
                background: DASH.accentPurple,
                border: "none",
                cursor: "pointer",
              }}
            >
              <Eye size={13} /> View Certificate
            </button>
          )}
        </div>
      )}

      {viewing && (
        <CertificateModal
          certificate={certificate}
          studentName={studentName}
          onClose={() => setViewing(false)}
        />
      )}
    </DashCard>
  );
}
