import { DASH } from "../../../constants/profileDashboardTheme";

// Shared card shell every dashboard section sits inside.
export default function DashCard({ children, className = "", style = {} }) {
  return (
    <div
      className={`p-5 sm:p-6 ${className}`}
      style={{
        background: DASH.card,
        border: `1px solid ${DASH.border}`,
        borderRadius: 18,
        boxShadow: "0 4px 24px rgba(13,27,61,0.08)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function DashCardTitle({ icon: Icon, iconColor, children, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} color={iconColor || DASH.accentPurple} />}
        <h3 className="text-sm font-bold" style={{ color: DASH.textPrimary }}>
          {children}
        </h3>
      </div>
      {action}
    </div>
  );
}

// One labeled progress bar — used for both "Current Career Path" and
// each row in "Skill Progress".
export function ProgressRow({ label, icon, percent, color = DASH.accentPurple, size = "md" }) {
  const height = size === "sm" ? 6 : 8;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: DASH.textMid }}>
          {icon}
          {label}
        </span>
        <span className="text-xs font-bold" style={{ color: DASH.textPrimary }}>
          {Math.round(percent)}%
        </span>
      </div>
      <div style={{ height, borderRadius: 999, background: DASH.trackBg, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.max(0, Math.min(100, percent))}%`,
            borderRadius: 999,
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
