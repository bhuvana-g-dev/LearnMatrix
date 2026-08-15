import { Activity } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";
import DashCard, { DashCardTitle } from "./DashCard";

/**
 * Shows this week's real activity — one bar per day, filled if the
 * student opened the app that day (services/activity_repository.py).
 * Deliberately NOT a fake "hours studied" chart — that data isn't
 * tracked anywhere in the backend, so it isn't shown as if it were.
 */
export default function WeeklyActivityCard({ weekActivity }) {
  const activeCount = weekActivity.filter((d) => d.active).length;

  return (
    <DashCard>
      <DashCardTitle
        icon={Activity}
        iconColor={DASH.accentTeal}
        action={
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: DASH.accentTealSoft, color: DASH.accentTeal }}
          >
            {activeCount} of 7 days
          </span>
        }
      >
        Weekly Learning Activity
      </DashCardTitle>

      <div className="flex items-end justify-between gap-2 h-24">
        {weekActivity.map((d) => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
            <div
              className="w-full rounded-md"
              style={{
                height: d.active ? "100%" : "10%",
                background: d.active ? DASH.accentTeal : DASH.trackBg,
                opacity: d.isFuture ? 0.35 : 1,
                transition: "height 0.3s ease",
              }}
            />
            <span
              className="text-[10px] font-semibold"
              style={{ color: d.isToday ? DASH.accentTeal : DASH.textLight }}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </DashCard>
  );
}
