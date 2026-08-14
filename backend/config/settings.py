"""
config/settings.py

Single source of truth for every configurable value in the backend.
No file outside this module should call os.getenv() directly — this keeps
every "magic string" (paths, ports, origins) in one auditable place, and
means .env is the only thing that changes between dev / staging / prod.
"""

import os
from dotenv import load_dotenv

# Load variables from backend/.env into the process environment.
# Must run before any of the values below are read.
load_dotenv()


class Settings:
    # --- Flask ---
    FLASK_ENV: str = os.getenv("FLASK_ENV", "development")
    DEBUG: bool = os.getenv("FLASK_DEBUG", "True") == "True"
    PORT: int = int(os.getenv("PORT", 5000))

    # --- CORS ---
    # The React dev server origin. Comma-separated if you later add more.
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173"
    ).split(",")

    # --- Firebase ---
    # Path to the service account JSON. The file itself is never committed;
    # only this path is configured.
    FIREBASE_SERVICE_ACCOUNT_PATH: str = os.getenv(
        "FIREBASE_SERVICE_ACCOUNT_PATH", "firebase/serviceAccountKey.json"
    )

    # --- Question Bank (Excel = import source ONLY, never read at runtime) ---
    # Folder scanned for *.xlsx files by scripts/upload_questions.py.
    # Adding a new subject later means dropping a file here — never touching
    # this settings file or any route/service code.
    QUESTION_BANK_DIR: str = os.getenv("QUESTION_BANK_DIR", "QuestionBank")

    # Columns every Question Bank Excel file must contain. QuestionID is the
    # permanent, human-assigned key (PY001, JS001, ...) and becomes the
    # Firestore document ID — it must never change once assigned.
    REQUIRED_QUESTION_COLUMNS: list[str] = [
        "QuestionID",
        "Skill",
        "Topic",
        "Difficulty",
        "QuestionType",
        "Question",
        "OptionA",
        "OptionB",
        "OptionC",
        "OptionD",
        "CorrectAnswer",
        "Explanation",
        "Status",
    ]

    # --- Firestore ---
    QUESTIONS_COLLECTION: str = os.getenv("QUESTIONS_COLLECTION", "questions")
    ROADMAP_COLLECTION: str = os.getenv("ROADMAP_COLLECTION", "roadmaps")
    ASSESSMENT_RESULTS_COLLECTION: str = os.getenv("ASSESSMENT_RESULTS_COLLECTION", "assessment_results")
    LEARNING_NOTES_COLLECTION: str = os.getenv("LEARNING_NOTES_COLLECTION", "learning_notes")
    LEARNING_RESOURCES_COLLECTION: str = os.getenv("LEARNING_RESOURCES_COLLECTION", "learning_resources")
    ACTIVITY_COLLECTION: str = os.getenv("ACTIVITY_COLLECTION", "learning_activity")

    # --- Learning Resources (services/resource_repository.py) ---
    # One shared list of resource types across student display, admin
    # CRUD, and the AI/YouTube suggestion pipelines — adding a new type
    # later means editing this one line, not hunting through 3 files.
    VALID_RESOURCE_TYPES: list[str] = [
        "video", "documentation", "article", "pdf", "cheatsheet", "practice", "github",
    ]
    # Reuses the same three-tier scale as VALID_TOPIC_DIFFICULTIES below
    # (Beginner/Intermediate/Advanced) rather than inventing a second
    # difficulty vocabulary for resources — one scale, one meaning,
    # everywhere in the app.
    VALID_RESOURCE_STATUSES: list[str] = ["pending", "verified", "rejected"]

    # --- YouTube Data API v3 (services/youtube_service.py) ---
    # Required only for: (1) the admin's "Search YouTube" suggestion
    # button, and (2) the live fallback when a topic has zero
    # admin-verified videos. Missing/empty key means both features
    # degrade to "show nothing for video resources" rather than
    # erroring — see youtube_service.py's module docstring. Get a key
    # at https://console.cloud.google.com/apis/credentials after
    # enabling "YouTube Data API v3" for the project.
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "")
    YOUTUBE_SEARCH_MAX_RESULTS: int = int(os.getenv("YOUTUBE_SEARCH_MAX_RESULTS", 6))

    # --- Pexels API (services/image_service.py) ---
    # Required only for Slide Deck's per-section photo lookup — missing/
    # empty key means slides are built without photos rather than
    # erroring (same "degrade gracefully" pattern as YOUTUBE_API_KEY
    # above). Get a free key at https://www.pexels.com/api/.
    PEXELS_API_KEY: str = os.getenv("PEXELS_API_KEY", "")

    # --- Skill Syllabus Tree (Adaptive Roadmap System) ---
    # skill_topics/{TopicID} — the ordered curriculum inside one skill
    # (e.g. HTML5 -> Introduction, Headings, Paragraphs, ...).
    # role_skill_mapping/{RoleID} — which skills a role requires, in order.
    SKILL_TOPICS_COLLECTION: str = os.getenv("SKILL_TOPICS_COLLECTION", "skill_topics")
    ROLE_SKILL_MAPPING_COLLECTION: str = os.getenv(
        "ROLE_SKILL_MAPPING_COLLECTION", "role_skill_mapping"
    )

    VALID_TOPIC_DIFFICULTIES: list[str] = ["Beginner", "Intermediate", "Advanced"]

    # Status values. Stored as plain strings in Firestore, referenced via
    # these constants everywhere else so nothing typos "active" vs "Active".
    STATUS_ACTIVE: str = "Active"
    STATUS_INACTIVE: str = "Inactive"

    # --- Admin Question Form (routes/admin_question_routes.py) ---
    # Fields required on every create/update coming from the Admin Panel.
    ADMIN_REQUIRED_QUESTION_FIELDS: list[str] = [
        "QuestionID",
        "Skill",
        "Difficulty",
        "QuestionType",
        "Question",
        "OptionA",
        "OptionB",
        "OptionC",
        "OptionD",
        "CorrectAnswer",
    ]

    # --- AI Agents (agents/) ---
    # Never hardcode the key/model anywhere else — same rule as every other
    # setting in this file. GEMINI_API_KEY is required only once an agent
    # actually runs; importing agents/ code never touches os.getenv itself.
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

    # Image-capable Gemini model (services/image_service.py's
    # generate_ai_image / utils/gemini_client.py's generate_image) —
    # used to make ONE creative, on-topic illustration per Slide Deck
    # "text" section instead of a generic stock photo. Falls back to
    # Pexels (PEXELS_API_KEY above) automatically whenever this call
    # fails for any reason — missing key, safety block, quota, etc.
    GEMINI_IMAGE_MODEL: str = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")

    # Optional SEPARATE key for Assessment question generation only
    # (agents/question_generation_agent.py) — diagnostic assessments
    # fire several generate_json() calls back-to-back (one per skill),
    # so splitting this traffic onto its own key/quota keeps it from
    # competing with chat/flashcards/notes for the same free-tier rate
    # limit. Falls back to GEMINI_API_KEY when unset, so this is purely
    # optional — nothing breaks if you only ever set one key.
    GEMINI_API_KEY_ASSESSMENT: str = os.getenv("GEMINI_API_KEY_ASSESSMENT", "") or os.getenv("GEMINI_API_KEY", "")

    # Optional SEPARATE key for the AI Study Assistant / Chat only
    # (agents/chat_agent.py) — chat traffic is high-volume/conversational
    # and was competing with assessment + every other agent on one key's
    # quota. Falls back to GEMINI_API_KEY when unset, so nothing breaks
    # if this isn't configured yet.
    GEMINI_API_KEY_CHAT: str = os.getenv("GEMINI_API_KEY_CHAT", "") or os.getenv("GEMINI_API_KEY", "")

    # Optional SEPARATE key for the post-Topic Quiz generator only
    # (agents/topic_quiz_agent.py) — fires on every learner finishing
    # every topic, independent load from both diagnostic assessment and
    # chat. Falls back to GEMINI_API_KEY when unset.
    GEMINI_API_KEY_TOPIC_QUIZ: str = os.getenv("GEMINI_API_KEY_TOPIC_QUIZ", "") or os.getenv("GEMINI_API_KEY", "")

    # --- LLM Provider Fallback Chain (utils/gemini_client.py) ---
    # Comma-separated, tried in order. If the first provider fails (rate
    # limit, overload, timeout), the next one is tried automatically —
    # no manual env var flip / redeploy needed mid-demo. Only providers
    # whose API key is actually set are attempted; missing keys are
    # skipped rather than causing a hard failure.
    AI_PROVIDER_CHAIN: list[str] = [
        p.strip() for p in os.getenv("AI_PROVIDER_CHAIN", "gemini,groq").split(",") if p.strip()
    ]

    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    CEREBRAS_API_KEY: str = os.getenv("CEREBRAS_API_KEY", "")
    CEREBRAS_MODEL: str = os.getenv("CEREBRAS_MODEL", "llama-3.3-70b")
    CEREBRAS_BASE_URL: str = "https://api.cerebras.ai/v1"

    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv(
        "OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"
    )
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # Question Generation Agent defaults/guardrails. These are also the
    # values the Admin Panel's future "AI Settings" screen will edit.
    AI_MAX_QUESTIONS_PER_REQUEST: int = int(
        os.getenv("AI_MAX_QUESTIONS_PER_REQUEST", 20)
    )
    AI_GENERATION_MAX_RETRIES: int = int(
        os.getenv("AI_GENERATION_MAX_RETRIES", 1)
    )
    VALID_DIFFICULTIES: list[str] = ["Easy", "Medium", "Hard"]
    VALID_QUESTION_TYPES: list[str] = ["MCQ"]

    # --- AI Study Assistant / Chat (agents/chat_agent.py) ---
    # Per-user conversation, unlike learning_notes which is a GLOBAL cache —
    # every student's chat history is their own, so the doc is keyed by uid.
    CHAT_HISTORY_COLLECTION: str = os.getenv("CHAT_HISTORY_COLLECTION", "ai_chat_history")

    # How many of the most recent messages are sent back to the LLM as
    # conversational context on every new turn. Kept small on purpose —
    # this is prompt text re-sent on EVERY request (no server-side
    # conversation state on the LLM side), so an unbounded history would
    # make every message slower and more expensive for no real benefit
    # past a certain point.
    AI_CHAT_MAX_HISTORY_MESSAGES: int = int(
        os.getenv("AI_CHAT_MAX_HISTORY_MESSAGES", 12)
    )

    # --- Grounded Chat / RAG (services/embedding_service.py) ---
    GEMINI_EMBEDDING_MODEL: str = os.getenv("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
    CHAT_SOURCES_COLLECTION: str = os.getenv("CHAT_SOURCES_COLLECTION", "chat_sources")
    CHAT_CHUNK_SIZE_WORDS: int = int(os.getenv("CHAT_CHUNK_SIZE_WORDS", 250))
    CHAT_CHUNK_OVERLAP_WORDS: int = int(os.getenv("CHAT_CHUNK_OVERLAP_WORDS", 40))
    CHAT_RETRIEVAL_TOP_K: int = int(os.getenv("CHAT_RETRIEVAL_TOP_K", 4))
    CHAT_SOURCE_MAX_FILE_MB: int = int(os.getenv("CHAT_SOURCE_MAX_FILE_MB", 15))

    # --- Flashcards (agents/flashcard_agent.py) ---
    FLASHCARD_SETS_COLLECTION: str = os.getenv("FLASHCARD_SETS_COLLECTION", "flashcard_sets")
    FLASHCARD_DEFAULT_COUNT: int = int(os.getenv("FLASHCARD_DEFAULT_COUNT", 10))

    # --- Post-Topic Quiz + Adaptive Revision (Objectives 3 & 4) ---
    # topic_quiz_attempts/{auto-id}   — one immutable doc per quiz taken,
    #     the training data source for services/learner_classifier.py.
    # topic_quiz_progress/{uid}__{skill}__{topic} — ONE doc per learner
    #     per topic, holding the latest classification + next_review_date.
    #     This is what the dashboard's "Due Today" / "Upcoming Revisions"
    #     card queries — a running attempts log would make that a
    #     full-collection scan per learner.
    TOPIC_QUIZ_ATTEMPTS_COLLECTION: str = os.getenv(
        "TOPIC_QUIZ_ATTEMPTS_COLLECTION", "topic_quiz_attempts"
    )
    TOPIC_QUIZ_PROGRESS_COLLECTION: str = os.getenv(
        "TOPIC_QUIZ_PROGRESS_COLLECTION", "topic_quiz_progress"
    )
    # Write-only audit log of every AI-generated topic-quiz question, for
    # the Admin Panel's AI Questions screen. NEVER read back to serve a
    # quiz — every learner gets a freshly generated quiz (see
    # services/topic_quiz_service.get_topic_quiz), this collection only
    # records what was generated, for whom, and when.
    AI_GENERATED_QUESTIONS_COLLECTION: str = os.getenv(
        "AI_GENERATED_QUESTIONS_COLLECTION", "ai_generated_questions"
    )

    # Fixed count per abstract ("quiz after each topic (10 questions)") —
    # same fixed-spread reasoning as assessment_planner.QUESTIONS_PER_DIFFICULTY,
    # kept constant so every topic quiz is comparable.
    TOPIC_QUIZ_QUESTION_COUNT: int = int(os.getenv("TOPIC_QUIZ_QUESTION_COUNT", 10))
    TOPIC_QUIZ_DIFFICULTY_SPREAD: dict[str, int] = {"Easy": 3, "Medium": 4, "Hard": 3}

    # Fast/Moderate/Slow -> next retest in N days. Values from the
    # abstract's Objective 4 exactly — do not change without updating
    # the abstract, since this is graded against it.
    REVISION_INTERVAL_DAYS: dict[str, int] = {"Fast": 7, "Moderate": 5, "Slow": 3}

    # Where the trained Scikit-Learn model is cached on disk (relative to
    # backend/). Missing file = services/learner_classifier.py trains a
    # fresh one from bootstrap data on first use and writes it here, so
    # a clean checkout never hard-fails for lack of a committed .pkl.
    CLASSIFIER_MODEL_PATH: str = os.getenv(
        "CLASSIFIER_MODEL_PATH", "models/learner_classifier.pkl"
    )

    # --- Lessons layer (Topic -> multiple bite-sized Lessons) ---
    # lesson_plans/{skill}__{topic} — ONE cached doc per topic holding
    # its ordered lesson list, same "generate once on cache miss, reuse
    # forever after" pattern as services/notes_repository.py's AI notes
    # cache. A Lesson's actual content (theory + video + resources) is
    # NOT stored here — it's fetched on demand from the EXISTING
    # get_topic_package() pipeline by treating the lesson as its own
    # composite topic key (see services/lesson_service.py), so no new
    # content-generation machinery is needed for lesson content itself.
    LESSON_PLANS_COLLECTION: str = os.getenv("LESSON_PLANS_COLLECTION", "lesson_plans")
    LESSON_MIN_COUNT: int = int(os.getenv("LESSON_MIN_COUNT", 2))
    LESSON_MAX_COUNT: int = int(os.getenv("LESSON_MAX_COUNT", 5))


settings = Settings()
