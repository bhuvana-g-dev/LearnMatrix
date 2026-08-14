import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AdminDashboardLayout from "./components/admin/AdminDashboardLayout";
import AdminLoginScreen from "./screens/admin/AdminLoginScreen";
import AdminDashboardScreen from "./screens/admin/AdminDashboardScreen";
import ResourceBankScreen from "./screens/admin/ResourceBankScreen";
import StudentRecordsScreen from "./screens/admin/StudentRecordsScreen";
import LearnerIntelligenceScreen from "./screens/admin/LearnerIntelligenceScreen";
import Logo from "./components/common/Logo";
import { COLORS } from "./constants/theme";
import { useAdminAuth } from "./hooks/useAdminAuth";

/**
 * AdminApp.jsx — thin composition root for the Admin Panel, same pattern
 * as App.jsx for the student side. Kept as a fully separate tree (own
 * auth, own layout, own screens) so nothing about the existing student
 * app/frontend is touched. See RootRouter.jsx for how the two trees are
 * chosen between based on the URL.
 */
export default function AdminApp() {
  const auth = useAdminAuth();
  const [activeKey, setActiveKey] = useState("admin-dashboard");

  // Wait for the saved admin session to be checked before deciding what
  // to show — otherwise a refresh on the admin panel flashes the Login
  // screen for a frame even when the admin is still logged in.
  if (auth.initializing) {
    return (
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
    );
  }

  if (!auth.isAuthenticated) {
    return <AdminLoginScreen auth={auth} onSuccess={() => setActiveKey("admin-dashboard")} />;
  }

  let content;
  if (activeKey === "admin-dashboard") {
    content = <AdminDashboardScreen onNavigate={setActiveKey} />;
  } else if (activeKey === "resource-bank") {
    content = <ResourceBankScreen />;
  } else if (activeKey === "student-records") {
    content = <StudentRecordsScreen />;
  } else if (activeKey === "learner-intelligence") {
    content = <LearnerIntelligenceScreen />;
  }

  return (
    <AdminDashboardLayout activeKey={activeKey} onNavigate={setActiveKey} onLogout={auth.logout}>
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
    </AdminDashboardLayout>
  );
}
