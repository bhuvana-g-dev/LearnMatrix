import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DashboardLayout from "./components/layout/DashboardLayout";
import LoginScreen from "./screens/LoginScreen";
import SignUpScreen from "./screens/SignUpScreen";
import HomeScreen from "./screens/HomeScreen";
import RoleSelectionScreen from "./screens/RoleSelectionScreen";
import SkillSelectionScreen from "./screens/SkillSelectionScreen";
import AssessmentScreen from "./screens/AssessmentScreen";
import RoadmapScreen from "./screens/RoadmapScreen";
import ProfileScreen from "./screens/ProfileScreen";
import RevisionScheduleScreen from "./screens/RevisionScheduleScreen";
import LearningInsightsScreen from "./screens/LearningInsightsScreen";
import ComingSoonScreen from "./screens/ComingSoonScreen";
import { useAuth } from "./hooks/useAuth";
import { useCareerPath } from "./hooks/useCareerPath";
import { NAV_SECTIONS } from "./constants/navigation";
/**
 * App.jsx is now a thin composition root:
 *  - useAuth()        -> auth state + login/logout (dummy today, Flask/Firebase later)
 *  - useCareerPath()  -> roles + skills state (dummy today, Flask later)
 *
 * Screens receive plain props and stay 100% presentational. Swapping the
 * backend only means editing services/*.js — nothing in this file or in
 * screens/* needs to change.
 */
export default function App() {
  const auth = useAuth();
  const careerPath = useCareerPath();
  const [activeKey, setActiveKey] = useState("home");
  const [showSignup, setShowSignup] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [auth.isAuthenticated, activeKey]);

  if (!auth.isAuthenticated) {
    if (showSignup) {
      return (
        <SignUpScreen
          auth={auth}
          onLogin={() => setShowSignup(false)}
        />
      );
    }

    return (
      <LoginScreen
        auth={auth}
        onSuccess={() => setActiveKey("home")}
        onSignup={() => setShowSignup(true)}
      />
    );
  }

  let content;
  if (activeKey === "home") {
    content = <HomeScreen onGetStarted={() => setActiveKey("role")} />;
  } else if (activeKey === "role") {
    content = (
      <RoleSelectionScreen
        roles={careerPath.roles}
        rolesLoading={careerPath.rolesLoading}
        selectedRole={careerPath.selectedRole}
        onSelectRole={careerPath.selectRole}
        onContinue={() => setActiveKey("skills")}
      />
    );
  } else if (activeKey === "skills") {
    content = (
      <SkillSelectionScreen
        skillCategories={careerPath.skillCategories}
        skillsLoading={careerPath.skillsLoading}
        selectedSkills={careerPath.selectedSkills}
        onToggleSkill={careerPath.toggleSkill}
        onFinish={async () => {
          await careerPath.finishSkillSelection();
          setActiveKey("initial-assessment");
        }}
        onBack={() => setActiveKey("role")}
        selectedRole={careerPath.selectedRole}
      />
    );
  } else if (activeKey === "initial-assessment") {
    content = (
      <AssessmentScreen
        selectedRole={careerPath.selectedRole}
        selectedSkills={careerPath.selectedSkills}
        uid={auth.user?.uid}
        onBack={() => setActiveKey("skills")}
      />
    );
  } else if (activeKey === "roadmap") {
    content = <RoadmapScreen uid={auth.user?.uid} onNavigate={setActiveKey} />;
  } else if (activeKey === "profile") {
    // "My Profile" > "Overview" — the main profile hub (see
    // constants/navigation.js for the dropdown's other two entries).
    content = <ProfileScreen onNavigate={setActiveKey} />;
  } else if (activeKey === "revision-schedule") {
    content = <RevisionScheduleScreen />;
  } else if (activeKey === "learning-insights") {
    content = <LearningInsightsScreen />;
  } else {
    const label =
      NAV_SECTIONS.flatMap((s) => s.children || []).find((c) => c.key === activeKey)?.label ||
      "Coming Soon";
    content = <ComingSoonScreen label={label} onBack={() => setActiveKey("role")} />;
  }

  return (
    <DashboardLayout activeKey={activeKey} onNavigate={setActiveKey} onLogout={auth.logout}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeKey}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </DashboardLayout>
  );
}
