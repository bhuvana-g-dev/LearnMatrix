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

    // "Quit Role" (Learning Hub) — wipes the saved assessment + roadmap
    // for this uid so Role Selection unlocks again.
    QUIT_ROLE: (uid) => `/career-path/${uid}`,
  },
  AI_CHAT: {
    // AI Study Assistant chat (backend/routes/ai_chat_routes.py).
    SEND_MESSAGE: "/ai/chat", // POST {uid, message, sessionId?, context?}
    SESSIONS: (uid) => `/ai/chat/${uid}/sessions`, // GET — list past conversations
    SESSION: (uid, sessionId) => `/ai/chat/${uid}/sessions/${sessionId}`, // GET (load) / DELETE
    SOURCES: (uid) => `/ai/chat/${uid}/sources`, // GET (list) / POST (upload, multipart)
    SOURCES_CONTENT: (uid) => `/ai/chat/${uid}/sources/content`, // GET — full text per source, for Mind Map / Audio Overview / PPT / Flashcards
    SOURCE_FROM_NOTES: (uid) => `/ai/chat/${uid}/sources/from-notes`, // POST {skill, topic, focusBand}
    DELETE_SOURCE: (uid, sourceId) => `/ai/chat/${uid}/sources/${sourceId}`, // DELETE
  },
  LESSONS: {
    // backend/routes/lesson_routes.py
    LIST: (skill, topic) =>
      `/lessons/${encodeURIComponent(skill)}/${encodeURIComponent(topic)}`, // GET — ordered lesson list for a topic (cached on first call)
    CONTENT: (skill, topic, lessonTitle, focusBand) =>
      `/lessons/${encodeURIComponent(skill)}/${encodeURIComponent(topic)}/${encodeURIComponent(lessonTitle)}/${encodeURIComponent(focusBand)}`, // GET — one lesson's content
  },
  FLASHCARDS: {
    // backend/routes/flashcard_routes.py
    GENERATE: "/flashcards/generate", // POST {uid, mode: "topic"|"chat"|"sources"|"custom", skill?, topic?, focusBand?, sessionId?, text?, count?}
    LIST: (uid) => `/flashcards/${uid}`, // GET
    DELETE: (uid, setId) => `/flashcards/${uid}/${setId}`, // DELETE
  },
  STUDY_SUMMARY: {
    // backend/routes/ppt_routes.py — each downloads a file directly, not a JSON envelope
    DOWNLOAD_TOPIC_PPTX: (skill, topic, focusBand) =>
      `/study-summary/topic/${encodeURIComponent(skill)}/${encodeURIComponent(topic)}/${encodeURIComponent(focusBand)}/pptx`,
    DOWNLOAD_SOURCES_PPTX: (uid) => `/study-summary/sources/${uid}/pptx`,
    DOWNLOAD_CHAT_PPTX: (uid, sessionId) => `/study-summary/chat/${uid}/${sessionId}/pptx`,
    DOWNLOAD_CUSTOM_PPTX: "/study-summary/custom/pptx", // POST {text}
    DOWNLOAD_TOPIC_PDF: (skill, topic, focusBand) =>
      `/study-summary/topic/${encodeURIComponent(skill)}/${encodeURIComponent(topic)}/${encodeURIComponent(focusBand)}/pdf`,
    DOWNLOAD_SOURCES_PDF: (uid) => `/study-summary/sources/${uid}/pdf`,
    DOWNLOAD_CHAT_PDF: (uid, sessionId) => `/study-summary/chat/${uid}/${sessionId}/pdf`,
    DOWNLOAD_CUSTOM_PDF: "/study-summary/custom/pdf", // POST {text}
    // "from-content" — builds a file from an already-generated deck (see SLIDEDECK.GENERATE
    // below) with no further AI call, so the download always matches what was previewed.
    DOWNLOAD_CUSTOM_PPTX_FROM_CONTENT: "/study-summary/custom/pptx-from-content", // POST {notes}
    DOWNLOAD_CUSTOM_PDF_FROM_CONTENT: "/study-summary/custom/pdf-from-content", // POST {notes}
  },
  SLIDEDECK: {
    // backend/routes/slidedeck_routes.py — AI-expands a typed prompt into full deck content
    GENERATE: "/slidedeck/generate", // POST {text, label?, uid?, sessionId?} -> {title, summary, sections, keyTakeaways}
  },
  MINDMAP: {
    // backend/routes/mindmap_routes.py — stateless, structures text into a mind map
    GENERATE: "/mindmap/generate", // POST {text, label?, uid?, sessionId?}
  },
  STUDIO: {
    // backend/routes/studio_routes.py — Mind Map / Slide Deck / Flashcards / Audio Overview artifacts saved per chat session
    LIST: (uid, sessionId) => `/studio/${uid}/${sessionId}`, // GET -> [{id, type, title, createdAt}]
    GET: (uid, sessionId, artifactId) => `/studio/${uid}/${sessionId}/${artifactId}`, // GET -> {type, title, content, createdAt}
    SAVE: (uid, sessionId) => `/studio/${uid}/${sessionId}`, // POST {type, title, content} -> {id}
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
  TOPIC_QUIZ: {
    // Post-topic quiz + adaptive revision (backend/routes/topic_quiz_routes.py).
    // Fired when a learner hits "Next" on a topic in CourseWorkspaceScreen.
    GET_QUIZ: (skill, topic) =>
      `/topic-quiz/${encodeURIComponent(skill)}/${encodeURIComponent(topic)}`, // GET
    SUBMIT: (skill, topic) =>
      `/topic-quiz/${encodeURIComponent(skill)}/${encodeURIComponent(topic)}/submit`, // POST {uid, questions, answers, timeTakenSeconds}
    PROGRESS: (uid) => `/topic-quiz/${uid}/progress`, // GET -> [ topic_quiz_progress docs, each with FocusBand ]
    DUE_REVISIONS: (uid) => `/revisions/${uid}`, // GET -> { due: [...], upcoming: [...] }
    SNOOZE: (uid, skill, topic) =>
      `/revisions/${uid}/${encodeURIComponent(skill)}/${encodeURIComponent(topic)}/snooze`, // POST
  },
  // ---- Admin Panel (new) ----
  // Backend: routes/admin_student_routes.py, routes/admin_learner_routes.py,
  // routes/admin_auth_routes.py, all registered under /api like every
  // other blueprint in app.py. The old Excel/PDF Question Bank
  // (admin_question_routes.py) has been removed — topic quizzes are
  // AI-generated only now (see services/topic_quiz_service.py).
  ADMIN: {
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
    // Learner Intelligence — backend: routes/admin_learner_routes.py
    // Reads the real per-skill classification data (topic_quiz_progress
    // / topic_quiz_attempts), not a separate mock dataset.
    LEARNERS: {
      LIST: "/admin/learners", // GET, supports ?email=&skill=&topic=&learnerType=
      PROFILE: "/admin/learners/profile", // GET ?email= (required) — skill-wise WHY breakdown
      SUMMARY: "/admin/learners/summary", // GET — dashboard totals, distribution, recent activity
    },
    // Admin auth — backend: routes/admin_auth_routes.py. Real Firebase
    // login happens client-side (see services/adminAuthService.js); this
    // is the server-side admin-role check that happens right after.
    AUTH: {
      SESSION: "/admin/session", // POST { idToken } — server-side admin-role check
    },
  },
};
