# LearnMatrix Frontend — Refactored Architecture

This is the same LearnMatrix UI you already had (Login → Role Selection →
Skill Selection, same sidebar, same design/animations) — refactored into a
production-ready folder structure so a Flask backend (plus Firebase Auth,
Firestore, Gemini API, and a Scikit-Learn recommendation service) can be
wired in later **without touching any screen/component code**.

## What changed (architecture only — zero UI/UX changes)

**Nothing was redesigned.** Every color, gradient, animation, layout, and
piece of copy is identical to before. What moved:

```
src/
├── api/
│   ├── axiosClient.js     # single Axios instance (baseURL, interceptors, auth token)
│   └── endpoints.js       # all backend route strings in one place
├── constants/
│   ├── theme.js           # COLORS / GRADIENTS / GLASS_CARD (was inline in one file)
│   ├── navigation.js      # NAV_SECTIONS (sidebar structure)
│   ├── roles.js           # ROLES + ROLE_TITLES (dummy data — see roleService)
│   └── skills.js          # ROLE_SKILLS + DEFAULT_SKILL_CATEGORIES (dummy data)
├── services/
│   ├── authService.js     # loginUser / loginWithGoogle / loginWithGithub / logoutUser
│   ├── roleService.js     # getRoles()
│   └── skillService.js    # getSkillsByRole() / submitSelectedSkills()
├── hooks/
│   ├── useAuth.js         # auth state + calls into authService
│   └── useCareerPath.js   # role/skill selection state + calls into role/skillService
├── components/
│   ├── common/            # Logo, BackButton, GoogleIcon, FloatingOrbs
│   ├── layout/            # PageShell, DashboardLayout, SidebarContent
│   └── skills/            # SkillChip
├── screens/
│   ├── LoginScreen.jsx
│   ├── RoleSelectionScreen.jsx
│   ├── SkillSelectionScreen.jsx
│   └── ComingSoonScreen.jsx
└── App.jsx                 # thin composition root wiring hooks -> screens
```

## The key idea: a service boundary

Every screen used to import hardcoded arrays (`ROLES`, `ROLE_SKILLS`, etc.)
directly and manage its own local `useState`. Now:

- **Constants** hold the current dummy data (unchanged values).
- **Services** (`services/*.js`) are the *only* place that reads those
  constants right now. Each service function is already `async` and
  returns a `Promise` — the exact shape a real API call has — with the
  future Flask call written out as a commented-out line right above the
  dummy implementation. Example (`services/roleService.js`):

  ```js
  export async function getRoles() {
    // ---- FUTURE (Flask) ----
    // const { data } = await apiClient.get(ENDPOINTS.ROLES.LIST);
    // return data;

    // ---- CURRENT (dummy/local) ----
    return Promise.resolve(ROLES);
  }
  ```

- **Hooks** (`hooks/useAuth.js`, `hooks/useCareerPath.js`) call the
  services and own all the related state (loading flags, selected role,
  selected skills, etc).
- **Screens** are now pure presentational components. They receive
  everything as props and have zero knowledge of where the data came
  from.

## Swapping in the real backend later

When Flask is ready, you only touch **service files**:

1. Uncomment the `apiClient.get/post(...)` line.
2. Delete (or keep as a fallback) the dummy `Promise.resolve(...)` line.
3. Set `VITE_API_BASE_URL` in `.env` to your Flask server.

No screen, hook signature, or component prop changes — because the hook
and screen contracts were designed around the *future* API shape from day
one.

### Where Firebase Auth / Gemini / Scikit-Learn plug in

- **Firebase Authentication** → replace the body of `loginUser`,
  `loginWithGoogle`, `loginWithGithub` in `services/authService.js` with
  the Firebase SDK calls, then store the returned ID token via
  `localStorage.setItem("lm_auth_token", ...)` (already read automatically
  by `api/axiosClient.js`'s request interceptor).
- **Firestore** → same pattern in `roleService.js` / `skillService.js` if
  you read role/skill catalogs from Firestore instead of Flask.
- **Gemini API** (skill assessment) → `api/endpoints.js` already has a
  placeholder: `ENDPOINTS.ASSESSMENT.GEMINI_ANALYZE`. Add a
  `services/assessmentService.js` calling it.
- **Scikit-Learn** (personalized roadmap) → `ENDPOINTS.RECOMMENDATION.ROADMAP`
  is reserved for this; add `services/recommendationService.js` when ready.

## Setup

```bash
npm install axios   # only new dependency added
```

Create a `.env` (see `.env.example`) with:

```
VITE_API_BASE_URL=http://localhost:5000/api
```

Everything else (`framer-motion`, `lucide-react`, `tailwindcss`) is
unchanged from your existing project.
