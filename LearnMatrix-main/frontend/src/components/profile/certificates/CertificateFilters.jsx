import { Search } from "lucide-react";
import { COLORS, GRADIENTS } from "../../../constants/theme";

const FILTERS = ["All", "Verified", "Pending", "Completed"];
const SORTS = ["Latest", "Oldest", "Highest Score"];

export default function CertificateFilters({ search, onSearch, statusFilter, onStatusFilter, sortBy, onSortBy }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
      <div
        className="flex items-center gap-2 px-4 py-2.5 flex-1"
        style={{ borderRadius: 9999, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.35)" }}
      >
        <Search size={15} color={COLORS.textLight} />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by course, career path, or certificate ID..."
          className="flex-1 text-sm bg-transparent outline-none"
          style={{ color: COLORS.textDark }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const isActive = statusFilter === f;
          return (
            <button
              key={f}
              onClick={() => onStatusFilter(f)}
              className="text-xs font-semibold px-3 py-2"
              style={{
                borderRadius: 9999,
                color: isActive ? "#fff" : COLORS.textMid,
                background: isActive ? GRADIENTS.purplePink : "rgba(255,255,255,0.35)",
                border: isActive ? "none" : "1px solid rgba(255,255,255,0.6)",
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      <select
        value={sortBy}
        onChange={(e) => onSortBy(e.target.value)}
        className="text-xs font-semibold px-3 py-2.5 outline-none"
        style={{
          borderRadius: 9999,
          color: COLORS.textDark,
          background: "rgba(255,255,255,0.35)",
          border: "1px solid rgba(255,255,255,0.6)",
          cursor: "pointer",
        }}
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            Sort: {s}
          </option>
        ))}
      </select>
    </div>
  );
}
