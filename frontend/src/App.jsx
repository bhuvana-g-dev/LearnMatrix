import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DashboardLayout from "./components/layout/DashboardLayout";
import PageShell from "./components/layout/PageShell";
import Logo from "./components/common/Logo";
import LoginScreen from "./screens/LoginScreen";
import SignUpScreen from "./screens/SignUpScreen";
import VerifyEmailScreen from "./screens/VerifyEmailScreen";
import CompleteProfileScreen from "./screens/CompleteProfileScreen";
import HomeScreen from "./screens/HomeScreen";
import RoleSelectionScreen from "./screens/RoleSelectionScreen";
import CareerStatusScreen from "./screens/CareerStatusScreen";
import SkillSelectionScreen from "./screens/SkillSelectionScreen";
import SkillProgressScreen from "./screens/SkillProgressScreen";
import AssessmentScreen from "./screens/AssessmentScreen";
import RoadmapScreen from "./screens/RoadmapScreen";
import CourseWorkspaceScreen from "./screens/CourseWorkspaceScreen";
import LearningPathScreen from "./screens/LearningPathScreen";
import ProfileScreen from "./screens/ProfileScreen";
import RevisionScheduleScreen from "./screens/RevisionScheduleScreen";
import AIStudyAssistantScreen from "./screens/AIStudyAssistantScreen";
import ComingSoonScreen from "./screens/ComingSoonScreen";
import { useAuth } from "./hooks/useAuth";
import { useCareerPath } from "./hooks/useCareerPath";
import { useProfileCompletion } from "./hooks/useProfileCompletion";
import { pingActivity } from "./services/activityService";
import { saveUserProfileDoc } from "./services/userProfileService";
import { getCachedRoadmap } from "./services/userProgressCache";
import { ROLE_TITLES } from "./constants/roles";
import { NAV_SECTIONS } from "./constants/navigation";
import { COLORS } from "./constants/theme";

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
  // uid passed through so useCareerPath can recover selectedRole from a
  // saved assessment when it's null (refresh, or right after Quit Role) —
  // see useCareerPath.js's skills-fetch effect for why.
  const careerPath = useCareerPath(auth.user?.uid);
  const profileCompletion = useProfileCompletion(auth.user);
  // Remembers which page was open across a browser refresh, so refreshing
  // "Profile" (or any page) reloads that same page instead of bouncing
  // back to Home/Login.
  //
  // "course-workspace" and "learning-path" used to be excluded from
  // this restore because both need in-memory context (workspaceContext /
  // learningPath below) that only ever lived in useState. Now each
  // one has its own small, persisted "pointer" (see lm_learningPath
  // and lm_workspacePointer below) that's enough to rebuild that
  // context after a refresh — so we only fall back to Learning Hub
  // when that pointer is actually missing (e.g. an older session from
  // before this existed, or someone landed here with no in-progress
  // session at all).
  const [activeKey, setActiveKey] = useState(() => {
    const saved = localStorage.getItem("lm_activeKey");
    if (saved === "course-workspace") {
      return localStorage.getItem("lm_workspacePointer") ? "course-workspace" : "roadmap";
    }
    if (saved === "learning-path") {
      return localStorage.getItem("lm_learningPath") ? "learning-path" : "roadmap";
    }
    return saved || "home";
  });
  const [showSignup, setShowSignup] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  // { skill, topic } — restored synchronously from localStorage on a
  // fresh mount when we're reopening straight into the Learning Path
  // screen. No focusBand/skillLevel needed here (unlike the old
  // Learning Session pointer this replaces) — LearningPathScreen /
  // LearningPathPane derive the whole band sequence themselves from
  // the signed-in learner's roadmap via GET /learning/path/<skill>/<topic>,
  // never from a client-supplied band.
  const [learningPath, setLearningPath] = useState(() => {
    if (localStorage.getItem("lm_activeKey") !== "learning-path") return null;
    try {
      const raw = localStorage.getItem("lm_learningPath");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  // { roadmap, compressedSyllabus, initialEntry } — NOT restorable
  // synchronously (needs a network round trip keyed by uid), so this
  // starts null even when reopening into Course Workspace; the effect
  // below fills it back in once auth.user.uid is known. See the
  // "workspaceRestoring" content branch further down for the brief
  // loading state in between.
  const [workspaceContext, setWorkspaceContext] = useState(null);

  // Lifted cache for RoadmapScreen — { roadmap, compressedSyllabus } | null.
  // RoadmapScreen unmounts every time the learner navigates to a different
  // tab (Course Workspace, Learning Session, etc.), which used to mean it
  // re-fetched and re-showed the full "Loading your roadmap…" spinner on
  // every single return trip. Keeping the last-loaded copy up here, in a
  // component that stays mounted for the whole session, lets RoadmapScreen
  // paint instantly from cache and only refresh quietly in the background.
  const [roadmapCache, setRoadmapCache] = useState(null);

  // "Skill Selection" (My Career Path submenu) means two different things
  // depending on whether a role is locked in: the initial "what do you
  // already know" picker (SkillSelectionScreen) before any roadmap
  // exists, or a live mastered/in-progress skills view (
  // SkillProgressScreen) once one does. Re-checked every time this page
  // is opened so it reflects a just-finished assessment or a just-quit
  // role without needing a full reload.
  const [skillsPageCheck, setSkillsPageCheck] = useState({ checking: true, locked: false, error: false });
  // Bumped to force a re-run of the check effect below when the person
  // taps "Try again" after a failed check (changing this without
  // changing activeKey/uid still re-triggers the effect).
  const [skillsCheckRetry, setSkillsCheckRetry] = useState(0);

  useEffect(() => {
    if (activeKey !== "skills") return;
    let active = true;
    setSkillsPageCheck({ checking: true, locked: false, error: false });
    if (!auth.user?.uid) {
      setSkillsPageCheck({ checking: false, locked: false, error: false });
      return;
    }
    getCachedRoadmap(auth.user.uid)
      .then((roadmap) => {
        if (active) setSkillsPageCheck({ checking: false, locked: !!roadmap, error: false });
      })
      .catch(() => {
        // IMPORTANT: a failed check (e.g. the backend cold-starting on
        // Render's free tier and timing out — see aiAssessmentService.js)
        // must NOT be treated as "no roadmap yet". Silently falling
        // through to locked: false here is exactly what made students
        // who had already started learning get sent back through Skill
        // Selection from scratch whenever this request happened to be
        // slow/flaky. Surface a retry instead of guessing.
        if (active) setSkillsPageCheck({ checking: false, locked: false, error: true });
      });
    return () => {
      active = false;
    };
  }, [activeKey, auth.user?.uid, skillsCheckRetry]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [auth.isAuthenticated, activeKey]);

  useEffect(() => {
    localStorage.setItem("lm_activeKey", activeKey);
  }, [activeKey]);

  // Keep the Learning Path pointer in sync so a refresh while on that
  // screen can restore it directly (see the lazy useState above).
  useEffect(() => {
    if (learningPath) {
      localStorage.setItem("lm_learningPath", JSON.stringify(learningPath));
    } else {
      localStorage.removeItem("lm_learningPath");
    }
  }, [learningPath]);

  // Rebuild Course Workspace's context after a refresh. Unlike Learning
  // Session, this can't be done synchronously — roadmap/compressedSyllabus
  // have to be re-fetched from the backend (they're never persisted
  // client-side), and that fetch needs auth.user.uid, which isn't known
  // until Firebase finishes initializing. The actual "which topic" pointer
  // (lm_workspacePointer) is written continuously by CourseWorkspaceScreen
  // itself as the learner moves between topics, so this restores the
  // exact topic last viewed, not just the one Course Workspace was
  // originally opened on.
  useEffect(() => {
    if (activeKey !== "course-workspace" || workspaceContext || !auth.user?.uid) return;
    const raw = localStorage.getItem("lm_workspacePointer");
    if (!raw) {
      setActiveKey("roadmap");
      return;
    }
    let pointer;
    try {
      pointer = JSON.parse(raw);
    } catch {
      setActiveKey("roadmap");
      return;
    }
    let active = true;
    getCachedRoadmap(auth.user.uid)
      .then((roadmap) => {
        if (!active) return;
        if (!roadmap) {
          // No saved roadmap for this account (e.g. role was quit in
          // another tab) — nothing to rebuild the workspace from.
          setActiveKey("roadmap");
          return;
        }
        setWorkspaceContext({
          roadmap,
          compressedSyllabus: roadmap.compressedSyllabus,
          initialEntry: pointer,
        });
      })
      .catch(() => {
        // Backend hiccup (e.g. Render cold start) — same "don't guess,
        // just fall back to a page that definitely works" approach as
        // the Skill Selection check above.
        if (active) setActiveKey("roadmap");
      });
    return () => {
      active = false;
    };
  }, [activeKey, workspaceContext, auth.user?.uid]);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.uid) {
      pingActivity(auth.user.uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated, auth.user?.uid]);

  // Wait for Firebase to confirm whether a session already exists before
  // deciding what to show — otherwise a refresh on any authenticated page
  // would flash/fall through to the landing page for a moment.
  if (auth.initializing) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: "100vh" }}>
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Logo />
          </motion.div>
          <p className="text-xs font-medium tracking-wide" style={{ color: COLORS.textMid }}>
            Please Wait
          </p>
        </div>
      </PageShell>
    );
  }

  if (!auth.isAuthenticated) {
    // Public landing page — shown first, before Login/Signup. "Login" in
    // the top-right and "Get Started" both drop into the Login screen
    // (which itself links to Sign Up for people without an account yet).
    if (showLanding) {
      // Public landing page, wrapped in the SAME sidebar used everywhere
      // else in the app (locked=true) — "Home" is clickable, every other
      // section is dimmed with a lock icon and prompts login when tapped.
      return (
        <DashboardLayout
          activeKey="home"
          onNavigate={() => {}}
          onLogout={() => {}}
          locked
          onLoginRequired={() => setShowLanding(false)}
        >
          <HomeScreen onGetStarted={() => setShowLanding(false)} />
        </DashboardLayout>
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
      <CareerStatusScreen
        uid={auth.user?.uid}
        displayName={auth.user?.displayName}
        roles={careerPath.roles}
        rolesLoading={careerPath.rolesLoading}
        selectedRole={careerPath.selectedRole}
        onSelectRole={careerPath.selectRole}
        onContinue={() => setActiveKey("skills")}
        onNavigate={setActiveKey}
      />
    );
  } else if (activeKey === "skills") {
    if (skillsPageCheck.checking) {
      content = (
        <div className="px-4 sm:px-8 pt-24 flex justify-center">
          <p className="text-sm" style={{ color: COLORS.textMid }}>Loading…</p>
        </div>
      );
    } else if (skillsPageCheck.error) {
      // Couldn't confirm whether this account already has a roadmap —
      // show Skill Selection anyway and a student who already picked
      // skills could end up redoing it. Ask them to retry instead.
      content = (
        <div className="px-4 sm:px-8 pt-24 flex flex-col items-center gap-3 text-center">
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            Couldn't check your progress — the server may still be starting up.
          </p>
          <button
            onClick={() => setSkillsCheckRetry((n) => n + 1)}
            className="text-sm font-semibold px-4 py-2"
            style={{ borderRadius: 9999, background: COLORS.purple, color: "#fff", border: "none", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      );
    } else if (skillsPageCheck.locked) {
      content = (
        <SkillProgressScreen
          uid={auth.user?.uid}
          onNavigate={setActiveKey}
          onSelectSkill={(entry) => {
            const topic = entry.currentTopic || entry.skill;
            setLearningPath({ skill: entry.skill, topic });
            setActiveKey("learning-path");
          }}
        />
      );
    } else {
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
    }
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
    content = (
      <RoadmapScreen
        uid={auth.user?.uid}
        onNavigate={setActiveKey}
        cachedRoadmap={roadmapCache}
        onRoadmapLoaded={(partial) => {
          if (partial?.reset) {
            setRoadmapCache(null);
            return;
          }
          setRoadmapCache((prev) => ({ ...(prev || {}), ...partial }));
        }}
        onSelectTopic={(entry) => {
          // Prefer the learner's actual CURRENT topic within this skill
          // (RoadmapDisplay.jsx's withCurrentTopic(), sourced from
          // compressedSyllabus's Verified/Current/Locked breakdown) so
          // learning resources are fetched for the SPECIFIC topic being
          // studied, not a generic skill-level search. Falls back to the
          // skill name itself when no topic-level data exists for this
          // skill (role/skill not topic-seeded yet) — same "one learning
          // session per roadmap week" behavior as before in that case.
          const topic = entry.currentTopic || entry.skill;
          setLearningPath({ skill: entry.skill, topic });
          setActiveKey("learning-path");
        }}
        onStartJourney={(context) => {
          setWorkspaceContext(context);
          setActiveKey("course-workspace");
        }}
        onRoleQuit={() => {
          // Backend already wiped the saved assessment + roadmap
          // (RoadmapScreen -> quitRole()) — reset in-memory career path
          // state too, so RoleSelectionScreen doesn't show the just-quit
          // role as still "Selected", then send them to Role Selection.
          careerPath.selectRole(null);
          // workspaceContext still holds the OLD compressedSyllabus (the
          // Verified/Current/Locked tree) and learningPath still
          // points at a topic from the quit role — without clearing
          // these, Course Workspace/Learning Path keep showing pages
          // as Locked using stale pre-quit data even after the backend
          // roadmap is gone.
          setWorkspaceContext(null);
          setLearningPath(null);
          setActiveKey("role");
        }}
      />
    );
  } else if (activeKey === "course-workspace" && !workspaceContext) {
    // Waiting on the restore effect above to re-fetch the roadmap after
    // a refresh (or, on a fresh navigation within the same session,
    // this simply never matches since workspaceContext is set
    // synchronously by onStartJourney before activeKey changes).
    content = (
      <div className="px-4 sm:px-8 pt-24 flex justify-center">
        <p className="text-sm" style={{ color: COLORS.textMid }}>Loading…</p>
      </div>
    );
  } else if (activeKey === "course-workspace" && workspaceContext) {
    content = (
      <CourseWorkspaceScreen
        roadmap={workspaceContext.roadmap}
        compressedSyllabus={workspaceContext.compressedSyllabus}
        initialEntry={workspaceContext.initialEntry}
        uid={auth.user?.uid}
        onBack={() => setActiveKey("roadmap")}
      />
    );
  } else if (activeKey === "learning-path" && learningPath) {
    content = (
      <LearningPathScreen
        skill={learningPath.skill}
        topic={learningPath.topic}
        onBack={() => setActiveKey("roadmap")}
      />
    );
  } else if (activeKey === "profile") {
    // "My Profile" > "Overview" — the main profile hub (see
    // constants/navigation.js for the dropdown's other two entries).
    content = <ProfileScreen onNavigate={setActiveKey} />;
  } else if (activeKey === "revision") {
    content = <RevisionScheduleScreen uid={auth.user?.uid} />;
  } else if (activeKey === "ai") {
    content = <AIStudyAssistantScreen uid={auth.user?.uid} />;
  } else {
    const label =
      NAV_SECTIONS.flatMap((s) => s.children || []).find((c) => c.key === activeKey)?.label ||
      "Coming Soon";
    content = <ComingSoonScreen label={label} onBack={() => setActiveKey("role")} />;
  }

  const handleLogout = async () => {
    await auth.logout();
    localStorage.removeItem("lm_activeKey");
    localStorage.removeItem("lm_learningPath");
    localStorage.removeItem("lm_workspacePointer");
    setRoadmapCache(null); // don't leak this account's roadmap into the next login
    setActiveKey("home");
  };

  return (
    <DashboardLayout
      activeKey={activeKey}
      onNavigate={setActiveKey}
      onLogout={handleLogout}
      profileName={auth.user?.displayName}
    >
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
