import { Sparkles, AlertCircle, Compass, BookOpen, TrendingUp } from "lucide-react";
import SectionCard from "./SectionCard";
import { COLORS, GRADIENTS } from "../../constants/theme";

/**
 * SECTION 7 — AI Learning Insights.
 * Data comes from `insights` (aiInsights.js via aiInsightsService.js) —
 * a mock AI-generated recommendation payload, structured like a future
 * Gemini/Scikit-Learn-backed endpoint would return.
 */
export default function AIInsightsSection({ insights }) {
  if (!insights) return null;

  const eta = new Date(insights.estimatedCourseCompletionDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <SectionCard icon={Sparkles} title="AI Learning Insights" subtitle="Personalized for your career path" delay={0.3}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-4" style={{ borderRadius: 18, background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.6)" }}>
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

        <div className="p-4" style={{ borderRadius: 18, background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.6)" }}>
          <div className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: "#8B5CF6" }}>
            <Compass size={14} /> Recommended Next Skill
          </div>
          <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>{insights.recommendedNextSkill}</p>
        </div>

        <div className="p-4 sm:col-span-2" style={{ borderRadius: 18, background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.6)" }}>
          <div className="flex items-center gap-2 text-xs font-bold mb-2" style={{ color: "#8B5CF6" }}>
            <BookOpen size={14} /> Recommended Resources
          </div>
          <div className="flex flex-wrap gap-2">
            {insights.recommendedResources.map((r) => (
              <span
                key={r.title}
                className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: "rgba(255,255,255,0.5)", color: COLORS.textDark }}
              >
                {r.title} <span style={{ color: COLORS.textLight }}>· {r.type}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="p-4 sm:col-span-2" style={{ borderRadius: 18, background: GRADIENTS.purplePink }}>
          <p className="text-xs font-bold text-white/90 mb-1">Personalized Study Tip</p>
          <p className="text-sm text-white">{insights.studyTip}</p>
        </div>

        <div
          className="p-4 flex items-center gap-2.5"
          style={{ borderRadius: 18, background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.6)" }}
        >
          <TrendingUp size={16} color="#22C08E" />
          <div>
            <p className="text-[11px]" style={{ color: COLORS.textLight }}>Consistency</p>
            <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>{insights.learningConsistency}</p>
          </div>
        </div>

        <div
          className="p-4 flex items-center gap-2.5"
          style={{ borderRadius: 18, background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.6)" }}
        >
          <Sparkles size={16} color="#8B5CF6" />
          <div>
            <p className="text-[11px]" style={{ color: COLORS.textLight }}>Est. Course Completion</p>
            <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>{eta}</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
