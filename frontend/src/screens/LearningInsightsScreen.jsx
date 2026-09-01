import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useProfile } from "../hooks/useProfile";
import AIInsightsSection from "../components/profile/AIInsightsSection";
import InsightsSkeleton from "../components/profile/insights/InsightsSkeleton";
import { getInsightsTheme } from "../constants/insightsTheme";

/**
 * LearningInsightsScreen — "AI Learning Insights" now lives on its own
 * page (sidebar: My Profile > Learning Insights) instead of being a
 * section inside the single ProfileScreen. Reuses useProfile() and the
 * same AIInsightsSection component.
 *
 * Ships its own light/dark toggle — the app doesn't have a global theme
 * system yet, so dark mode here is self-contained (see insightsTheme.js).
 *
 * Reads aiInsightsLoading, not the hook's combined `loading` — this page
 * only ever renders `aiInsights`, so it shouldn't sit on its skeleton
 * waiting on progress/assessments/completedCourses/statistics, which
 * useProfile() also fetches for other consumers but which have nothing
 * to do with what's shown here.
 */
export default function LearningInsightsScreen({ onStartAssessment }) {
  const { aiInsights, aiInsightsLoading } = useProfile();
  const [dark, setDark] = useState(false);
  const theme = getInsightsTheme(dark);

  return (
    <div
      className="px-4 sm:px-8 py-10 pb-20"
      style={{ background: theme.pageBg, minHeight: "100%", transition: "background 0.25s ease" }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-end mb-4">
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            aria-label="Toggle dark mode"
            className="flex items-center gap-2 text-xs font-semibold"
            style={{
              padding: "8px 14px",
              borderRadius: 9999,
              color: theme.textDark,
              background: theme.cardBg,
              border: `1px solid ${theme.border}`,
              cursor: "pointer",
            }}
          >
            {dark ? <Sun size={13} /> : <Moon size={13} />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        {aiInsightsLoading ? (
          <InsightsSkeleton theme={theme} />
        ) : (
          <AIInsightsSection insights={aiInsights} dark={dark} onStartAssessment={onStartAssessment} />
        )}
      </div>
    </div>
  );
}
