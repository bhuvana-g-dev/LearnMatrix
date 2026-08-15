import { useState } from "react";
import { useProfileDashboard } from "../hooks/useProfileDashboard";
import EditProfileModal from "../components/profile/EditProfileModel";
import ProfileIdentityCard from "../components/profile/dashboard/ProfileIdentityCard";
import StatsRow from "../components/profile/dashboard/StatsRow";
import { CareerPathCard, SkillProgressCard } from "../components/profile/dashboard/CareerAndSkillsCards";
import InsightsCard from "../components/profile/dashboard/InsightsCard";
import WeeklyActivityCard from "../components/profile/dashboard/WeeklyActivityCard";
import AchievementsCard from "../components/profile/dashboard/AchievementsCard";
import { UpcomingRevisionsCard, NextRevisionCard } from "../components/profile/dashboard/RevisionCards";
import CertificatesGridCard from "../components/profile/dashboard/CertificatesGridCard";
import { DASH } from "../constants/profileDashboardTheme";

/**
 * ProfileScreen — "My Profile" dashboard.
 *
 * Every number on this page traces back to a real source (see
 * hooks/useProfileDashboard.js's docstring for the full mapping:
 * Firebase Auth + Firestore profile doc, the diagnostic-assessment-
 * derived AI insights, the saved roadmap, the real day-level activity
 * log, and the revision scheduler). Nothing here is filled in from
 * constants/*.js dummy data — a brand-new user genuinely sees zeros
 * and honest empty states (e.g. "No achievements yet") instead of
 * canned demo numbers, exactly like AIInsightsSection.jsx already does
 * for the Learning Insights page.
 */
export default function ProfileScreen({ onNavigate }) {
  const { profile, aiInsights, roadmap, revision, loading, refetchProfile, stats, weekActivity, nextRevision } =
    useProfileDashboard();

  const [editOpen, setEditOpen] = useState(false);

  const goToAssessment = () => onNavigate?.("initial-assessment");

  const handleStartRevision = () => {
    // No dedicated "start revision" screen wired yet, so this routes to
    // the Revision page for now rather than doing nothing.
    onNavigate?.("revision");
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-8 py-10 text-center" style={{ background: DASH.page, minHeight: "100%" }}>
        <p className="text-sm" style={{ color: DASH.textLight }}>
          Loading your profile...
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-8 pb-20" style={{ background: DASH.page, minHeight: "100%" }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: DASH.textPrimary }}>
            My Profile
          </h1>
          <p className="text-xs" style={{ color: DASH.textLight }}>
            Your learning journey overview
          </p>
        </div>

        <ProfileIdentityCard profile={profile} onEditProfile={() => setEditOpen(true)} />

        {editOpen && (
          <EditProfileModal
            profile={profile}
            onClose={() => setEditOpen(false)}
            onSaved={async () => {
              await refetchProfile();
              setEditOpen(false);
            }}
          />
        )}

        <StatsRow stats={stats} />

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <CareerPathCard profile={profile} roadmap={roadmap} stats={stats} />
          <SkillProgressCard aiInsights={aiInsights} onStartAssessment={goToAssessment} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <InsightsCard aiInsights={aiInsights} onStartAssessment={goToAssessment} />
          <WeeklyActivityCard weekActivity={weekActivity} />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <AchievementsCard />
          <UpcomingRevisionsCard upcoming={revision.upcoming} />
          <NextRevisionCard
            nextRevision={nextRevision}
            dueCount={revision.due?.length || 0}
            upcomingCount={revision.upcoming?.length || 0}
            onStartRevision={handleStartRevision}
          />
        </div>

        <CertificatesGridCard />
      </div>
    </div>
  );
}
