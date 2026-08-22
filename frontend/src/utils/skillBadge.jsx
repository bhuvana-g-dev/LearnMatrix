import { Code2 } from "lucide-react";

/**
 * Skill -> small brand badge (background color + short label) shown next
 * to each revision item, and reused as that item's left accent border so
 * the two visually tie together. These are hand-picked approximations of
 * each technology's brand color, not reproductions of any logo artwork —
 * consistent with the "shapes only, no external image assets" approach
 * RobotMascot already uses elsewhere in the app (screens/HomeScreen.jsx).
 * Covers the skill names listed in constants/skills.js; anything else
 * falls back to a generic gold code-icon badge below.
 */
export const SKILL_BRAND = {
  HTML5: { bg: "#E44D26", color: "#fff", label: "5" },
  HTML: { bg: "#E44D26", color: "#fff", label: "5" },
  CSS3: { bg: "#2965F1", color: "#fff", label: "3" },
  CSS: { bg: "#2965F1", color: "#fff", label: "3" },
  "CSS Animations": { bg: "#2965F1", color: "#fff", label: "3" },
  JavaScript: { bg: "#F0DB4F", color: "#4A4200", label: "JS" },
  TypeScript: { bg: "#3178C6", color: "#fff", label: "TS" },
  Bootstrap: { bg: "#7952B3", color: "#fff", label: "B" },
  "Tailwind CSS": { bg: "#0EA5E9", color: "#fff", label: "TW" },
  "React.js": { bg: "#149ECA", color: "#fff", label: "R" },
  "Next.js": { bg: "#111827", color: "#fff", label: "N" },
  "Node.js": { bg: "#3C873A", color: "#fff", label: "JS" },
  "Express.js": { bg: "#1F2933", color: "#fff", label: "Ex" },
  MySQL: { bg: "#00758F", color: "#fff", label: "My" },
  MongoDB: { bg: "#47A248", color: "#fff", label: "Mo" },
  PostgreSQL: { bg: "#336791", color: "#fff", label: "Pg" },
  Git: { bg: "#F05032", color: "#fff", label: "Git" },
  GitHub: { bg: "#181717", color: "#fff", label: "Gh" },
  "REST API": { bg: "#6C63FF", color: "#fff", label: "API" },
  Postman: { bg: "#FF6C37", color: "#fff", label: "Pm" },
  "Firebase (Basics)": { bg: "#FFCA28", color: "#4A3B00", label: "Fb" },
  Firebase: { bg: "#FFCA28", color: "#4A3B00", label: "Fb" },
  Vite: { bg: "#646CFF", color: "#fff", label: "V" },
  Python: { bg: "#3776AB", color: "#fff", label: "Py" },
  Java: { bg: "#E76F00", color: "#fff", label: "Jv" },
  Kotlin: { bg: "#7F52FF", color: "#fff", label: "K" },
  "C++": { bg: "#00599C", color: "#fff", label: "C++" },
  "Docker (Basics)": { bg: "#2496ED", color: "#fff", label: "Do" },
  Docker: { bg: "#2496ED", color: "#fff", label: "Do" },
  Kubernetes: { bg: "#326CE5", color: "#fff", label: "K8s" },
  AWS: { bg: "#FF9900", color: "#3E2900", label: "AWS" },
  "Microsoft Azure": { bg: "#0078D4", color: "#fff", label: "Az" },
  "Google Cloud Platform": { bg: "#4285F4", color: "#fff", label: "GC" },
  Linux: { bg: "#2E2E2E", color: "#fff", label: "Lx" },
  SQL: { bg: "#4479A1", color: "#fff", label: "SQL" },
  NumPy: { bg: "#013243", color: "#fff", label: "Np" },
  Pandas: { bg: "#150458", color: "#fff", label: "Pd" },
  Matplotlib: { bg: "#11557C", color: "#fff", label: "Mp" },
  "Scikit-learn": { bg: "#F7931E", color: "#3E2900", label: "Sk" },
  TensorFlow: { bg: "#FF6F00", color: "#fff", label: "TF" },
  PyTorch: { bg: "#EE4C2C", color: "#fff", label: "PT" },
  "Power BI": { bg: "#F2C811", color: "#4A3B00", label: "BI" },
  Tableau: { bg: "#E97627", color: "#fff", label: "Tb" },
  "Jupyter Notebook": { bg: "#F37626", color: "#fff", label: "Jn" },
};

/** Left accent color used on each revision-item card, tied to the badge. */
export function brandColorFor(skill) {
  return SKILL_BRAND[skill]?.bg || "#D4A017";
}

/** Small rounded-square badge with a skill's brand color + short label. */
export function SkillIcon({ skill, size = 40 }) {
  const brand = SKILL_BRAND[skill];
  const wrapStyle = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.32),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  if (!brand) {
    return (
      <div style={{ ...wrapStyle, background: "rgba(212,160,23,0.14)" }}>
        <Code2 size={Math.round(size * 0.5)} color="#D4A017" />
      </div>
    );
  }

  return (
    <div
      style={{
        ...wrapStyle,
        background: brand.bg,
        color: brand.color,
        fontWeight: 800,
        fontSize: Math.round(size * 0.32),
        letterSpacing: "-0.02em",
      }}
    >
      {brand.label}
    </div>
  );
}
