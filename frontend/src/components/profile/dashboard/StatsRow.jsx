import { BookOpen, Layers, CalendarCheck2, Flame } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";
import DashCard from "./DashCard";

function ProgressRing({ percent }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, percent)) / 100) * c;
  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke={DASH.trackBg} strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={DASH.accentTeal}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: DASH.textPrimary }}>
        {Math.round(percent)}%
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix, icon, iconColor, iconBg, caption }) {
  return (
    <DashCard className="flex flex-col items-center text-center gap-2">
      {icon && (
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center mb-1"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      )}
      <p className="text-[11px] font-semibold" style={{ color: DASH.textLight }}>
        {label}
      </p>
      <p className="text-xl font-bold" style={{ color: DASH.textPrimary }}>
        {value}
        {suffix && (
          <span className="text-xs font-semibold ml-1" style={{ color: DASH.textLight }}>
            {suffix}
          </span>
        )}
      </p>
      {caption && (
        <p className="text-[11px]" style={{ color: DASH.textLight }}>
          {caption}
        </p>
      )}
    </DashCard>
  );
}

export default function StatsRow({ stats }) {
  const { overallProgressPercent, skillsMastered, totalSkills, topicsInProgress, activeDaysCount, streak } = stats;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <DashCard className="flex flex-col items-center text-center gap-2">
        <p className="text-[11px] font-semibold" style={{ color: DASH.textLight }}>
          Overall Progress
        </p>
        <ProgressRing percent={overallProgressPercent} />
        <p className="text-[11px]" style={{ color: DASH.accentTeal }}>
          {overallProgressPercent > 0 ? "Keep it up!" : "Take your assessment to start"}
        </p>
      </DashCard>

      <StatCard
        label="Skills Mastered"
        value={skillsMastered}
        suffix={totalSkills ? `/ ${totalSkills}` : undefined}
        icon={<BookOpen size={18} />}
        iconColor={DASH.accentPurple}
        iconBg={DASH.accentPurpleSoft}
      />

      <StatCard
        label="Topics In Progress"
        value={topicsInProgress}
        icon={<Layers size={18} />}
        iconColor={DASH.accentPink}
        iconBg={DASH.accentPinkSoft}
        caption="Tracked by revision"
      />

      <StatCard
        label="Active Days"
        value={activeDaysCount}
        icon={<CalendarCheck2 size={18} />}
        iconColor={DASH.accentTeal}
        iconBg={DASH.accentTealSoft}
      />

      <StatCard
        label="Current Streak"
        value={streak}
        suffix="Days"
        icon={<Flame size={18} />}
        iconColor={DASH.accentOrange}
        iconBg={DASH.accentOrangeSoft}
      />
    </div>
  );
}
