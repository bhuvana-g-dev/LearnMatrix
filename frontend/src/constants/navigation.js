import {
  Target,
  BookOpen,
  Brain,
  Bot,
  Calendar,
  User,
} from "lucide-react";

/**
 * Sidebar structure. Purely presentational/navigational data — no API
 * dependency, so it stays a constant even after the Flask backend lands.
 */
export const NAV_SECTIONS = [
  {
    key: "career",
    title: "My Career Path",
    icon: Target,
    children: [
      { key: "role", label: "Role Selection" },
      { key: "skills", label: "Skill Selection" },
    ],
  },
  {
    key: "assessment",
    title: "Assessment",
    icon: Brain,
    children: [
      { key: "initial-assessment", label: "Initial Assessment" },
      { key: "quizzes", label: "Topic Quizzes" },
      { key: "practice-tests", label: "Practice Tests" },
    ],
  },
  {
    key: "learning",
    title: "Learning",
    icon: BookOpen,
    children: [
      { key: "roadmap", label: "My Roadmap" },
      { key: "sessions", label: "Learning Sessions" },
      { key: "resources", label: "Learning Resources" },
    ],
  },
  {
    key: "ai",
    title: "AI Study Assistant",
    icon: Bot,
    children: [
      { key: "ai-chat", label: "AI Chat" },
      { key: "flashcards", label: "Flashcards" },
      { key: "mindmaps", label: "Mind Maps" },
      { key: "summary", label: "Study Summary" },
      { key: "audio", label: "Audio Overview" },
    ],
  },
  {
    key: "revision",
    title: "Revision",
    icon: Calendar,
    children: [
      { key: "today-revision", label: "Today's Revision" },
      { key: "revision-history", label: "Revision History" },
    ],
  },
  {
    key: "profile",
    title: "My Profile",
    icon: User,
    children: [
      { key: "personal-info", label: "Personal Information" },
      { key: "learning-progress", label: "Learning Progress" },
      { key: "skill-analysis", label: "Skill Analysis" },
      { key: "weak-strong", label: "Weak & Strong Skills" },
      { key: "achievements", label: "Achievements" },
      { key: "certificates", label: "Certificates (Future)" },
      { key: "settings", label: "Settings" },
    ],
  },
];
