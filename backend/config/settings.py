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

    # Optional SEPARATE key for Assessment question generation only
    # (agents/question_generation_agent.py) — diagnostic assessments
    # fire several generate_json() calls back-to-back (one per skill),
    # so splitting this traffic onto its own key/quota keeps it from
    # competing with chat/flashcards/notes for the same free-tier rate
    # limit. Falls back to GEMINI_API_KEY when unset, so this is purely
    # optional — nothing breaks if you only ever set one key.
    GEMINI_API_KEY_ASSESSMENT: str = os.getenv("GEMINI_API_KEY_ASSESSMENT", "") or os.getenv("GEMINI_API_KEY", "")

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


settings = Settings()
