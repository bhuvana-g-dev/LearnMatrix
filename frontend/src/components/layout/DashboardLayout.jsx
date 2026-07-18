import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import PageShell from "./PageShell";
import SidebarContent from "./SidebarContent";
import Logo from "../common/Logo";
import { COLORS, GLASS_CARD } from "../../constants/theme";

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 70;

// Tablet (768–1023px) starts collapsed by default; desktop (≥1024px)
// starts expanded. Read once at mount — the user's manual toggle takes
// over from there, so resizing the window later doesn't fight them.
function getInitialCollapsed() {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= 768 && window.innerWidth < 1024;
}

export default function DashboardLayout({ activeKey, onNavigate, onLogout, children, locked = false, onLoginRequired }) {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ESC closes the mobile drawer from anywhere.
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <PageShell>
      <div style={{ minHeight: "100vh" }}>
        {/* Persistent sidebar (tablet + desktop, ≥768px) — fixed to the
            viewport so it always spans full height and never scrolls
            with the page, however tall the main content gets. */}
        <motion.aside
          className="hidden md:block"
          initial={false}
          animate={{ width: sidebarWidth }}
          transition={{ duration: 0.28, ease: "easeInOut" }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            height: "100vh",
            zIndex: 20,
            ...GLASS_CARD,
            borderRadius: 0,
            borderRight: `1px solid ${COLORS.border}`,
            overflow: "hidden",
          }}
        >
          <SidebarContent
            activeKey={activeKey}
            onNavigate={onNavigate}
            onLogout={onLogout}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((prev) => !prev)}
            locked={locked}
            onLoginRequired={onLoginRequired}
          />
        </motion.aside>

        {/* Mobile off-canvas drawer (<768px) */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(59,32,99,0.35)", zIndex: 40 }}
                className="md:hidden"
              />
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", stiffness: 300, damping: 32 }}
                style={{ position: "fixed", top: 0, left: 0, height: "100vh", width: 280, zIndex: 50, ...GLASS_CARD, borderRadius: 0 }}
                className="md:hidden"
              >
                <SidebarContent
                  activeKey={activeKey}
                  onNavigate={(k) => {
                    onNavigate(k);
                    setMobileOpen(false);
                  }}
                  onLogout={onLogout}
                  collapsed={false}
                  onClose={() => setMobileOpen(false)}
                  locked={locked}
                  onLoginRequired={() => {
                    setMobileOpen(false);
                    onLoginRequired?.();
                  }}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content — margin-left tracks the persistent sidebar's
            width so nothing is ever hidden behind it, and resizes
            smoothly (no gap, no horizontal scroll) as it collapses. */}
        <div
          className={`min-w-0 transition-[margin-left] duration-300 ease-in-out ${
            collapsed ? "md:ml-[70px]" : "md:ml-[280px]"
          }`}
        >
          {/* Sticky mobile top bar — stays pinned at the top of the
              viewport regardless of scroll, so the menu toggle is
              always reachable. */}
          <div
            className="flex items-center justify-between px-4 sm:px-8 py-4 md:hidden"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              borderBottom: `1px solid ${COLORS.border}`,
              background: "rgba(255,255,255,0.55)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
            }}
          >
            <Logo />
            <button
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              style={{ background: "rgba(255,255,255,0.6)", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 8, cursor: "pointer" }}
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
