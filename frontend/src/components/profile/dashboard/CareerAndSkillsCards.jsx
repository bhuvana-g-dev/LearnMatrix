import { Code2, ClipboardList } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";
import DashCard, { DashCardTitle, ProgressRow } from "./DashCard";

export function CareerPathCard({ profile, roadmap, stats }) {
  const skillNames = (roadmap?.entries || []).map((e) => e.skill);

  return (
    <DashCard>
      <DashCardTitle icon={Code2}>Current Career Path</DashCardTitle>

      {profile?.careerPath ? (
        <>
          <p className="text-base font-bold mb-3" style={{ color: DASH.accentPurple }}>
            {profile.careerPath}
          </p>
          <ProgressRow
            label="Roadmap Completion"
            percent={stats.overallProgressPercent}
            color={DASH.accentPurple}
          />

          {skillNames.length > 0 && (
            <>
              <p className="text-xs font-semibold mt-4 mb-2" style={{ color: DASH.textLight }}>
                Skills in this path
              </p>
              <div className="flex flex-wrap gap-2">
                {skillNames.map((s) => (
                  <span
                    key={s}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                    style={{ background: DASH.trackBg, color: DASH.textMid }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <p className="text-xs" style={{ color: DASH.textLight }}>
          No career path selected yet.
        </p>
      )}
    </DashCard>
  );
}

const SKILL_COLORS = [DASH.accentOrange, DASH.accentTeal, DASH.accentPink, DASH.accentPurple, DASH.accentGreen];

export function SkillProgressCard({ aiInsights, onStartAssessment }) {
  const started = aiInsights?.started;
  const skillProgress = aiInsights?.skillProgress || [];

  return (
    <DashCard>
      <DashCardTitle icon={ClipboardList} iconColor={DASH.accentTeal}>
        Skill Progress
      </DashCardTitle>

      {!started ? (
        <div className="flex flex-col items-center text-center gap-2 py-4">
          <p className="text-xs" style={{ color: DASH.textLight }}>
            Take your diagnostic assessment to see real, per-skill progress here.
          </p>
          {onStartAssessment && (
            <button
              type="button"
              onClick={onStartAssessment}
              className="text-xs font-semibold mt-1"
              style={{
                padding: "8px 16px",
                borderRadius: 9999,
                color: "#fff",
                background: DASH.accentPurple,
                border: "none",
                cursor: "pointer",
              }}
            >
              Take Assessment
            </button>
          )}
        </div>
      ) : skillProgress.length === 0 ? (
        <p className="text-xs" style={{ color: DASH.textLight }}>
          No skill data yet.
        </p>
      ) : (
        skillProgress.map((s, i) => (
          <ProgressRow
            key={s.skill}
            label={s.skill}
            percent={s.percent}
            color={SKILL_COLORS[i % SKILL_COLORS.length]}
          />
        ))
      )}
    </DashCard>
  );
}
