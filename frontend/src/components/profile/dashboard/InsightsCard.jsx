import { Sparkles, TrendingUp, TrendingDown, Compass, Gauge, Trophy } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";
import DashCard, { DashCardTitle } from "./DashCard";

function InsightRow({ icon, label, value, valueColor }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: DASH.border }}>
      <span className="flex items-center gap-2 text-xs" style={{ color: DASH.textMid }}>
        {icon} {label}
      </span>
      <span className="text-xs font-bold" style={{ color: valueColor || DASH.textPrimary }}>
        {value}
      </span>
    </div>
  );
}

export default function InsightsCard({ aiInsights, onStartAssessment }) {
  if (!aiInsights?.started) {
    return (
      <DashCard>
        <DashCardTitle icon={Sparkles}>AI Learning Insights</DashCardTitle>
        <p className="text-xs mb-3" style={{ color: DASH.textLight }}>
          Your strongest/weakest skills, recommended topic, and career readiness score are generated
          from your diagnostic assessment. Take it once to unlock this section.
        </p>
        {onStartAssessment && (
          <button
            type="button"
            onClick={onStartAssessment}
            className="text-xs font-semibold"
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
      </DashCard>
    );
  }

  const skills = aiInsights.skillProgress || [];
  const strongest = skills.length ? skills.reduce((a, b) => (b.percent > a.percent ? b : a)) : null;
  const weakest = skills.length ? skills.reduce((a, b) => (b.percent < a.percent ? b : a)) : null;

  return (
    <DashCard>
      <DashCardTitle icon={Sparkles}>AI Learning Insights</DashCardTitle>

      {strongest && (
        <InsightRow
          icon={<TrendingUp size={14} color={DASH.accentTeal} />}
          label="Strongest Skill"
          value={`${strongest.skill} (${strongest.percent}%)`}
          valueColor={DASH.accentTeal}
        />
      )}
      {weakest && (
        <InsightRow
          icon={<TrendingDown size={14} color={DASH.accentPink} />}
          label="Weakest Skill"
          value={`${weakest.skill} (${weakest.percent}%)`}
          valueColor={DASH.accentPink}
        />
      )}
      <InsightRow
        icon={<Compass size={14} color={DASH.accentPurple} />}
        label="Recommended Topic"
        value={aiInsights.recommendedNextSkill}
        valueColor={DASH.accentPurple}
      />
      {aiInsights.learningScore && (
        <InsightRow
          icon={<Trophy size={14} color={DASH.accentOrange} />}
          label="Overall Score"
          value={`${aiInsights.learningScore.score}%`}
          valueColor={DASH.accentOrange}
        />
      )}
      {aiInsights.careerReadiness && (
        <InsightRow
          icon={<Gauge size={14} color={DASH.accentGreen} />}
          label="Career Readiness Score"
          value={`${aiInsights.careerReadiness.percent}%`}
          valueColor={DASH.accentGreen}
        />
      )}

      {aiInsights.studyTip && (
        <div
          className="mt-4 p-3.5"
          style={{ borderRadius: 14, background: `linear-gradient(90deg, ${DASH.accentPurple}, #A78BFA)` }}
        >
          <p className="text-[11px] font-bold text-white/90 mb-1">Recommendation</p>
          <p className="text-xs text-white">{aiInsights.studyTip}</p>
        </div>
      )}
    </DashCard>
  );
}
