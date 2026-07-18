import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, X, LogOut, Lock, LogIn } from "lucide-react";
import Logo from "../common/Logo";
import { COLORS, GRADIENTS } from "../../constants/theme";
import { NAV_SECTIONS } from "../../constants/navigation";
// Which section (if any) currently "owns" this activeKey — either the
// section's own key (selfNavigable, e.g. "home"/"profile") or one of its
// children.
function findSectionKeyForActiveKey(key) {
  const section = NAV_SECTIONS.find(
    (s) => s.key === key || (s.children && s.children.some((c) => c.key === key))
  );
  return section ? section.key : null;
}

// Label text that fades/collapses in and out as the sidebar toggles —
// shared by section titles, child labels, and the Logout button.
function FadeLabel({ show, children }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: "auto" }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.15 }}
          style={{ overflow: "hidden", whiteSpace: "nowrap" }}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/**
 * SidebarContent — reused by both the persistent (tablet/desktop) sidebar
 * and the mobile off-canvas drawer.
 *
 * `collapsed` (persistent sidebar only): icon-only mode, ~70px, no labels,
 * no chevrons. Clicking a collapsed section that has children expands the
 * sidebar and opens that section in one motion.
 *
 * `onToggleCollapse`: renders the collapse/expand chevron — pass only from
 * the persistent sidebar.
 * `onClose`: renders a close (X) button — pass only from the mobile drawer.
 */
