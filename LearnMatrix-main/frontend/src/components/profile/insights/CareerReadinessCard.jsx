import { motion } from "framer-motion";
import { Briefcase } from "lucide-react";

export default function CareerReadinessCard({ readiness, theme }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="p-4"
      style={{ borderRadius: 18, background: theme.cardBg, border: `1px solid ${theme.border}` }}
    >
      <div className="flex items-center gap-2 text-xs font-bold mb-3" style={{ color: theme.textMid }}>
        <Briefcase size={14} color="#8B5CF6" /> {readiness.careerName} Readiness
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: theme.track }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${readiness.percent}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #8B5CF6, #2563EB)" }}
          />
        </div>
        <span className="text-sm font-bold" style={{ color: theme.textDark }}>
          {readiness.percent}%
        </span>
      </div>
      <p className="text-[11px]" style={{ color: theme.textLight }}>
        Suggested Role
      </p>
      <p className="text-xs font-semibold mb-2" style={{ color: theme.textDark }}>
        {readiness.suggestedRole}
      </p>
      <p className="text-[11px]" style={{ color: theme.textLight }}>
        Next Requirement
      </p>
      <p className="text-xs font-semibold" style={{ color: theme.textDark }}>
        {readiness.nextRequirement}
      </p>
    </motion.div>
  );
}
