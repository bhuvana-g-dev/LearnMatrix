import { motion } from "framer-motion";
import { COLORS, GLASS_CARD } from "../../constants/theme";

/**
 * SectionCard — the shared glassmorphism card + header pattern every
 * My Profile section uses. Keeps the 7 sections visually consistent
 * with each other and with the rest of LearnMatrix (same GLASS_CARD
 * token, same fade/slide-in animation as RoleSelectionScreen cards).
 */
export default function SectionCard({ icon: Icon, title, subtitle, children, delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="p-6 sm:p-7 mb-6"
      style={{ ...GLASS_CARD, borderRadius: 28 }}
    >
      <div className="flex items-center gap-3 mb-5">
        {Icon && (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, rgba(192,132,252,0.35), rgba(125,211,252,0.3))" }}
          >
            <Icon size={18} color={COLORS.purple} />
          </div>
        )}
        <div>
          <h2 className="text-lg sm:text-xl font-bold" style={{ color: COLORS.textDark }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm" style={{ color: COLORS.textMid }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </motion.section>
  );
}