export default function SidebarContent({
  activeKey,
  onNavigate,
  onLogout,
  collapsed = false,
  onToggleCollapse,
  onClose,
  locked = false,
  onLoginRequired,
}) {
  const [openKey, setOpenKey] = useState(() => findSectionKeyForActiveKey(activeKey));

  useEffect(() => {
    const sectionKey = findSectionKeyForActiveKey(activeKey);
    if (sectionKey) setOpenKey(sectionKey);
  }, [activeKey]);

  const toggleSection = (key) => setOpenKey((prev) => (prev === key ? null : key));

  // In collapsed mode there's no room for a dropdown — clicking a section
  // with children expands the sidebar first, then opens that section.
  const expandAndOpen = (key) => {
    onToggleCollapse?.();
    setOpenKey(key);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-6 pb-4 flex items-center justify-between gap-2">
        {!collapsed && <Logo />}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: "rgba(255,255,255,0.5)",
              border: `1px solid ${COLORS.border}`,
              cursor: "pointer",
              marginLeft: collapsed ? "auto" : 0,
              marginRight: collapsed ? "auto" : 0,
            }}
          >
            {collapsed ? (
              <ChevronRight size={14} color={COLORS.textDark} />
            ) : (
              <ChevronLeft size={14} color={COLORS.textDark} />
            )}
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: "rgba(255,255,255,0.5)",
              border: `1px solid ${COLORS.border}`,
              cursor: "pointer",
            }}
          >
            <X size={14} color={COLORS.textDark} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {NAV_SECTIONS.map((section) => {
          const SectionIcon = section.icon;
          const hasChildren = section.children && section.children.length > 0;

          // No children at all (e.g. "Home") — plain single-link button,
          // no chevron, no dropdown, ever.
          if (!hasChildren) {
            const isActive = activeKey === section.key;
            return (
              <button
                key={section.key}
                onClick={() => onNavigate(section.key)}
                title={collapsed ? section.title : undefined}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold mb-1.5 transition-all"
                style={{
                  color: isActive ? "#fff" : COLORS.textDark,
                  background: isActive ? GRADIENTS.purplePink : "transparent",
                  border: "none",
                  borderLeft: isActive ? "3px solid #fff" : "3px solid transparent",
                  cursor: "pointer",
                  boxShadow: isActive ? "0 4px 12px rgba(192,132,252,0.4)" : "none",
                  justifyContent: collapsed ? "center" : "flex-start",
                }}
              >
                <SectionIcon size={16} color={isActive ? "#fff" : COLORS.purple} />
                <FadeLabel show={!collapsed}>{section.title}</FadeLabel>
              </button>
            );
          }

          const isOpen = !collapsed && openKey === section.key;
          // Only true for "My Profile": its header is itself a page link,
          // separate from the chevron which just opens/closes the dropdown.
          const isHeaderActive = section.selfNavigable && activeKey === section.key;

          // Pre-login landing page: everything except "Home" is locked —
          // clicking prompts login instead of navigating/expanding.
          const isLocked = locked && section.key !== "home";

          const handleHeaderClick = () => {
            if (isLocked) {
              onLoginRequired?.();
              return;
            }
            if (collapsed) {
              if (section.selfNavigable) onNavigate(section.key);
              expandAndOpen(section.key);
              return;
            }
            if (section.selfNavigable) {
              onNavigate(section.key);
              setOpenKey(section.key);
            } else {
              toggleSection(section.key);
            }
          };

          return (
            <div key={section.key} className="mb-1.5">
              <div
                className="w-full flex items-center justify-between rounded-xl text-sm font-semibold transition-all"
                style={{
                  color: isHeaderActive ? "#fff" : isLocked ? COLORS.textLight : COLORS.textDark,
                  background: isHeaderActive ? GRADIENTS.purplePink : "transparent",
                  borderLeft: isHeaderActive ? "3px solid #fff" : "3px solid transparent",
                  boxShadow: isHeaderActive ? "0 4px 12px rgba(192,132,252,0.4)" : "none",
                  opacity: isLocked ? 0.6 : 1,
                }}
              >
                <button
                  onClick={handleHeaderClick}
                  title={collapsed ? section.title : isLocked ? "Login to unlock" : undefined}
                  className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "inherit",
                    font: "inherit",
                    justifyContent: collapsed ? "center" : "flex-start",
                  }}
                >
                  <SectionIcon size={16} color={isHeaderActive ? "#fff" : isLocked ? COLORS.textLight : COLORS.purple} />
                  <FadeLabel show={!collapsed}>{section.title}</FadeLabel>
                </button>

                {!collapsed && isLocked && (
                  <span className="px-3 py-2.5 flex items-center">
                    <Lock size={13} color={COLORS.textLight} />
                  </span>
                )}

                {!collapsed && !isLocked && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSection(section.key);
                    }}
                    aria-label={isOpen ? "Collapse section" : "Expand section"}
                    className="px-3 py-2.5"
                    style={{ background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: "flex" }}
                    >
                      <ChevronDown size={14} color={isHeaderActive ? "#fff" : COLORS.textLight} />
                    </motion.span>
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="pl-9 pr-1 py-1 flex flex-col gap-0.5">
                      {section.children.map((child) => {
                        const isActive = activeKey === child.key;
                        return (
                          <button
                            key={child.key}
                            onClick={() => onNavigate(child.key)}
                            className="text-left text-xs sm:text-sm py-2 px-3 rounded-lg transition-all"
                            style={{
                              color: isActive ? "#fff" : COLORS.textMid,
                              background: isActive ? GRADIENTS.purplePink : "transparent",
                              fontWeight: isActive ? 600 : 500,
                              border: "none",
                              borderLeft: isActive ? "3px solid #fff" : "3px solid transparent",
                              cursor: "pointer",
                              boxShadow: isActive ? "0 4px 12px rgba(192,132,252,0.4)" : "none",
                            }}
                          >
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="px-3 pb-5 pt-2" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        {locked ? (
          <button
            onClick={onLoginRequired}
            title={collapsed ? "Login" : undefined}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold mt-2"
            style={{
              color: "#fff",
              background: GRADIENTS.purpleSky,
              border: "none",
              cursor: "pointer",
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <LogIn size={16} />
            <FadeLabel show={!collapsed}>Login</FadeLabel>
          </button>
        ) : (
          <button
            onClick={onLogout}
            title={collapsed ? "Logout" : undefined}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold mt-2"
            style={{
              color: "#E4568A",
              background: "rgba(240,171,252,0.15)",
              border: "none",
              cursor: "pointer",
              justifyContent: collapsed ? "center" : "flex-start",
            }}
          >
            <LogOut size={16} />
            <FadeLabel show={!collapsed}>Logout</FadeLabel>
          </button>
        )}
      </div>
    </div>
  );
}
