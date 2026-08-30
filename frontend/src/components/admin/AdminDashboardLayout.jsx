import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu } from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import Logo from "../common/Logo";
import { COLORS, GLASS_CARD, GRADIENTS } from "../../constants/theme";

// Deliberately NOT using PageShell/FloatingOrbs here. FloatingOrbs
// renders 5 blurred divs animating with framer-motion's `repeat:
// Infinity` — continuous GPU/CPU work for as long as the tab stays
// open. That's fine for a short-lived marketing page, but the admin
// panel is a long-running, data-dense session (tables, filters,
// modals) — it's exactly the kind of tab Chrome flags as "using extra
// resources" when a decorative background never stops animating. A
// static gradient gives the same visual base with none of the cost.
export default function AdminDashboardLayout({ activeKey, onNavigate, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: GRADIENTS.pageBg }}>
      <div className="flex" style={{ minHeight: "100vh" }}>
        {/* Desktop sidebar — position: fixed (not sticky) so it stays
            pinned to the viewport regardless of how tall the page
            content grows or what any ancestor's overflow/scroll
            setting is. The main content column below gets a matching
            left margin so nothing renders underneath it. */}
        <aside
          className="hidden lg:block"
          style={{
            width: 280,
            flexShrink: 0,
            ...GLASS_CARD,
            borderRadius: 0,
            borderRight: `1px solid ${COLORS.border}`,
            position: "fixed",
            top: 0,
            left: 0,
            height: "100vh",
            zIndex: 30,
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

        {/* Main content — lg:ml-[280px] offsets the fixed desktop
            sidebar's width; on mobile the sidebar is an overlay drawer,
            not part of the flow, so no offset is needed there. */}
        <div className="flex-1 min-w-0 lg:ml-[280px]">
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
    </div>
  );
}
