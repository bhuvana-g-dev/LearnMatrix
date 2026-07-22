
/**
 * insightsTheme — self-contained light/dark theme tokens for the
 * "AI Learning Insights" page (LearningInsightsScreen.jsx). The app
 * doesn't have a global dark-mode system yet, so this page ships its
 * own toggle and its own tiny theme object rather than touching the
 * shared constants/theme.js used everywhere else.
 *
 * Consumed by: AIInsightsSection.jsx, LearningInsightsScreen.jsx,
 * InsightsSkeleton.jsx, and every card under components/profile/insights/.
 */
const LIGHT_THEME = {
  dark: false,
  pageBg: "transparent",
  cardBg: "rgba(255,255,255,0.35)",
  border: "rgba(255,255,255,0.6)",
  track: "rgba(255,255,255,0.5)",
  textDark: "#3B2063",
  textMid: "#7A6A96",
  textLight: "#A99FC2",
};

const DARK_THEME = {
  dark: true,
  pageBg: "#1B1530",
  cardBg: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.12)",
  track: "rgba(255,255,255,0.1)",
  textDark: "#F1ECFB",
  textMid: "#C7BCE0",
  textLight: "#8F82AD",
};

export function getInsightsTheme(dark = false) {
  return dark ? DARK_THEME : LIGHT_THEME;
}
