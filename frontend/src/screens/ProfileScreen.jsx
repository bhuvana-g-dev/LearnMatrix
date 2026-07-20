import { useState } from "react";
import { useProfile } from "../hooks/useProfile";
import ProfileHeaderCard from "../components/profile/ProfileHeaderCard";
import EditProfileModal from "../components/profile/EditProfileModel";
import LearningProgressSection from "../components/profile/LearningProgressSection";
import UpcomingAssessmentsSection from "../components/profile/UpcomingAssessmentsSection";
import CompletedCoursesSection from "../components/profile/CompletedCoursesSection";
import CertificatesSection from "../components/profile/certificates/CertificatesSection";
import LearningStatisticsSection from "../components/profile/LearningStatisticsSection";
import { COLORS } from "../constants/theme";
/**
 * ProfileScreen — the main "My Profile" overview page. "AI Revision
 * Schedule" and "Learning Insights" now live on their own separate pages
 * (see RevisionScheduleScreen.jsx / LearningInsightsScreen.jsx, wired via
 * the "My Profile" dropdown in the sidebar) — this screen covers the rest:
 * Personal Info, Learning Progress, Assessments, Completed Courses,
 * Certificates, and Statistics.
 *
 * All data comes from useProfile(), which is backed by mock service files
 * shaped like future API responses (see src/services/*.js and
 * src/constants/*.js). Swapping in Flask/Firebase later only means
 * editing those services — this screen and its sub-components stay as-is.
 */
export default function ProfileScreen({ onNavigate }) {
  const {
    profile,
    progress,
    assessments,
    completedCourses,
    statistics,
    loading,
    refetchProfile,
  } = useProfile();

  const [editOpen, setEditOpen] = useState(false);

  if (loading) {
    return (
      <div className="px-4 sm:px-8 py-10 text-center">
        <p className="text-sm" style={{ color: COLORS.textLight }}>
          Loading your profile...
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-10 pb-20">
      <div className="max-w-5xl mx-auto">
        <ProfileHeaderCard
          profile={profile}
          onEditProfile={() => setEditOpen(true)}
        />

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

        <LearningProgressSection
          progress={progress}
          onContinueLearning={() => onNavigate?.("skills")}
        />

        <UpcomingAssessmentsSection
          assessments={assessments}
          onStartAssessment={(a) => alert(`Starting: ${a.name}`)}
        />

        <CompletedCoursesSection
          courses={completedCourses}
          onViewDetails={(c) => alert(`Viewing details for: ${c.moduleName}`)}
        />

        <CertificatesSection />

        <LearningStatisticsSection statistics={statistics} />
      </div>
    </div>
  );
}
