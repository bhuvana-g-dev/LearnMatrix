import { Activity, Check } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";
import DashCard, { DashCardTitle } from "./DashCard";

/**
 * Shows this week's real activity — one cell per day, filled/checked if
 * the student opened the app that day (services/activity_repository.py).
 * Deliberately NOT a fake "hours studied" chart — that data isn't
 * tracked anywhere in the backend, so it isn't shown as if it were.
 *
 * Calendar-cell layout (not bar-height) so a week with few/no active
 * days still reads as "a calendar with some days checked off" instead
 * of an empty box — today also gets its own ring so it's obvious at a
 * glance where "now" sits in the week, active or not.
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

      <div className="grid grid-cols-7 gap-2">
        {weekActivity.map((d) => (
          <div key={d.label} className="flex flex-col items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wide"
              style={{ color: d.isToday ? DASH.accentTeal : DASH.textLight }}
            >
              {d.label}
            </span>
            <div
              className="w-full aspect-square rounded-xl flex items-center justify-center"
              style={{
                background: d.active ? DASH.accentTeal : DASH.card,
                border: d.isToday
                  ? `2px solid ${DASH.accentTeal}`
                  : `1.5px ${d.isFuture ? "dashed" : "solid"} ${DASH.border}`,
                opacity: d.isFuture ? 0.5 : 1,
              }}
            >
              {d.active ? (
                <Check size={16} strokeWidth={3} color="#fff" />
              ) : (
                <span
                  className="block rounded-full"
                  style={{ width: 6, height: 6, background: DASH.border }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </DashCard>
  );
}
