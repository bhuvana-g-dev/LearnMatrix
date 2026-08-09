import { motion } from "framer-motion";
import { Award, ShieldCheck, Clock3, Download, Share2, Link2, BadgeCheck, Eye } from "lucide-react";
import { COLORS, GRADIENTS } from "../../../constants/theme";

const STATUS_STYLE = {
  Verified: { color: "#22C08E", bg: "rgba(34,192,142,0.12)", Icon: ShieldCheck },
  Pending: { color: "#F0AB5C", bg: "rgba(240,171,92,0.14)", Icon: Clock3 },
  Completed: { color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", Icon: BadgeCheck },
};

function IconButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.7)", cursor: "pointer" }}
    >
      <Icon size={13} color="#8B5CF6" />
    </button>
  );
}

export default function CertificateCard({
  certificate,
  delay = 0,
  onView,
  onDownload,
  onShareLinkedIn,
  onCopyLink,
  onVerify,
}) {
  const statusInfo = STATUS_STYLE[certificate.status] || STATUS_STYLE.Completed;
  const StatusIcon = statusInfo.Icon;

  const issued = new Date(certificate.issueDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -3 }}
      className="p-5 flex flex-col"
      style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.32)" }}
    >
      {/* Thumbnail */}
      <div
        className="flex items-center justify-center mb-4"
        style={{
          height: 90,
          borderRadius: 16,
          background: GRADIENTS.purpleSky,
          boxShadow: "0 8px 20px rgba(192,132,252,0.35)",
        }}
      >
        <Award size={30} color="#fff" />
      </div>

      <div
        className="inline-flex items-center gap-1 self-start text-[11px] font-bold px-2.5 py-1 rounded-full mb-2.5"
        style={{ color: statusInfo.color, background: statusInfo.bg }}
      >
        <StatusIcon size={11} /> {certificate.status}
      </div>

      <h3 className="text-sm font-bold" style={{ color: COLORS.textDark }}>
        {certificate.courseName}
      </h3>
      <p className="text-xs mt-0.5" style={{ color: COLORS.textMid }}>
        {certificate.careerPath} • Issued {issued}
      </p>
      <p className="text-[11px] mt-1" style={{ color: COLORS.textLight }}>
        ID: {certificate.certificateId} • Score {certificate.score}%
      </p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {certificate.skills.slice(0, 3).map((s) => (
          <span
            key={s}
            className="text-[10px] px-2 py-1 rounded-full font-medium"
            style={{ background: "rgba(255,255,255,0.5)", color: "#8B5CF6" }}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between mt-5">
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onView(certificate)}
          className="flex items-center gap-1.5 text-xs font-semibold"
          style={{
            padding: "9px 18px",
            borderRadius: 9999,
            color: "#fff",
            border: "none",
            background: GRADIENTS.purplePink,
            cursor: "pointer",
          }}
        >
          <Eye size={13} /> View Certificate
        </motion.button>

        <div className="flex items-center gap-1.5">
          <IconButton icon={Download} label="Download PDF" onClick={() => onDownload(certificate)} />
          <IconButton icon={Share2} label="Share on LinkedIn" onClick={() => onShareLinkedIn(certificate)} />
          <IconButton icon={Link2} label="Copy Verification Link" onClick={() => onCopyLink(certificate)} />
          {certificate.status !== "Verified" && (
            <IconButton icon={ShieldCheck} label="Verify Certificate" onClick={() => onVerify(certificate)} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
