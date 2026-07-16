import { useProfile } from "../hooks/useProfile";
import AIInsightsSection from "../components/profile/AIInsightsSection";
import { COLORS } from "../constants/theme";

/**
 * LearningInsightsScreen — "AI Learning Insights" now lives on its own
 * page (sidebar: My Profile > Learning Insights) instead of being a
 * section inside the single ProfileScreen. Reuses useProfile() and the
 * same AIInsightsSection component.
 */
export default function LearningInsightsScreen() {
  const { aiInsights, loading } = useProfile();

  if (loading) {
    return (
      <div className="px-4 sm:px-8 py-10 text-center">
        <p className="text-sm" style={{ color: COLORS.textLight }}>
          Loading your insights...
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-10 pb-20">
      <div className="max-w-3xl mx-auto">
        <AIInsightsSection insights={aiInsights} />
      </div>
    </div>
  );
}