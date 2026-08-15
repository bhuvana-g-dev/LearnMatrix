import { BookOpenCheck, Sparkles } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";
import DashCard, { DashCardTitle } from "./DashCard";

const PRIORITY_COLOR = {
  High: DASH.accentPink,
  Medium: DASH.accentOrange,
  Low: DASH.accentTeal,
};

export function UpcomingRevisionsCard({ upcoming = [] }) {
  return (
    <DashCard>
      <DashCardTitle icon={BookOpenCheck} iconColor={DASH.accentPurple}>
        Upcoming Revisions
      </DashCardTitle>

      {upcoming.length === 0 ? (
        <p className="text-xs" style={{ color: DASH.textLight }}>
          Nothing scheduled yet — this fills in as you take topic quizzes.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {upcoming.slice(0, 4).map((r) => (
            <div key={r.id} className="flex items-start gap-2.5">
              <span
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: PRIORITY_COLOR[r.priority] || DASH.accentPurple }}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: DASH.textPrimary }}>
                  {r.topic}
                </p>
                <p className="text-[11px]" style={{ color: DASH.textLight }}>
                  {r.skill} · {r.date}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );
}

export function NextRevisionCard({ nextRevision, dueCount = 0, upcomingCount = 0, onStartRevision }) {
  return (
    <DashCard>
      <DashCardTitle icon={Sparkles} iconColor={DASH.accentTeal}>
        Next Revision
      </DashCardTitle>

      {nextRevision ? (
        <>
          <p className="text-sm font-bold mb-1" style={{ color: DASH.textPrimary }}>
            {nextRevision.topic}
          </p>
          <p className="text-xs mb-4" style={{ color: DASH.textLight }}>
            {nextRevision.skill} · {nextRevision.date}
          </p>
          <button
            type="button"
            onClick={() => onStartRevision?.(nextRevision)}
            className="w-full text-xs font-semibold"
            style={{
              padding: "10px 0",
              borderRadius: 10,
              color: "#fff",
              background: DASH.accentPurple,
              border: "none",
              cursor: "pointer",
            }}
          >
            Start Revision
          </button>
        </>
      ) : (
        <p className="text-xs" style={{ color: DASH.textLight }}>
          Nothing due right now — nice work staying on top of it.
        </p>
      )}

      <p className="text-[11px] mt-4 pt-4 border-t" style={{ color: DASH.textLight, borderColor: DASH.border }}>
        {dueCount + upcomingCount > 0
          ? `You have ${dueCount} due and ${upcomingCount} upcoming.`
          : "No revisions scheduled yet."}
      </p>
    </DashCard>
  );
}
