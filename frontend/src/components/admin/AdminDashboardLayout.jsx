import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import PageShell from "../layout/PageShell";
import AdminSidebar from "./AdminSidebar";
import Logo from "../common/Logo";
import { COLORS, GLASS_CARD } from "../../constants/theme";

export default function AdminDashboardLayout({ activeKey, onNavigate, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <PageShell>
      <div className="flex" style={{ minHeight: "100vh" }}>
        {/* Desktop sidebar */}
        <aside
          className="hidden lg:block"
          style={{
            width: 280,
            flexShrink: 0,
            ...GLASS_CARD,
            borderRadius: 0,
            borderRight: `1px solid ${COLORS.border}`,
            position: "sticky",
            top: 0,
            height: "100vh",
          }}
        >
          <AdminSidebar activeKey={activeKey} onNavigate={onNavigate} onLogout={onLogout} />
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(59,32,99,0.35)", zIndex: 40 }}
                className="lg:hidden"
              />
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", stiffness: 300, damping: 32 }}
                style={{ position: "fixed", top: 0, left: 0, height: "100vh", width: 280, zIndex: 50, ...GLASS_CARD, borderRadius: 0 }}
                className="lg:hidden"
              >
                <AdminSidebar
                  activeKey={activeKey}
                  onNavigate={(k) => {
                    onNavigate(k);
                    setMobileOpen(false);
                  }}
                  onLogout={onLogout}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div
            className="flex items-center justify-between px-4 sm:px-8 py-4 lg:hidden"
            style={{ borderBottom: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.2)" }}
          >
            <Logo />
            <button
              onClick={() => setMobileOpen(true)}
              style={{ background: "rgba(255,255,255,0.5)", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 8, cursor: "pointer" }}
            >
              <Menu size={18} color={COLORS.textDark} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </PageShell>
  );
}
