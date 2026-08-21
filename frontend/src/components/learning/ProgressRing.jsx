import { COLORS } from "../../constants/theme";

/**
 * ProgressRing — a small circular outline with an arc filled
 * proportional to `percent` (0-100). Used in the Course Material
 * sidebar (CourseWorkspaceScreen) so a skill/module with SOME but not
 * all lessons done (e.g. 2 of 4) shows a semi-filled ring instead of
 * the plain empty Circle / solid CheckCircle2 used for 0% / 100%.
 *
 * Purely presentational — the caller decides when to render this vs.
 * the empty/complete icons (see skillProgress/moduleProgress in
 * CourseWorkspaceScreen.jsx).
 */
export default function ProgressRing({ percent = 0, size = 12, strokeWidth = 2, color, trackColor }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const c = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0, transform: "rotate(-90deg)" }}
      aria-label={`${Math.round(clamped)}% complete`}
    >
      <circle cx={c} cy={c} r={radius} fill="none" stroke={trackColor || COLORS.border} strokeWidth={strokeWidth} />
      <circle
        cx={c}
        cy={c}
        r={radius}
        fill="none"
        stroke={color || COLORS.purple}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}
