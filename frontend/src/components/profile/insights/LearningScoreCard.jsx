import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
export default function LearningScoreCard({ data, theme }) {
  const { score, delta, trend, caption } = data;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circumference - (pct / 100) * circumference;
  const positive = trend !== "down";

  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="p-4 flex items-center gap-4"
      style={{ borderRadius: 18, background: theme.cardBg, border: `1px solid ${theme.border}` }}
    >
      <div className="relative flex-shrink-0" style={{ width: 92, height: 92 }}>
        <svg width="92" height="92" viewBox="0 0 92 92">
          <circle cx="46" cy="46" r={radius} fill="none" stroke={theme.track} strokeWidth="7" />
          <motion.circle
            cx="46"
            cy="46"
            r={radius}
            fill="none"
            stroke="url(#learningScoreGradient)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
            transform="rotate(-90 46 46)"
          />
          <defs>
            <linearGradient id="learningScoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D4A017" />
              <stop offset="100%" stopColor="#16A34A" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold" style={{ color: theme.textDark }}>
            {score}
          </span>
          <span className="text-[10px]" style={{ color: theme.textLight }}>
            / 100
          </span>
        </div>
      </div>
      <div>
        <p className="text-xs font-bold mb-1.5" style={{ color: theme.textMid }}>
          AI Learning Score
        </p>
        {caption ? (
          <p className="text-xs" style={{ color: theme.textLight }}>{caption}</p>
        ) : (
          <div
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: positive ? "#16A34A" : "#DC2626" }}
          >
            {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {positive ? "+" : ""}
            {delta} this week
          </div>
        )}
      </div>
    </motion.div>
  );
}
