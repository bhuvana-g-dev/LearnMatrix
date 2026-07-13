import { motion } from "framer-motion";
import { Search, Pencil, EyeOff, Eye } from "lucide-react";
import { COLORS, GLASS_CARD } from "../../constants/theme";
import { DIFFICULTIES, STATUSES } from "../../constants/adminQuestionOptions";

const inputStyle = {
  borderRadius: 12,
  background: "rgba(255,255,255,0.55)",
  border: `1px solid ${COLORS.border}`,
  padding: "9px 12px",
  fontSize: 13,
  color: COLORS.textDark,
  outline: "none",
};

const badgeStyle = (status) => ({
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 10px",
  borderRadius: 9999,
  background: status === "Active" ? "rgba(52,199,89,0.15)" : "rgba(228,86,138,0.15)",
  color: status === "Active" ? "#1F9254" : "#E4568A",
});

export default function QuestionTable({
  questions,
  loading,
  error,
  filters,
  onFilterChange,
  onClearFilters,
  onEdit,
  onPreview,
  onDeactivate,
  onReactivate,
}) {
  return (
    <div className="p-5 sm:p-7" style={{ ...GLASS_CARD, borderRadius: 24 }}>
      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.textLight }} />
          <input
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            placeholder="Search by ID, question, skill..."
            style={{ ...inputStyle, width: "100%", paddingLeft: 34 }}
          />
        </div>

        <input
          value={filters.skill}
          onChange={(e) => onFilterChange("skill", e.target.value)}
          placeholder="Filter skill"
          style={{ ...inputStyle, width: 130 }}
        />
        <select value={filters.difficulty} onChange={(e) => onFilterChange("difficulty", e.target.value)} style={inputStyle}>
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => onFilterChange("status", e.target.value)} style={inputStyle}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={onClearFilters}
          className="text-xs font-semibold"
          style={{ padding: "9px 14px", borderRadius: 12, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textMid, cursor: "pointer" }}
        >
          Clear
        </button>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: "#E4568A" }}>{error}</p>}
      {loading && <p className="text-sm" style={{ color: COLORS.textMid }}>Loading questions...</p>}

      {!loading && questions.length === 0 && !error && (
        <p className="text-sm" style={{ color: COLORS.textMid }}>No questions found. Try adjusting filters or add a new question.</p>
      )}

      {!loading && questions.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {["ID", "Skill", "Difficulty", "Type", "Question", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-bold" style={{ color: COLORS.textMid }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <motion.tr
                  key={q.QuestionID}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ borderBottom: `1px solid rgba(217,196,245,0.5)` }}
                >
                  <td className="py-2.5 px-3 font-semibold" style={{ color: COLORS.textDark }}>{q.QuestionID}</td>
                  <td className="py-2.5 px-3" style={{ color: COLORS.textMid }}>{q.Skill}</td>
                  <td className="py-2.5 px-3" style={{ color: COLORS.textMid }}>{q.Difficulty}</td>
                  <td className="py-2.5 px-3" style={{ color: COLORS.textMid }}>{q.QuestionType}</td>
                  <td className="py-2.5 px-3 max-w-xs truncate" style={{ color: COLORS.textDark }} title={q.Question}>
                    {q.Question}
                  </td>
                  <td className="py-2.5 px-3">
                    <span style={badgeStyle(q.Status)}>{q.Status}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <button title="Preview" onClick={() => onPreview(q)} style={iconBtnStyle}>
                        <Eye size={14} color={COLORS.textMid} />
                      </button>
                      <button title="Edit" onClick={() => onEdit(q)} style={iconBtnStyle}>
                        <Pencil size={14} color={COLORS.purple} />
                      </button>
                      {q.Status === "Active" ? (
                        <button title="Deactivate" onClick={() => onDeactivate(q.QuestionID)} style={iconBtnStyle}>
                          <EyeOff size={14} color="#E4568A" />
                        </button>
                      ) : (
                        <button title="Reactivate" onClick={() => onReactivate(q.QuestionID)} style={iconBtnStyle}>
                          <Eye size={14} color="#1F9254" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const iconBtnStyle = {
  background: "rgba(255,255,255,0.6)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 9,
  padding: 6,
  cursor: "pointer",
  display: "flex",
};
