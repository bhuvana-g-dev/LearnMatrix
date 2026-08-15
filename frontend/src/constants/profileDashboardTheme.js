import { COLORS } from "./theme";

/**
 * profileDashboardTheme — theme tokens for the "My Profile" dashboard
 * (screens/ProfileScreen.jsx), built strictly from the real LearnMatrix
 * brand palette in constants/theme.js: light lavender/gold background,
 * navy text, gold accents — matching the rest of the app instead of an
 * unrelated dark theme.
 *
 * Like constants/theme.js itself, the key names (accentPurple,
 * accentTeal, etc.) are kept as-is even though every one of them
 * resolves to a navy/gold tone — components just read DASH.accentX and
 * never hardcode a color, so the whole dashboard re-themes from this
 * one file.
 */
export const DASH = {
  page: COLORS.lavender,                   // #FBF3E1 soft gold-cream page background
  card: COLORS.white,                      // white cards
  cardAlt: COLORS.lavender,
  border: COLORS.border,                   // #DCE1EA
  textPrimary: COLORS.textDark,            // #0D1B3D navy
  textMid: COLORS.textMid,                 // #3E4A66
  textLight: COLORS.textLight,             // #8A93A8

  // Every accent below is a navy/gold tone — no other hues.
  accentPurple: COLORS.purple,             // #D4A017 gold — primary
  accentPurpleSoft: "rgba(212,160,23,0.12)",
  accentTeal: COLORS.pink,                 // #E8B93D lighter gold — secondary
  accentTealSoft: "rgba(232,185,61,0.16)",
  accentOrange: COLORS.purple,             // gold
  accentOrangeSoft: "rgba(212,160,23,0.12)",
  accentPink: COLORS.pink,                 // lighter gold
  accentPinkSoft: "rgba(232,185,61,0.16)",
  accentGreen: COLORS.sky,                 // navy, for a bit of contrast against all-gold
  accentGreenSoft: "rgba(13,27,61,0.08)",

  trackBg: "rgba(13,27,61,0.08)",          // faint navy track for progress bars on white
};
