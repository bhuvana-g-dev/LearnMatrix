import { useProfile } from "../hooks/useProfile";
import RevisionScheduleSection from "../components/profile/RevisionScheduleSection";
import { COLORS } from "../constants/theme";

/**
 * RevisionScheduleScreen — "AI Revision Schedule" lives on its own page
 * (sidebar: My Profile > AI Revision Schedule). Reuses useProfile() and
 * RevisionScheduleSection, now also passing through the learning streak
 * (for the header stat) and the snooze / bulk-complete actions.
 */
export default function RevisionScheduleScreen() {
  const {
    revisions,
    statistics,
    loading,
    toggleRevisionCompleted,
    snoozeRevision,
    markAllTodayCompleted,
  } = useProfile();

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
        <RevisionScheduleSection
          revisions={revisions}
          onToggle={toggleRevisionCompleted}
          onSnooze={snoozeRevision}
          onMarkAllToday={markAllTodayCompleted}
          streak={statistics?.learningStreak}
        />
      </div>
    </div>
  );
}
