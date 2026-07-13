/**
 * Design tokens for the LearnMatrix UI.
 *
 * This preview/production environment historically had issues with Tailwind
 * arbitrary-value classes (e.g. bg-[#C084FC]) not compiling reliably, so
 * custom colors/gradients/radii/shadows are applied via inline style objects
 * built from these constants rather than bracket classes. Layout, spacing,
 * and typography still use normal Tailwind utility classes.
 */

export const COLORS = {
  lavender: "#E8D5FF",
  purple: "#C084FC",
  pink: "#F0ABFC",
  sky: "#7DD3FC",
  white: "#FFFFFF",
  textDark: "#3B2063",
  textMid: "#6B4E96",
  textLight: "#9B7FC7",
  border: "#D9C4F5",
};

export const GRADIENTS = {
  purplePink: `linear-gradient(90deg, ${COLORS.purple}, ${COLORS.pink})`,
  purpleSky: `linear-gradient(90deg, ${COLORS.purple}, ${COLORS.sky})`,
  pageBg: `linear-gradient(135deg, ${COLORS.lavender} 0%, rgba(240,171,252,0.55) 50%, rgba(125,211,252,0.55) 100%)`,
};

export const GLASS_CARD = {
  background: "rgba(255,255,255,0.28)",
  border: "1px solid rgba(255,255,255,0.55)",
  boxShadow: "0 8px 40px rgba(160,100,255,0.22)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
};
