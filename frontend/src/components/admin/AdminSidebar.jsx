import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import Logo from "../common/Logo";
import { COLORS, GRADIENTS } from "../../constants/theme";
import { ADMIN_NAV_SECTIONS } from "../../constants/adminNavigation";

export default function AdminSidebar({ activeKey, onNavigate, onLogout }) {
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(ADMIN_NAV_SECTIONS.map((s) => [s.key, true]))
  );

  const toggleSection = (key) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-2">
        <Logo />
      </div>
      <div className="px-5 pb-4">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: "rgba(192,132,252,0.18)", color: COLORS.purple }}
        >
          <ShieldCheck size={12} /> Admin Panel
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {ADMIN_NAV_SECTIONS.map((section) => {
          const SectionIcon = section.icon;
          const isOpen = openSections[section.key];

          // Single-child sections: render as one flat nav item (no
          // redundant "Title" + "Title" subtopic, no chevron/dropdown).
          if (section.children.length === 1) {
            const only = section.children[0];
            const isActive = activeKey === only.key;
            return (
              <div key={section.key} className="mb-1.5">
                <button
                  onClick={() => onNavigate(only.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    color: isActive ? "#fff" : COLORS.textDark,
                    background: isActive ? GRADIENTS.purplePink : "transparent",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: isActive ? "0 4px 12px rgba(192,132,252,0.4)" : "none",
                  }}
                >
                  <SectionIcon size={16} color={isActive ? "#fff" : COLORS.purple} />
                  {section.title}
                </button>
              </div>
            );
          }

          return (
            <div key={section.key} className="mb-1.5">
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold"
                style={{ color: COLORS.textDark, background: "transparent", border: "none", cursor: "pointer" }}
              >
                <span className="flex items-center gap-2.5">
                  <SectionIcon size={16} color={COLORS.purple} />
                  {section.title}
                </span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={14} color={COLORS.textLight} />
                </motion.span>
              </button>

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
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold mt-2"
          style={{ color: "#E4568A", background: "rgba(240,171,252,0.15)", border: "none", cursor: "pointer" }}
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );
}
