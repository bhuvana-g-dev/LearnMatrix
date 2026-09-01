import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Values come from .env (see .env.example) — never hardcoded, so the
// same code works across dev/staging/prod projects and the key isn't
// sitting in plaintext in the repo. Vite only exposes env vars
// prefixed VITE_ to client code, same convention VITE_API_BASE_URL
// already uses in this project.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

// Second, fully isolated Firebase App instance used ONLY for the admin
// panel's own sign-in (services/adminAuthService.js) — never import
// this anywhere on the student/learner side, and never import `auth`
// above inside admin code.
//
// Why: Firebase Auth's default persistence (browserLocalPersistence)
// stores the session in localStorage/IndexedDB keyed by this app's
// name + apiKey, and every open tab of the same browser listens for
// changes to that same storage — that's how staying logged in across
// tabs normally works. But it also means if admin login used the SAME
// `auth` instance as students, an admin signing in on the /admin tab
// would silently replace the session in every OTHER tab too — e.g. a
// student's Learning tab open in another tab of the same browser would
// flip straight into the admin panel the moment someone logged into
// /admin, because both tabs share one Firebase Auth session under the
// hood. Giving admin its own named app (`initializeApp(config, "admin")`)
// gives it a completely separate storage key, so the two sessions never
// cross-talk — a student and an admin can be logged in simultaneously
// in different tabs of the same browser without either one bumping
// the other out.
const adminApp = initializeApp(firebaseConfig, "admin");
export const adminAuth = getAuth(adminApp);
