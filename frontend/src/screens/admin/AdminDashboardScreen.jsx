import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Zap, Gauge, Turtle, GitBranch, Activity, ArrowRight } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import { fetchDashboardSummary } from "../../services/adminLearnerService";

const TYPE_COLORS = {
  Fast: "#16A34A",
  Moderate: "#D4A017",
  Slow: "#DC2626",
};

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

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * AdminDashboardScreen — the Admin Panel's front door, showing the real
 * adaptive-learning picture (backend: services/learner_intelligence_service.get_dashboard_summary,
 * reading the real topic_quiz_progress / topic_quiz_attempts collections)
 * instead of Question Bank counts (that feature has been removed —
 * topic quizzes are AI-generated only now). Nothing here is hardcoded —
 * every number traces to a real Firestore doc, and shows 0 honestly
 * when there's no data yet rather than a placeholder.
 */
export default function AdminDashboardScreen({ onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchDashboardSummary()
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "Couldn't load dashboard data.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const distribution = summary?.distribution || { Fast: 0, Moderate: 0, Slow: 0 };

  return (
    <div className="px-4 sm:px-8 pt-8 pb-12">
      <h1 className="text-2xl font-bold" style={{ color: COLORS.textDark }}>Admin Dashboard</h1>
      <p className="text-sm mt-1 mb-7" style={{ color: COLORS.textMid }}>
        Live adaptive-learning intelligence — real classifications from real attempts.
      </p>

      {error ? (
        <p className="text-sm p-6" style={{ ...GLASS_CARD, borderRadius: 20, color: "#DC2626" }}>{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatCard
              icon={Users}
              label="Total Students"
              value={loading ? "…" : summary.totalStudents}
              tint={GRADIENTS.purpleSky}
            />
            <StatCard
              icon={Zap}
              label="Fast Learners"
              value={loading ? "…" : distribution.Fast}
              tint={`linear-gradient(135deg, ${TYPE_COLORS.Fast}, #7DD3FC)`}
            />
            <StatCard
              icon={Gauge}
              label="Moderate Learners"
              value={loading ? "…" : distribution.Moderate}
              tint={`linear-gradient(135deg, ${TYPE_COLORS.Moderate}, #FBBF24)`}
            />
            <StatCard
              icon={Turtle}
              label="Slow Learners"
              value={loading ? "…" : distribution.Slow}
              tint={`linear-gradient(135deg, ${TYPE_COLORS.Slow}, #F0ABFC)`}
            />
            <StatCard
              icon={GitBranch}
              label="Classification Changes"
              value={loading ? "…" : summary.classificationChanges}
              tint={GRADIENTS.purplePink}
            />
          </div>

          <div style={{ ...GLASS_CARD, borderRadius: 20, overflow: "hidden" }} className="mb-8">
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <Activity size={16} color={COLORS.textMid} />
              <h2 className="text-sm font-semibold" style={{ color: COLORS.textDark }}>Recent Adaptive Activity</h2>
            </div>
            {loading ? (
              <p className="text-sm p-6" style={{ color: COLORS.textMid }}>Loading recent activity…</p>
            ) : !summary.recentActivity?.length ? (
              <p className="text-sm p-6" style={{ color: COLORS.textMid }}>
                No quiz attempts recorded yet — activity will show up here as students take topic quizzes.
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: COLORS.border }}>
                {summary.recentActivity.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className="font-semibold" style={{ color: COLORS.textDark }}>{a.email}</span>
                    <span style={{ color: COLORS.textMid }}>{a.skill} / {a.topic}</span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5"
                      style={{
                        borderRadius: 9999,
                        color: TYPE_COLORS[a.classification] || COLORS.textMid,
                        background: `${TYPE_COLORS[a.classification] || COLORS.textMid}1A`,
                      }}
                    >
                      {a.classification || "—"}
                    </span>
                    <span style={{ color: COLORS.textMid }}>
                      {a.scorePercent != null ? `${a.scorePercent}%` : "—"} · attempt #{a.attemptNumber}
                    </span>
                    <span className="ml-auto text-xs" style={{ color: COLORS.textLight }}>
                      {formatDate(a.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <motion.button
        onClick={() => onNavigate("learner-intelligence")}
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
        Explore Learner Intelligence <ArrowRight size={15} />
      </motion.button>
    </div>
  );
}
