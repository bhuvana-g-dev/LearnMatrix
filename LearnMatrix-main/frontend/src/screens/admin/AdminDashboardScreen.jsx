import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ListChecks, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import { fetchQuestions } from "../../services/adminQuestionService";

function StatCard({ icon: Icon, label, value, tint }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 flex items-center gap-4"
      style={{ ...GLASS_CARD, borderRadius: 20 }}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: tint }}
      >
        <Icon size={18} color="#fff" />
      </div>
      <div>
        <p className="text-xl font-bold" style={{ color: COLORS.textDark }}>{value}</p>
        <p className="text-xs" style={{ color: COLORS.textMid }}>{label}</p>
      </div>
    </motion.div>
  );
}

export default function AdminDashboardScreen({ onNavigate }) {
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchQuestions({})
      .then((questions) => {
        if (!active) return;
        const total = questions.length;
        const activeCount = questions.filter((q) => q.Status === "Active").length;
        setStats({ total, active: activeCount, inactive: total - activeCount });
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="px-4 sm:px-8 pt-8 pb-12">
      <h1 className="text-2xl font-bold" style={{ color: COLORS.textDark }}>Admin Dashboard</h1>
      <p className="text-sm mt-1 mb-7" style={{ color: COLORS.textMid }}>
        Overview of the LearnMatrix Question Bank.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard icon={ListChecks} label="Total Questions" value={loading ? "…" : stats.total} tint={GRADIENTS.purpleSky} />
        <StatCard icon={CheckCircle2} label="Active" value={loading ? "…" : stats.active} tint="linear-gradient(135deg,#34C759,#7DD3FC)" />
        <StatCard icon={XCircle} label="Inactive (Soft-Deleted)" value={loading ? "…" : stats.inactive} tint="linear-gradient(135deg,#E4568A,#F0ABFC)" />
      </div>

      <motion.button
        onClick={() => onNavigate("question-bank")}
        whileHover={{ y: -2 }}
        className="flex items-center gap-2 font-semibold text-sm"
        style={{
          padding: "12px 22px",
          borderRadius: 9999,
          background: GRADIENTS.purplePink,
          color: "#fff",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
        }}
      >
        Go to Question Bank <ArrowRight size={15} />
      </motion.button>
    </div>
  );
}
