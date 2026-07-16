import { motion } from "framer-motion";
import { Award, ShieldCheck, GraduationCap, Sparkles } from "lucide-react";
import { COLORS } from "../../../constants/theme";

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

export default function CertificateStatsCards({ stats }) {
  const latestLabel = stats.latestDate
    ? new Date(stats.latestDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "—";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-5">
      <StatCard icon={Award} label="Total Certificates" value={stats.total} delay={0} />
      <StatCard icon={ShieldCheck} label="Verified Certificates" value={stats.verified} delay={0.04} />
      <StatCard icon={GraduationCap} label="Courses Completed" value={stats.coursesCompleted} delay={0.08} />
      <StatCard icon={Sparkles} label={`Latest • ${latestLabel}`} value={stats.latestTitle} delay={0.12} />
    </div>
  );
}
