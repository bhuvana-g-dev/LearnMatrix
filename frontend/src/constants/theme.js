/**
 * Design tokens for the LearnMatrix UI.
 *
 * Brand palette: navy (#0D1B3D) + gold (#D4A017), per the LearnMatrix logo.
 * Key names (purple, pink, sky, etc.) are kept as-is even though the
 * actual colors are now navy/gold — every screen/component references
 * these key names, so keeping them means the whole app re-themes just by
 * editing this one file.
 *
 * This preview/production environment historically had issues with Tailwind
 * arbitrary-value classes (e.g. bg-[#C084FC]) not compiling reliably, so
 * custom colors/gradients/radii/shadows are applied via inline style objects
 * built from these constants rather than bracket classes. Layout, spacing,
 * and typography still use normal Tailwind utility classes.
 */

export const COLORS = {
  lavender: "#FBF3E1",   // soft gold tint, used for light backgrounds
  purple: "#D4A017",     // primary brand accent (gold)
  pink: "#E8B93D",       // secondary accent (lighter gold)
  sky: "#0D1B3D",        // primary brand accent (navy)
  white: "#FFFFFF",
  textDark: "#0D1B3D",   // navy
  textMid: "#3E4A66",    // muted navy-gray
  textLight: "#8A93A8",  // light navy-gray
  border: "#DCE1EA",
};

export const GRADIENTS = {
  purplePink: `linear-gradient(90deg, ${COLORS.purple}, ${COLORS.pink})`,
  purpleSky: `linear-gradient(90deg, ${COLORS.purple}, ${COLORS.sky})`,
  pageBg: `linear-gradient(135deg, ${COLORS.lavender} 0%, rgba(212,160,23,0.12) 50%, rgba(13,27,61,0.10) 100%)`,
};

export const GLASS_CARD = {
  background: "rgba(255,255,255,0.55)",
  border: "1px solid rgba(255,255,255,0.7)",
  boxShadow: "0 8px 40px rgba(13,27,61,0.18)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
};
