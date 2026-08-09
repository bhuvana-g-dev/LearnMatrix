import { motion } from "framer-motion";
import { BarChart3, Flame, Zap, Clock, Trophy, BookCheck } from "lucide-react";
import SectionCard from "./SectionCard";
import { COLORS } from "../../constants/theme";

function StatCard({ icon: Icon, label, value, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ y: -3 }}
      className="p-4 flex flex-col items-center text-center"
      style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.32)" }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5"
        style={{ background: "linear-gradient(135deg, rgba(192,132,252,0.35), rgba(125,211,252,0.3))" }}
      >
        <Icon size={16} color="#8B5CF6" />
      </div>
      <p className="text-lg font-bold" style={{ color: COLORS.textDark }}>{value}</p>
      <p className="text-[11px] mt-0.5" style={{ color: COLORS.textMid }}>{label}</p>
    </motion.div>
  );
}

/**
 * SECTION 6 — Learning Statistics.
 * Values come from `statistics` (learningStatistics.js via
 * statisticsService.js).
 */
export default function LearningStatisticsSection({ statistics }) {
  if (!statistics) return null;

  const stats = [
    { icon: BookCheck, label: "Completed Courses", value: statistics.completedCourses },
    { icon: Trophy, label: "Completed Skills", value: statistics.completedSkills },
    { icon: Zap, label: "Current XP", value: statistics.currentXP },
    { icon: Flame, label: "Learning Streak", value: `${statistics.learningStreak} days` },
    { icon: Clock, label: "Total Hours", value: `${statistics.totalLearningHours}h` },
    { icon: BarChart3, label: "Avg Quiz Score", value: `${statistics.averageQuizScore}%` },
  ];

  return (
    <SectionCard icon={BarChart3} title="Learning Statistics" delay={0.25}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 0.04} />
        ))}
      </div>
    </SectionCard>
  );
}
