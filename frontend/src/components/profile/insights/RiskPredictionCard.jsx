import { motion } from "framer-motion";

const LEVELS = {
  low: { label: "Low Risk", color: "#16A34A", dot: "🟢" },
  medium: { label: "Medium Risk", color: "#D4A017", dot: "🟡" },
  high: { label: "High Risk", color: "#DC2626", dot: "🔴" },
};

export default function RiskPredictionCard({ risk, theme }) {
  const level = LEVELS[risk.level] || LEVELS.low;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="p-4"
      style={{ borderRadius: 18, background: theme.cardBg, border: `1px solid ${theme.border}` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span>{level.dot}</span>
        <span className="text-sm font-bold" style={{ color: level.color }}>
          {level.label}
        </span>
      </div>
      <p className="text-[11px] font-semibold mb-0.5" style={{ color: theme.textMid }}>
        Reason
      </p>
      <p className="text-xs mb-2.5" style={{ color: theme.textDark }}>
        {risk.reason}
      </p>
      <p className="text-[11px] font-semibold mb-0.5" style={{ color: theme.textMid }}>
        AI Recommendation
      </p>
      <p className="text-xs" style={{ color: theme.textDark }}>
        {risk.recommendation}
      </p>
    </motion.div>
  );
}
