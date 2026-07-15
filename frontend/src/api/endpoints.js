/**
 * Central place for backend route strings.
 * Keeps service modules free of magic strings and makes the eventual
 * Flask integration a one-file change.
 */
export const ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    GOOGLE: "/auth/google",
    GITHUB: "/auth/github",
    LOGOUT: "/auth/logout",
  },
  ROLES: {
    LIST: "/roles",
  },
  SKILLS: {
    BY_ROLE: (roleId) => `/roles/${roleId}/skills`,
    SUBMIT: "/skills/selection",
  },
  ASSESSMENT: {
    // Question Generation Agent (backend/routes/ai_assessment_routes.py).
    // Full Assessment Planner/Builder pipeline (§9 ARCHITECTURE.md Phase 2)
    // will get its own POST /ai/assessments here later — this screen will
    // only need aiAssessmentService.js updated, not AssessmentScreen.jsx.
    GENERATE_QUESTIONS: "/ai/generate-questions",
  },
  RECOMMENDATION: {
    // Placeholder for the future Scikit-Learn recommendation endpoint.
    ROADMAP: "/recommendation/roadmap",
  },
  // ---- Admin Panel (new) ----
  // Backend: routes/admin_question_routes.py, registered under /api like
  // every other blueprint in app.py.
  ADMIN: {
    LOGIN: "/auth/login", // reuses the same dummy auth endpoint as the student side for now
    QUESTIONS: {
      LIST: "/admin/questions", // GET, supports ?skill=&role=&difficulty=&status=&search=
      CREATE: "/admin/questions", // POST
      UPDATE: (questionId) => `/admin/questions/${questionId}`, // PUT
      SET_STATUS: (questionId) => `/admin/questions/${questionId}/status`, // PATCH
      EXTRACT_PDF: "/admin/questions/extract-pdf", // POST multipart/form-data
    },
  },
};
