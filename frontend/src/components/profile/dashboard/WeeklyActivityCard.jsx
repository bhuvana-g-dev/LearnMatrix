import { useMemo } from "react";
import { Flame, Sparkles } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";
import DashCard, { DashCardTitle } from "./DashCard";

const QUOTES = [
  "Small steps every day lead to big results!",
  "Consistency beats intensity — show up today.",
  "A streak is just one more day than yesterday.",
  "Progress you can't see is still progress.",
];

/**
 * Shows this week's real activity — one cell per day, filled/checked if
 * the student opened the app that day (services/activity_repository.py).
 * Deliberately NOT a fake "hours studied" chart — that data isn't
 * tracked anywhere in the backend, so it isn't shown as if it were.
 *
 * Streak-card layout (flame per day + date + Done!/Today pill) so a
 * week with few/no active days still reads as "a calendar with some
 * days checked off" instead of an empty box — today also gets its own
 * highlighted pill so it's obvious at a glance where "now" sits in the
 * week, active or not.
 */
export default function WeeklyActivityCard({ weekActivity }) {
  const activeCount = weekActivity.filter((d) => d.active).length;

  // Stable per-render pick — changes when the streak count changes, not on every re-render.
  const quote = useMemo(() => QUOTES[activeCount % QUOTES.length], [activeCount]);

  return (
    <DashCard>
      <DashCardTitle
        icon={Flame}
        iconColor={DASH.accentPurple}
        action={
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ background: DASH.accentPurpleSoft, color: DASH.accentPurple }}
          >
            {activeCount} of 7 days
            <Flame size={12} color={DASH.accentPurple} fill={DASH.accentPurple} />
          </span>
        }
      >
        Weekly Learning Activity
      </DashCardTitle>
      <p className="text-xs -mt-3 mb-4" style={{ color: DASH.textLight }}>
        Learn a little every day
      </p>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekActivity.map((d) => (
          <div key={d.label} className="flex flex-col items-center gap-1.5">
            <span
              className="text-[10px] font-bold uppercase tracking-wide"
              style={{ color: d.isToday ? DASH.accentPurple : DASH.textLight }}
            >
              {d.label}
            </span>
            <span className="text-[9px] font-medium hidden sm:block" style={{ color: DASH.textLight }}>
              {d.dateLabel}
            </span>

            <div
              className="w-full aspect-square rounded-xl flex items-center justify-center"
              style={{
                background: d.active ? DASH.accentPurpleSoft : DASH.card,
                border: d.isToday
                  ? `2px solid ${DASH.accentPurple}`
                  : `1.5px ${d.isFuture ? "dashed" : "solid"} ${DASH.border}`,
                opacity: d.isFuture ? 0.5 : 1,
              }}
            >
              <Flame
                size={16}
                color={d.active ? DASH.accentPurple : DASH.border}
                fill={d.active ? DASH.accentPurple : "none"}
                strokeWidth={1.5}
              />
            </div>

            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
              style={{
                background: d.active ? DASH.accentPurpleSoft : d.isToday ? DASH.accentPurple : "transparent",
                color: d.active ? DASH.accentPurple : d.isToday ? "#fff" : "transparent",
              }}
            >
              {d.active ? "Done!" : d.isToday ? "Today" : "\u00A0"}
            </span>
          </div>
        ))}
      </div>

      <div
        className="mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
        style={{ background: DASH.cardAlt }}
      >
        <p className="text-xs italic flex-1" style={{ color: DASH.textMid }}>
          “{quote}”
        </p>
        <span
          className="text-[10px] font-bold flex items-center gap-1 shrink-0"
          style={{ color: DASH.accentPurple }}
        >
          <Sparkles size={12} />
          Keep going!
        </span>
      </div>
    </DashCard>
  );
}
