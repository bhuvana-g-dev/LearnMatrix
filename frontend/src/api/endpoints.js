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
    // Single-skill, single-difficulty generation — still used wherever a
    // quick quiz (not a full diagnostic) is needed.
    GENERATE_QUESTIONS: "/ai/generate-questions",

    // Diagnostic assessment: one call generates 2 Easy + 2 Medium + 2
    // Hard questions PER selected skill (services/assessment_planner.py),
    // the other scores them skill-by-skill via the Evaluation Agent
    // (services/evaluation_service.py) into a Strong/Intermediate/Weak
    // table. This is the "core intelligence" flow, not a generic quiz.
    GENERATE_DIAGNOSTIC_ASSESSMENT: "/ai/generate-diagnostic-assessment",
    EVALUATE_DIAGNOSTIC_ASSESSMENT: "/ai/evaluate-diagnostic-assessment",
    GENERATE_ROADMAP: "/ai/generate-roadmap",
  },
  SYLLABUS: {
    // Skill Syllabus Tree (backend/services/skill_topic_service.py) —
    // the raw, uncompressed skill -> topic list for a role.
    GET_ROLE_SYLLABUS: (roleId) => `/roles/${roleId}/syllabus`,

    // Compression Engine (backend/services/syllabus_compression_service.py) —
    // same tree, but every topic tagged Verified/Current/Locked based on
    // the diagnostic evaluation passed in. POST because the evaluation
    // object is too large/specific to be a query param.
    GET_COMPRESSED_SYLLABUS: (roleId) => `/roles/${roleId}/compressed-syllabus`,
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
    // Resource Bank — backend: routes/learning_routes.py
    RESOURCES: {
      LIST: "/admin/learning-resources", // GET, supports ?skill=&topic=&type=&difficulty=&status=
      CREATE: "/admin/learning-resources", // POST
      UPDATE: (resourceId) => `/admin/learning-resources/${resourceId}`, // PATCH — general field edit
      DELETE: (resourceId) => `/admin/learning-resources/${resourceId}`, // DELETE
      SET_PINNED: (resourceId) => `/admin/learning-resources/${resourceId}/pin`, // PATCH {pinned}
      SET_ENABLED: (resourceId) => `/admin/learning-resources/${resourceId}/enabled`, // PATCH {enabled}
      SUGGEST_AI: "/admin/learning-resources/suggest", // POST {skill, topic, count} — non-video types
      SUGGEST_YOUTUBE: "/admin/learning-resources/suggest-youtube", // POST {skill, topic, count} — real YouTube search
      PENDING: "/admin/learning-resources/pending", // GET, supports ?skill=&topic=
      VERIFY: (resourceId) => `/admin/learning-resources/${resourceId}/verify`, // PATCH
      UNVERIFY: (resourceId) => `/admin/learning-resources/${resourceId}/unverify`, // PATCH — verified -> pending, hidden from students
      REJECT: (resourceId) => `/admin/learning-resources/${resourceId}/reject`, // PATCH
    },
    // Student Records — backend: routes/admin_student_routes.py
    STUDENTS: {
      LIST: "/admin/students", // GET
      EXPORT: "/admin/students/export", // GET, .xlsx file download
    },
  },
};
