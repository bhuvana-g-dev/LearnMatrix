import { motion } from "framer-motion";
import { Users } from "lucide-react";

export default function CommunityRankingCard({ ranking, theme }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="p-4"
      style={{ borderRadius: 18, background: theme.cardBg, border: `1px solid ${theme.border}` }}
    >
      <div className="flex items-center gap-2 text-xs font-bold mb-3" style={{ color: theme.textMid }}>
        <Users size={14} color="#E4568A" /> Community Ranking
      </div>
      <p className="text-lg font-bold" style={{ color: theme.textDark }}>
        Top {ranking.percentile}%
      </p>
      <p className="text-xs mb-3" style={{ color: theme.textLight }}>
        Among {ranking.cohort}
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-bold" style={{ color: theme.textDark }}>
            {ranking.quizzesCompleted}
          </p>
          <p className="text-[10px]" style={{ color: theme.textLight }}>
            Quizzes
          </p>
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: theme.textDark }}>
            {ranking.practiceLabs}
          </p>
          <p className="text-[10px]" style={{ color: theme.textLight }}>
            Practice Labs
          </p>
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: theme.textDark }}>
            {ranking.streakDays}d
          </p>
          <p className="text-[10px]" style={{ color: theme.textLight }}>
            Streak
          </p>
        </div>
      </div>
    </motion.div>
  );
}
