# LearnMatrix

**AI-powered adaptive learning platform for career-focused learners.**

LearnMatrix takes a learner from *"I want to become a Full Stack Developer"* to a personalised, trackable learning path. It runs a diagnostic assessment, builds a role-driven roadmap, adapts lesson content to the learner's level, and schedules revision using a Scikit-Learn pace classifier and spaced repetition.

> Final-year B.Sc. Computer Science project.

**Live frontend:** https://learn-matrix-ten.vercel.app

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [How the Adaptive Engine Works](#how-the-adaptive-engine-works)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Seeding Data](#seeding-data)
- [Admin Panel](#admin-panel)
- [API Overview](#api-overview)
- [Deployment](#deployment)
- [Team](#team)

---

## Features

### Learner side

| Area | What it does |
| --- | --- |
| **Auth & onboarding** | Email/Google sign-in via Firebase Auth, email verification, SMS OTP phone verification (Fast2SMS), profile completion |
| **Career path** | Choose from 8 roles: Full Stack, Frontend, Backend, AI/ML, Data Analyst, Cloud, Cyber Security, Android. Pick skills for the role |
| **Diagnostic assessment** | AI-generated questions per selected skill (30 questions for 1 skill, +15 per extra skill), run as background jobs with autosave, then AI-graded |
| **Roadmap** | Every skill in the chosen role is grouped into modules. A compression engine marks topics as *Verified / Current / Locked* from diagnostic scores |
| **Learning Hub** | Coursera-style course workspace: collapsible skills, lessons, resume highlight, previous/next navigation, AI-generated notes, curated videos and resources (Practice / Reference & Reading) |
| **Topic quizzes** | Post-topic quiz served from the Question Bank first, AI fills the gap. Auto-marks a lesson complete on 10/10 |
| **Revision schedule** | Fast / Moderate / Slow classification sets the next retest date (7 / 5 / 3 day intervals), with snooze |
| **AI Study Assistant** | RAG chat over your own uploaded files, notes, text and YouTube transcripts. Also flashcards, mind maps, audio overview (two-host podcast with TTS), slide decks, and PDF/PPTX study summaries |
| **Profile dashboard** | Activity and streaks, learning score, career readiness, risk prediction, community ranking, smart resource suggestions |
| **Certificates** | Issued per career path, completed automatically when every roadmap topic is done |

### Admin side

- Dashboard with platform-wide metrics
- Learner and student records: timeline, roadmap analytics, per-skill assessment logs, Excel export
- Learner Intelligence: classifier outputs per learner
- Resource Bank: Create → Pending Review → Verify → Available to learners, with AI suggestions, YouTube search and bulk generate-and-verify
- Generated Content Management: list, view and delete cached AI notes
- Lesson Plans management

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 18, Vite 5, Tailwind CSS 3, Framer Motion, Axios, Lucide icons, jsPDF + html2canvas (certificates) |
| **Backend** | Python 3.12, Flask 3, Flask-CORS, Flask-Limiter, Gunicorn |
| **Database / Auth / Storage** | Firebase Authentication, Cloud Firestore, Firebase Storage |
| **AI providers** | Gemini (primary), with automatic fallback to Groq, Cerebras and OpenRouter |
| **ML** | Scikit-Learn `RandomForestClassifier` + Joblib |
| **Documents & data** | python-pptx, ReportLab, pdfplumber, pandas, openpyxl |
| **Other** | youtube-transcript-api, YouTube Data API v3, Pexels, Fast2SMS |
| **Hosting** | Vercel (frontend), Render (backend) |

---

## How the Adaptive Engine Works

**1. Provider fallback chain.** Every AI call goes through one client. If a provider is rate-limited or fails, the next one is tried automatically (`AI_PROVIDER_CHAIN`, default `gemini,groq,cerebras,openrouter`). Providers without an API key are skipped. Assessment generation can also rotate through extra Gemini keys.

**2. Agents.** Each AI task is a small single-purpose agent (`backend/agents/`) with the same `run()` contract: question generation, notes, lesson planner, topic quiz, chat, flashcards, mind map, slide deck, audio overview, resource suggestion.

**3. Two-axis topic adaptation** (`services/focus_band.py`):

- **Topic mastery %** decides the *content level*: `<40%` fundamentals, `<70%` application, `<85%` advanced, otherwise polish.
- **Easy / Medium / Hard accuracy** independently identifies the *weak area*.
- **Fast / Moderate / Slow** classification affects *revision scheduling only*, never content.

**4. Learner classifier** (`services/learner_classifier.py`). A Random Forest on four features: score, time ratio, attempt number and prior average. It is bootstrapped with synthetic data and can be retrained on real quiz attempts with `scripts/train_learner_classifier.py`.

**5. Difficulty engine** (`services/difficulty_engine.py`). A rule-based, explainable weighted score (previous score, time ratio, confidence, mistake rate) picks Easy / Medium / Hard. It is deliberately not an LLM call.

**6. RAG chat** (`services/embedding_service.py`). Sources are chunked, embedded with Gemini embeddings, and retrieved by in-memory cosine similarity. No vector DB is needed at per-student scale.

**7. Content caching.** Notes are cached by `(skill, topic, focus_band)`. Admin-verified resources are served first, with live YouTube as the fallback.

---

## Project Structure

```
LearnMatrix/
├── firebase.json
├── firestore.rules
├── backend/
│   ├── app.py                  # Flask entrypoint: CORS, rate limiter, blueprints
│   ├── config/settings.py      # all env-driven configuration (single source)
│   ├── agents/                 # AI agents (one responsibility each)
│   ├── routes/                 # Flask blueprints (HTTP layer only)
│   ├── services/               # business logic + Firestore repositories
│   ├── models/                 # data models
│   ├── data/                   # role/skill categories, syllabus seed
│   ├── utils/                  # AI client, auth helpers, rate limiter, extractors
│   ├── firebase/               # Firebase Admin initialisation
│   ├── scripts/                # one-off / maintenance CLI scripts
│   ├── QuestionBank/           # .xlsx question banks (import source only)
│   ├── assets/fonts/           # Poppins, used in generated PDFs
│   ├── requirements.txt
│   └── runtime.txt             # python-3.12.10
└── frontend/
    ├── vite.config.js
    ├── vercel.json             # SPA rewrite
    ├── .env.example
    └── src/
        ├── api/                # Axios clients + endpoint constants
        ├── services/           # one service per backend area
        ├── hooks/              # auth, profile, career path
        ├── screens/            # learner screens (+ screens/admin/)
        ├── components/         # layout, learning, roadmap, profile, admin
        ├── constants/          # theme, navigation, roles, skills
        ├── utils/
        ├── App.jsx             # learner app
        ├── AdminApp.jsx        # admin app
        └── RootRouter.jsx
```

**Layering rule:** routes handle HTTP only, services hold logic, repositories touch Firestore, and agents talk to the AI. Excel files are an import source only. They are never read at runtime.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.12
- A Firebase project (Authentication + Firestore, and optionally Storage)
- At least one AI provider key (Gemini recommended)

### 1. Clone

```bash
git clone https://github.com/bhuvana-g-dev/LearnMatrix.git
cd LearnMatrix
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

1. In the Firebase console go to **Project settings → Service accounts → Generate new private key**.
2. Save the file as `backend/firebase/serviceAccountKey.json`. It is git-ignored and must never be committed.
3. Create `backend/.env` (see [Environment Variables](#environment-variables)).

```bash
python app.py                   # http://localhost:5000
```

Check it with `GET http://localhost:5000/health`.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env            # then fill in the values
npm run dev                     # http://localhost:5173
```

---

## Environment Variables

### `frontend/.env`

| Variable | Description |
| --- | --- |
| `VITE_API_BASE_URL` | Backend base URL, e.g. `http://localhost:5000/api` |
| `VITE_FIREBASE_API_KEY` | Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase web config |
| `VITE_FIREBASE_PROJECT_ID` | Firebase web config |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase web config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase web config |
| `VITE_FIREBASE_APP_ID` | Firebase web config |

### `backend/.env`

All variables are read in `backend/config/settings.py`.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Primary AI key. Per-feature overrides (`GEMINI_API_KEY_ASSESSMENT`, `_CHAT`, `_TOPIC_QUIZ`) fall back to this |
| `GEMINI_API_KEYS_POOL_ASSESSMENT` / `_CHAT` / `_TOPIC_QUIZ` | Optional comma-separated rotation pools (use keys from separate Google Cloud projects) |
| `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY` | Fallback providers (optional) |
| `AI_PROVIDER_CHAIN` | Provider order, default `gemini,groq,cerebras,openrouter` |
| `GEMINI_MODEL`, `GROQ_MODEL`, `CEREBRAS_MODEL` | Model overrides |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Local key path, default `firebase/serviceAccountKey.json` |
| `FIREBASE_SERVICE_ACCOUNT` | Full service-account JSON as a string (used in production, e.g. Render) |
| `FIREBASE_STORAGE_BUCKET` | Enables saved Audio Overview playback |
| `YOUTUBE_API_KEY` | Admin YouTube search and live video fallback |
| `PEXELS_API_KEY` | Images for generated slide decks |
| `FAST2SMS_API_KEY` | Signup SMS OTP |
| `CORS_ORIGINS` | Comma-separated allowed origins, default `http://localhost:5173` plus the Vercel URL |
| `FLASK_DEBUG`, `PORT`, `MAX_CONTENT_LENGTH_MB` | Server options |

> **Never commit `.env` files or `serviceAccountKey.json`.** If a key is ever exposed, rotate it immediately.

---

## Seeding Data

Run these from `backend/` after the service account is set up. Each supports `--dry-run`.

```bash
# 1. Question bank: .xlsx → Firestore
python -m scripts.upload_questions --all

# 2. Syllabus topics → Firestore
python -m scripts.upload_skill_topics --all

# 3. (Optional) Pre-generate learning resources for a role
python -m scripts.bulk_generate_resources frontend --by you@example.com

# 4. (Optional) Retrain the learner classifier on real quiz attempts
python scripts/train_learner_classifier.py
```

The Question Bank covers 14 subjects: Python, Java, JavaScript, Node.js, Express.js, REST API, MongoDB, MySQL, PostgreSQL, Git, GitHub, Docker (Basics), JWT Authentication, OAuth and Postman.

> The detailed topic-level syllabus is currently seeded for the **Frontend** role only. The other roles still get a full skill-level roadmap.

---

## Admin Panel

The admin app is a separate entry (`AdminApp.jsx`) protected by a Firebase **custom claim** (`admin: true`), checked on every `/api/admin/*` request. There is deliberately no UI to grant admin access.

```bash
# Create (or reuse) an account and grant admin
python scripts/create_admin.py alice@example.com herPassword

# Grant or revoke on an existing account
python scripts/grant_admin.py alice@example.com
python scripts/grant_admin.py alice@example.com --revoke
```

---

## API Overview

All routes live under `/api` (health checks are at `/` and `/health`). Responses use a `{ success, ... }` JSON envelope. AI-heavy routes are rate limited.

| Group | Example routes |
| --- | --- |
| Catalog | `/roles`, `/skills`, `/skills/<skill>/topics`, `/roles/<id>/syllabus`, `/roles/<id>/compressed-syllabus` |
| Assessment & roadmap | `/ai/generate-diagnostic-assessment`, `/ai/evaluate-diagnostic-assessment`, `/ai/generate-roadmap`, `/roadmap/<uid>`, `/career-path/<uid>` |
| Learning | `/learning/topic/<skill>/<topic>/<focus_band>`, `/lessons/...`, `/topic-quiz/...`, `/revisions/<uid>` |
| AI Study Assistant | `/ai/chat`, `/ai/chat/<uid>/sources`, `/flashcards/...`, `/mindmap/generate`, `/audio-overview/...`, `/slidedeck/generate`, `/studio/...` |
| Exports | `/study-summary/.../pdf`, `/study-summary/.../pptx` |
| Profile | `/activity/...`, `/certificates/<uid>`, `/phone-otp/send`, `/phone-otp/verify` |
| Admin | `/admin/session`, `/admin/students`, `/admin/learners`, `/admin/learning-resources`, `/admin/generated-content`, `/admin/lesson-plans` |

---

## Deployment

- **Frontend (Vercel):** import the repo with `frontend` as the root directory. Set the `VITE_*` variables. `vercel.json` rewrites all routes to `index.html`.
- **Backend (Render):** root directory `backend`. Use the start command `gunicorn app:app` with a **raised worker timeout** (the default 30s can kill long multi-skill generations). Set the environment variables, including `FIREBASE_SERVICE_ACCOUNT` (the full JSON) and `CORS_ORIGINS` with your Vercel URL.
- **Firestore rules:** `firestore.rules` only covers the collections the client SDK reads or writes directly. Everything else goes through the Flask backend using the Admin SDK. Review the rules before deploying with `firebase deploy --only firestore:rules`.
- **Free-tier tip:** Render free instances sleep when idle. Pinging `/health` with an uptime monitor keeps cold starts down.

---
