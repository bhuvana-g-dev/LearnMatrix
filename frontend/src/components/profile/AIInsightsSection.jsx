import { Sparkles, AlertCircle, Compass, BookOpen, TrendingUp, ClipboardList, ArrowRight } from "lucide-react";
import SectionCard from "./SectionCard";
import LearningScoreCard from "./insights/LearningScoreCard";
import RiskPredictionCard from "./insights/RiskPredictionCard";
import CareerReadinessCard from "./insights/CareerReadinessCard";
import MotivationCard from "./insights/MotivationCard";
import SmartResourcesCard from "./insights/SmartResourcesCard";
import CommunityRankingCard from "./insights/CommunityRankingCard";
import { COLORS, GRADIENTS } from "../../constants/theme";
import { getInsightsTheme } from "../../constants/insightsTheme";

// Small "Sample" pill for cards not yet backed by real tracking data
// (see aiInsightsService.js's `sampleFields`) — wraps a card, doesn't
// touch its internals.
function SampleWrap({ show, theme, children }) {
  if (!show) return children;
  return (
    <div className="relative">
      <span
        className="absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded-full z-10"
        style={{ background: theme.track, color: theme.textLight }}
      >
        SAMPLE
      </span>
      {children}
    </div>
  );
}

/**
 * SECTION 7 — AI Learning Insights.
 * Data comes from `insights` (aiInsightsService.js). Once the student has
 * a saved diagnostic assessment result, most of this is real, computed
 * from their actual per-skill scores — see aiInsightsService.js's
 * computeLiveInsights(). Fields listed in insights.sampleFields aren't
 * backed by any tracking yet (no daily-activity, streak, or resource
 * catalog data exists in the app), so they're clearly tagged "SAMPLE"
 * instead of being presented as if real.
 */
export default function AIInsightsSection({ insights, dark = false, onStartAssessment }) {
  if (!insights) return null;

  const theme = getInsightsTheme(dark);
  const isSample = (field) => insights.sampleFields?.includes(field);

  // ---- Not started yet: no saved assessment for this user ----
  if (!insights.started) {
    return (
      <SectionCard icon={Sparkles} title="AI Learning Insights" subtitle="Personalized for your career path" delay={0.3} theme={dark ? theme : undefined}>
        <div
          className="p-6 sm:p-8 flex flex-col items-center text-center gap-3"
          style={{ borderRadius: 20, background: theme.cardBg, border: `1px solid ${theme.border}` }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "rgba(212,160,23,0.15)" }}
          >
            <ClipboardList size={22} color={COLORS.purple} />
          </div>
          <h3 className="text-sm font-bold" style={{ color: theme.textDark }}>
            Take your assessment to unlock AI insights
          </h3>
          <p className="text-xs max-w-sm" style={{ color: theme.textMid }}>
            Your Learning Score, weak topics, skill progress, and every other card here are generated
            from your diagnostic assessment results. Complete it once and this whole section goes live.
          </p>
          {onStartAssessment && (
            <button
              onClick={onStartAssessment}
              className="inline-flex items-center gap-2 font-semibold text-sm mt-1"
              style={{
                padding: "10px 22px",
                borderRadius: 9999,
                color: "#fff",
                border: "none",
                background: GRADIENTS.purpleSky,
                cursor: "pointer",
              }}
            >
              Take Assessment <ArrowRight size={15} />
            </button>
          )}
        </div>
      </SectionCard>
    );
  }

  const eta = new Date(insights.estimatedCourseCompletionDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <SectionCard icon={Sparkles} title="AI Learning Insights" subtitle="Live from your latest assessment" delay={0.3} theme={dark ? theme : undefined}>
      <div className="grid sm:grid-cols-2 gap-4">
        {/* ---- existing cards (unchanged layout/design, theme-aware colors, now live) ---- */}
        <div className="p-4" style={{ borderRadius: 18, background: theme.cardBg, border: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: "#E4568A" }}>
            <AlertCircle size={14} /> Weak Topics
          </div>
          <div className="flex flex-wrap gap-1.5">
            {insights.weakTopics.map((t) => (
              <span
                key={t}
                className="text-[11px] px-2 py-1 rounded-full font-medium"
                style={{ background: "rgba(228,86,138,0.12)", color: "#E4568A" }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="p-4" style={{ borderRadius: 18, background: theme.cardBg, border: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: "#8B5CF6" }}>
            <Compass size={14} /> Recommended Next Skill
          </div>
          <p className="text-sm font-semibold" style={{ color: theme.textDark }}>{insights.recommendedNextSkill}</p>
        </div>

        <SampleWrap show={isSample("recommendedResources")} theme={theme}>
          <div className="p-4 sm:col-span-2" style={{ borderRadius: 18, background: theme.cardBg, border: `1px solid ${theme.border}` }}>
            <div className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: "#8B5CF6" }}>
              <BookOpen size={14} /> Recommended Resources
            </div>
            <div className="flex flex-wrap gap-2">
              {insights.recommendedResources.map((r) => (
                <span
                  key={r.title}
                  className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{ background: theme.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.5)", color: theme.textDark }}
                >
                  {r.title} <span style={{ color: theme.textLight }}>· {r.type}</span>
                </span>
              ))}
            </div>
          </div>
        </SampleWrap>

        <div className="p-4 sm:col-span-2" style={{ borderRadius: 18, background: GRADIENTS.purplePink }}>
          <p className="text-xs font-bold text-white/90 mb-1">Personalized Study Tip</p>
          <p className="text-sm text-white">{insights.studyTip}</p>
        </div>

        <SampleWrap show={isSample("learningConsistency")} theme={theme}>
          <div
            className="p-4 flex items-center gap-2.5"
            style={{ borderRadius: 18, background: theme.cardBg, border: `1px solid ${theme.border}` }}
          >
            <TrendingUp size={16} color="#22C08E" />
            <div>
              <p className="text-[11px]" style={{ color: theme.textLight }}>Consistency</p>
              <p className="text-sm font-semibold" style={{ color: theme.textDark }}>{insights.learningConsistency}</p>
            </div>
          </div>
        </SampleWrap>

        <SampleWrap show={isSample("estimatedCourseCompletionDate")} theme={theme}>
          <div
            className="p-4 flex items-center gap-2.5"
            style={{ borderRadius: 18, background: theme.cardBg, border: `1px solid ${theme.border}` }}
          >
            <Sparkles size={16} color="#8B5CF6" />
            <div>
              <p className="text-[11px]" style={{ color: theme.textLight }}>Est. Course Completion</p>
              <p className="text-sm font-semibold" style={{ color: theme.textDark }}>{eta}</p>
            </div>
          </div>
        </SampleWrap>
      </div>

      {/* ---- new AI-powered cards ---- */}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        {insights.learningScore && <LearningScoreCard data={insights.learningScore} theme={theme} />}
        {insights.riskPrediction && <RiskPredictionCard risk={insights.riskPrediction} theme={theme} />}

        {insights.careerReadiness && <CareerReadinessCard readiness={insights.careerReadiness} theme={theme} />}
        {insights.motivation && <MotivationCard message={insights.motivation} />}

        {Array.isArray(insights.smartResources) && insights.smartResources.length > 0 && (
          <div className="sm:col-span-2">
            <SmartResourcesCard resources={insights.smartResources} theme={theme} />
          </div>
        )}

        {insights.communityRanking && (
          <div className="sm:col-span-2">
            <SampleWrap show={isSample("communityRanking")} theme={theme}>
              <CommunityRankingCard ranking={insights.communityRanking} theme={theme} />
            </SampleWrap>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
