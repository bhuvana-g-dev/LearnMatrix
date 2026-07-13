import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC2eBg6EENZ3NDRS72fKDR9zixxKRHOUJ0",
  authDomain: "learnmatrix-7d553.firebaseapp.com",
  projectId: "learnmatrix-7d553",
  storageBucket: "learnmatrix-7d553.firebasestorage.app",
  messagingSenderId: "769105931304",
  appId: "1:769105931304:web:26b9a35a2e203dff89191d",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();