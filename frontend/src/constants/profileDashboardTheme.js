import { COLORS } from "./theme";

/**
 * profileDashboardTheme — dark theme tokens for the "My Profile"
 * dashboard (screens/ProfileScreen.jsx), built strictly from the real
 * LearnMatrix brand palette in constants/theme.js (navy #0D1B3D + gold
 * #D4A017 / #E8B93D) — no unrelated hues.
 *
 * Like constants/theme.js itself, the key names (accentPurple,
 * accentTeal, etc.) are kept as-is even though every one of them now
 * resolves to a navy/gold tone — components just read DASH.accentX and
 * never hardcode a color, so the whole dashboard re-themes from this
 * one file.
 */
export const DASH = {
  page: COLORS.sky,                        // #0D1B3D navy page background
  card: "#16264F",                         // lighter navy panel
  cardAlt: "#101D3F",
  border: "rgba(232,185,61,0.16)",         // faint gold-tinted border
  textPrimary: COLORS.white,
  textMid: "#C7CEDE",                      // light navy-gray on dark bg
  textLight: "#8A93A8",                    // COLORS.textLight

  // Every accent below is a navy/gold tone — no other hues.
  accentPurple: COLORS.purple,             // #D4A017 gold — primary
  accentPurpleSoft: "rgba(212,160,23,0.16)",
  accentTeal: COLORS.pink,                 // #E8B93D lighter gold — secondary
  accentTealSoft: "rgba(232,185,61,0.16)",
  accentOrange: COLORS.purple,             // gold
  accentOrangeSoft: "rgba(212,160,23,0.16)",
  accentPink: COLORS.pink,                 // lighter gold
  accentPinkSoft: "rgba(232,185,61,0.16)",
  accentGreen: COLORS.pink,                // lighter gold
  accentGreenSoft: "rgba(232,185,61,0.16)",

  trackBg: "rgba(255,255,255,0.08)",
};
