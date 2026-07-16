import { useProfile } from "../hooks/useProfile";
import RevisionScheduleSection from "../components/profile/RevisionScheduleSection";
import { COLORS } from "../constants/theme";

/**
 * RevisionScheduleScreen — "AI Revision Schedule" now lives on its own
 * page (sidebar: My Profile > AI Revision Schedule) instead of being a
 * section inside the single ProfileScreen. Reuses the same useProfile()
 * hook and RevisionScheduleSection component, so marking a revision
 * complete still works exactly the same way.
 */
export default function RevisionScheduleScreen() {
  const { revisions, loading, toggleRevisionCompleted } = useProfile();

  if (loading) {
    return (
      <div className="px-4 sm:px-8 py-10 text-center">
        <p className="text-sm" style={{ color: COLORS.textLight }}>
          Loading your revision schedule...
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-10 pb-20">
      <div className="max-w-3xl mx-auto">
        <RevisionScheduleSection revisions={revisions} onToggle={toggleRevisionCompleted} />
      </div>
    </div>
  );
}