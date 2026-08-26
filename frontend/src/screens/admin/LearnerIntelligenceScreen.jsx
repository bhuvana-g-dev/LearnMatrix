import { useState, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, RotateCcw, Loader2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import { fetchLearners, fetchLearnerProfile } from "../../services/adminLearnerService";

const LEARNER_TYPES = ["Fast", "Moderate", "Slow"];

const TYPE_COLORS = {
  Fast: "#16A34A",
  Moderate: "#D4A017",
  Slow: "#DC2626",
};

function TypeBadge({ type }) {
  if (!type) return <span style={{ color: COLORS.textLight }}>—</span>;
  const color = TYPE_COLORS[type] || COLORS.textMid;
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1"
      style={{ borderRadius: 9999, color, background: `${color}1A`, border: `1px solid ${color}40` }}
    >
      {type}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

const inputStyle = {
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.6)",
  color: COLORS.textDark,
  padding: "9px 12px",
  fontSize: 13,
  outline: "none",
};

/**
 * LearnerIntelligenceScreen — real skill-wise classification data
 * (backend: services/learner_intelligence_service.py, reading the
 * EXISTING topic_quiz_progress / topic_quiz_attempts collections).
 * Search/filter by Email, Skill, Topic, Learner Type, then expand any
 * row to see WHY that skill was classified Fast/Moderate/Slow — the
 * actual services/learner_classifier.py output for that attempt, not a
 * re-derived explanation.
 */
export default function LearnerIntelligenceScreen() {
  const [filters, setFilters] = useState({ email: "", skill: "", topic: "", learnerType: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const [expandedRowKey, setExpandedRowKey] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const runSearch = useCallback(async (activeFilters) => {
    setLoading(true);
    setError("");
    setExpandedRowKey(null);
    setProfile(null);
    try {
      const data = await fetchLearners(activeFilters);
      setRows(data || []);
      setSearched(true);
    } catch (err) {
      setError(err.message || "Couldn't load learner intelligence data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    runSearch(filters);
  };

  const handleReset = () => {
    const cleared = { email: "", skill: "", topic: "", learnerType: "" };
    setFilters(cleared);
    setRows([]);
    setSearched(false);
    setError("");
  };

  const toggleRow = async (row, rowKey) => {
    if (expandedRowKey === rowKey) {
      setExpandedRowKey(null);
      return;
    }
    setExpandedRowKey(rowKey);
    setProfile(null);
    setProfileError("");
    setProfileLoading(true);
    try {
      const data = await fetchLearnerProfile(row.email);
      setProfile(data);
    } catch (err) {
      setProfileError(err.message || "Couldn't load this learner's profile.");
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 pt-8 pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: COLORS.textDark }}>Learner Intelligence</h1>
        <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
          Skill-wise learner classification, accuracy, response time, and reinforcement needs — search by
          email, skill, topic, or learner type.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex flex-wrap items-end gap-3 mb-6"
        style={{ ...GLASS_CARD, borderRadius: 20, padding: 16 }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: COLORS.textLight }}>Email</label>
          <input
            type="text"
            placeholder="student@example.com"
            value={filters.email}
            onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))}
            style={{ ...inputStyle, width: 220 }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: COLORS.textLight }}>Skill</label>
          <input
            type="text"
            placeholder="e.g. SQL"
            value={filters.skill}
            onChange={(e) => setFilters((f) => ({ ...f, skill: e.target.value }))}
            style={{ ...inputStyle, width: 140 }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: COLORS.textLight }}>Topic</label>
          <input
            type="text"
            placeholder="e.g. Joins"
            value={filters.topic}
            onChange={(e) => setFilters((f) => ({ ...f, topic: e.target.value }))}
            style={{ ...inputStyle, width: 140 }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold" style={{ color: COLORS.textLight }}>Learner Type</label>
          <select
            value={filters.learnerType}
            onChange={(e) => setFilters((f) => ({ ...f, learnerType: e.target.value }))}
            style={{ ...inputStyle, width: 150 }}
          >
            <option value="">All</option>
            {LEARNER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ y: -2 }}
            className="flex items-center gap-2 text-sm font-semibold"
            style={{
              padding: "10px 18px", borderRadius: 9999, background: GRADIENTS.purplePink,
              color: "#fff", border: "none", cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1, boxShadow: "0 8px 20px rgba(212,160,23,0.35)",
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Search
          </motion.button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5"
            style={{ borderRadius: 9999, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.5)", color: COLORS.textMid, cursor: "pointer" }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </form>

      <div style={{ ...GLASS_CARD, borderRadius: 20, overflow: "hidden" }}>
        {loading ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>Loading learner intelligence…</p>
        ) : error ? (
          <p className="text-sm p-6" style={{ color: "#DC2626" }}>{error}</p>
        ) : !searched ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>
            Set filters above (or leave blank for everyone) and hit Search.
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>
            No learner records match those filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  {[
                    "Email", "Skill", "Topic", "Learner Type", "Accuracy", "Last Score",
                    "Avg Response Time", "Improvement", "Attempts", "Next Review",
                  ].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap" style={{ color: COLORS.textLight }}>
                      {h}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const key = `${r.uid}__${r.skill}__${r.topic}`;
                  const isExpanded = expandedRowKey === key;
                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => toggleRow(r, key)}
                        style={{ borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                      >
                        <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: COLORS.textDark }}>
                          <span className="flex items-center gap-1.5">
                            {r.needsReinforcement && (
                              <AlertTriangle size={13} color="#DC2626" title="Needs reinforcement — repeated Slow attempts" />
                            )}
                            {r.email}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{r.skill}</td>
                        <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{r.topic}</td>
                        <td className="px-4 py-3"><TypeBadge type={r.learnerType} /></td>
                        <td className="px-4 py-3" style={{ color: COLORS.textMid }}>
                          {r.accuracyPercent != null ? `${r.accuracyPercent}%` : "—"}
                        </td>
                        <td className="px-4 py-3" style={{ color: COLORS.textMid }}>
                          {r.lastScorePercent != null ? `${r.lastScorePercent}%` : "—"}
                        </td>
                        <td className="px-4 py-3" style={{ color: COLORS.textMid }}>
                          {r.avgResponseTimeSeconds != null ? `${r.avgResponseTimeSeconds}s` : "—"}
                        </td>
                        <td className="px-4 py-3" style={{ color: r.improvement > 0 ? "#16A34A" : r.improvement < 0 ? "#DC2626" : COLORS.textMid }}>
                          {r.improvement != null ? `${r.improvement > 0 ? "+" : ""}${r.improvement}%` : "—"}
                        </td>
                        <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{r.attemptCount}</td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: COLORS.textMid }}>{formatDate(r.nextReviewDate)}</td>
                        <td className="px-4 py-3" style={{ color: COLORS.textLight }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                      </tr>
                      <AnimatePresence>
                        {isExpanded && (
                          <tr key={`${key}-detail`}>
                            <td colSpan={11} style={{ padding: 0, borderBottom: `1px solid ${COLORS.border}` }}>
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{ overflow: "hidden" }}
                              >
                                <div className="px-6 py-4" style={{ background: "rgba(212,160,23,0.06)" }}>
                                  {profileLoading ? (
                                    <p className="text-xs" style={{ color: COLORS.textMid }}>Loading learner profile…</p>
                                  ) : profileError ? (
                                    <p className="text-xs" style={{ color: "#DC2626" }}>{profileError}</p>
                                  ) : profile ? (
                                    <div>
                                      <div className="flex items-center gap-3 mb-3">
                                        <span className="text-xs font-semibold" style={{ color: COLORS.textLight }}>
                                          Overall learner type:
                                        </span>
                                        <TypeBadge type={profile.overallLearnerType} />
                                        {profile.weakTopics?.length > 0 && (
                                          <span className="text-xs" style={{ color: COLORS.textMid }}>
                                            {profile.weakTopics.length} weak topic{profile.weakTopics.length > 1 ? "s" : ""}: {" "}
                                            {profile.weakTopics.map((w) => `${w.skill}/${w.topic}`).join(", ")}
                                          </span>
                                        )}
                                      </div>
                                      <div className="grid gap-2">
                                        {profile.skills.map((s) => (
                                          <div
                                            key={`${s.skill}-${s.topic}`}
                                            className="flex flex-wrap items-center gap-2 text-xs px-3 py-2"
                                            style={{ borderRadius: 10, background: "rgba(255,255,255,0.6)", border: `1px solid ${COLORS.border}` }}
                                          >
                                            <span className="font-semibold" style={{ color: COLORS.textDark }}>
                                              {s.skill} / {s.topic}
                                            </span>
                                            <TypeBadge type={s.learnerType} />
                                            <span style={{ color: COLORS.textMid }}>{s.why}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
