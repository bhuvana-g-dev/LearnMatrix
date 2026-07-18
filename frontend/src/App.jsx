import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DashboardLayout from "./components/layout/DashboardLayout";
import LoginScreen from "./screens/LoginScreen";
import SignUpScreen from "./screens/SignUpScreen";
import VerifyEmailScreen from "./screens/VerifyEmailScreen";
import CompleteProfileScreen from "./screens/CompleteProfileScreen";
import HomeScreen from "./screens/HomeScreen";
import RoleSelectionScreen from "./screens/RoleSelectionScreen";
import SkillSelectionScreen from "./screens/SkillSelectionScreen";
import AssessmentScreen from "./screens/AssessmentScreen";
import ProfileScreen from "./screens/ProfileScreen";
import RevisionScheduleScreen from "./screens/RevisionScheduleScreen";
import LearningInsightsScreen from "./screens/LearningInsightsScreen";
import ComingSoonScreen from "./screens/ComingSoonScreen";
import { useAuth } from "./hooks/useAuth";
import { useCareerPath } from "./hooks/useCareerPath";
import { useProfileCompletion } from "./hooks/useProfileCompletion";
import { saveUserProfileDoc } from "./services/userProfileService";
import { ROLE_TITLES } from "./constants/roles";
import { NAV_SECTIONS } from "./constants/navigation";

/**
 * App.jsx is now a thin composition root:
 *  - useAuth()               -> auth state + login/logout (Firebase)
 *  - useCareerPath()         -> roles + skills state (dummy today, Flask later)
 *  - useProfileCompletion()  -> has this user filled in college/dept/year/
 *                               mobile/photo yet? (Firestore, users/{uid})
 *
 * Screens receive plain props and stay 100% presentational. Swapping the
 * backend only means editing services/*.js — nothing in this file or in
 * screens/* needs to change.
 */
export default function App() {
  const auth = useAuth();
  const careerPath = useCareerPath();
  const profileCompletion = useProfileCompletion(auth.user);
  const [activeKey, setActiveKey] = useState("home");
  const [showSignup, setShowSignup] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [auth.isAuthenticated, activeKey]);
  if (!auth.isAuthenticated) {
    // Public landing page — shown first, before Login/Signup. "Login" in
    // the top-right and "Get Started" both drop into the Login screen
    // (which itself links to Sign Up for people without an account yet).
    if (showLanding) {
      return (
        <HomeScreen
          onGetStarted={() => setShowLanding(false)}
          onLogin={() => setShowLanding(false)}
          onSignup={() => {
            setShowLanding(false);
            setShowSignup(true);
          }}
        />
      );
    }

    if (showSignup) {
      return (
        <SignUpScreen
          auth={auth}
          onLogin={() => setShowSignup(false)}
          onBack={() => setShowLanding(true)}
          onSuccess={() => {
            setShowSignup(false);
            setActiveKey("home");
          }}
        />
      );
    }

    return (
      <LoginScreen
        auth={auth}
        onSuccess={() => setActiveKey("home")}
        onSignup={() => setShowSignup(true)}
        onBack={() => setShowLanding(true)}
      />
    );
  }

  // Blocks access until the person clicks the verification link sent on
  // signup. Google/GitHub sign-ins already come back with emailVerified
  // true, so this only ever gates email/password accounts.
  if (!auth.user?.emailVerified) {
    return <VerifyEmailScreen auth={auth} />;
  }

  // Blocks access until college/department/year/mobile/photo are saved in
  // Firestore. Runs on every login, not just right after signup — so an
  // account that somehow skipped this step still gets caught.
  if (profileCompletion.status === "loading") {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <p className="text-sm text-gray-500">Loading your account...</p>
      </div>
    );
  }

  if (profileCompletion.status === "incomplete") {
    return (
      <CompleteProfileScreen
        user={auth.user}
        onComplete={() => {
          profileCompletion.recheck();
          setActiveKey("home");
        }}
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

          // Save the chosen role onto the Firestore profile doc so
          // ProfileScreen's "Career Path" field reflects the real choice
          // instead of the USER_PROFILE mock default.
          if (auth.user && careerPath.selectedRole) {
            try {
              await saveUserProfileDoc(auth.user.uid, {
                careerPath: ROLE_TITLES[careerPath.selectedRole] || careerPath.selectedRole,
              });
            } catch {
              // Non-fatal — profile page just keeps showing the previous value.
            }
          }

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
        onBack={() => setActiveKey("skills")}
      />
    );
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
