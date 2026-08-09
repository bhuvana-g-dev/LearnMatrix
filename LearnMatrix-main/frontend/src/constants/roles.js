/**
 * Hardcoded role catalog.
 *
 * This is intentionally kept as static data for now (per project brief),
 * but it is isolated here — behind roleService.getRoles() — so swapping it
 * for a real `GET /api/roles` response later means editing ONE service
 * function, not any screen/component.
 */
export const ROLES = [
  { id: "fullstack", emoji: "💻", title: "Full Stack Developer", desc: "Build complete apps end to end", skills: 14 },
  { id: "frontend", emoji: "🎨", title: "Frontend Developer", desc: "Craft beautiful, interactive UI", skills: 12 },
  { id: "backend", emoji: "⚙️", title: "Backend Developer", desc: "Design robust servers & APIs", skills: 12 },
  { id: "aiml", emoji: "🤖", title: "AI / ML Engineer", desc: "Train models that learn & predict", skills: 16 },
  { id: "data", emoji: "📊", title: "Data Analyst", desc: "Turn raw data into real insight", skills: 10 },
  { id: "cloud", emoji: "☁️", title: "Cloud Engineer", desc: "Deploy & scale infrastructure", skills: 13 },
  { id: "cyber", emoji: "🔒", title: "Cyber Security Analyst", desc: "Defend systems from threats", skills: 15 },
  { id: "android", emoji: "📱", title: "Android Developer", desc: "Build native mobile experiences", skills: 11 },
];

export const ROLE_TITLES = ROLES.reduce((acc, role) => {
  acc[role.id] = role.title;
  return acc;
}, {});
