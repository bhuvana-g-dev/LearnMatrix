import { motion } from "framer-motion";
import { COLORS, GLASS_CARD } from "../../constants/theme";

/**
 * SectionCard — the shared glassmorphism card + header pattern every
 * My Profile section uses. Keeps the 7 sections visually consistent
 * with each other and with the rest of LearnMatrix (same GLASS_CARD
 * token, same fade/slide-in animation as RoleSelectionScreen cards).
 */
export default function SectionCard({ icon: Icon, title, subtitle, children, delay = 0, theme, illustration }) {
  const cardStyle = theme
    ? {
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        boxShadow: GLASS_CARD.boxShadow,
        backdropFilter: GLASS_CARD.backdropFilter,
        WebkitBackdropFilter: GLASS_CARD.WebkitBackdropFilter,
        borderRadius: 28,
      }
    : { ...GLASS_CARD, borderRadius: 28 };
  const titleColor = theme ? theme.textDark : COLORS.textDark;
  const subtitleColor = theme ? theme.textMid : COLORS.textMid;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="p-6 sm:p-7 mb-6"
      style={cardStyle}
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(192,132,252,0.35), rgba(125,211,252,0.3))" }}
            >
              <Icon size={18} color={COLORS.purple} />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold" style={{ color: titleColor }}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: subtitleColor }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {illustration && (
          <div className="hidden sm:flex flex-shrink-0 items-center justify-center">
            {illustration}
          </div>
        )}
      </div>
      {children}
    </motion.section>
  );
}
