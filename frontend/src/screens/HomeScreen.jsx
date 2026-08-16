import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Brain,
  BookOpen,
  Bot,
  Calendar,
  Award,
  ArrowRight,
  Sparkles,
  Menu,
  X,
  Layers,
  Palette,
  Server,
  BarChart3,
  Cloud,
  Shield,
  Smartphone,
  PlayCircle,
  TrendingUp,
  ClipboardCheck,
  Map,
  Code2,
  RefreshCw,
  Flame,
  GraduationCap,
} from "lucide-react";
import Logo from "../components/common/Logo";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { ROLES } from "../constants/roles";

const FEATURES = [
  {
    icon: Target,
    title: "Role-Based Career Paths",
    desc: "Personalized roadmap based on your career",
    color: "#E4568A",
  },
  {
    icon: Brain,
    title: "Adaptive Assessments",
    desc: "Smart tests that adjust to your level",
    color: "#8B5CF6",
  },
  {
    icon: BookOpen,
    title: "Structured Learning",
    desc: "Curated resources for every skill",
    color: "#0D9488",
  },
  {
    icon: Bot,
    title: "AI Study Assistant",
    desc: "Chat, flashcards, mind maps & audio",
    color: "#D4A017",
  },
  {
    icon: Calendar,
    title: "Smart Revision Planner",
    desc: "Resurfaces topics before you forget",
    color: "#2563EB",
  },
  {
    icon: Award,
    title: "Progress Tracking",
    desc: "See how far you've come, always",
    color: "#16A34A",
  },
];

const ROLE_ICONS = {
  fullstack: Layers,
  frontend: Palette,
  backend: Server,
  aiml: Bot,
  data: BarChart3,
  cloud: Cloud,
  cyber: Shield,
  android: Smartphone,
};

const STEPS = [
  { n: "1", icon: Target, title: "Choose Career", desc: "Select your dream IT role", color: "#E4568A" },
  { n: "2", icon: ClipboardCheck, title: "Assessment", desc: "Take initial assessment", color: "#8B5CF6" },
  { n: "3", icon: Map, title: "AI Roadmap", desc: "Get your personalized roadmap", color: "#2563EB" },
  { n: "4", icon: BookOpen, title: "Learn", desc: "Study through structured modules", color: "#0D9488" },
  { n: "5", icon: Code2, title: "Practice", desc: "Solve quizzes & coding challenges", color: "#D4A017" },
  { n: "6", icon: RefreshCw, title: "Revise", desc: "Smart revision at the right time", color: "#16A34A" },
  { n: "7", icon: Award, title: "Get Certified", desc: "Earn certificate after completing your path", color: "#D97706" },
];

const MENU_LINKS = [
  { label: "Home", id: "home-top" },
  { label: "Features", id: "home-features" },
  { label: "How It Works", id: "home-how-it-works" },
];

/**
 * HomeScreen — the full-view "About LearnMatrix" landing page.
 *
 * Reused in two places:
 *  1. Pre-login (App.jsx, showLanding=true) — pass `onLogin` (and
 *     optionally `onSignup`) and this renders a top bar: hamburger menu +
 *     Logo on the left, "Login" button on the right. The hamburger opens
 *     an off-canvas side drawer with section links + Login/Sign Up.
 *  2. Post-login, "Home" nav item — no `onLogin` passed, so no top bar
 *     and no hamburger; same landing content underneath either way.
 *
 * Purely presentational — no data fetching — so it needs no service/hook
 * of its own either way.
 */
export default function HomeScreen({ onGetStarted, onLogin, onSignup }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollToSection = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="px-4 sm:px-8 py-14 pb-20" id="home-top">
      <div className="max-w-5xl mx-auto">

        {/* Top bar — only shown pre-login, when onLogin is passed.
            Desktop (md+): full horizontal navbar with visible links.
            Mobile (<md): Logo + hamburger, links live in the drawer. */}
        {onLogin && (
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                className="flex md:hidden items-center justify-center flex-shrink-0"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.5)",
                  border: `1px solid ${COLORS.border}`,
                  cursor: "pointer",
                }}
              >
                <Menu size={18} color={COLORS.textDark} />
              </button>
              <Logo />
            </div>

            {/* Desktop nav links — always visible, no hamburger needed */}
            <nav className="hidden md:flex items-center gap-7">
              {MENU_LINKS.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className="text-sm font-semibold"
                  style={{ color: COLORS.textDark, background: "transparent", border: "none", cursor: "pointer" }}
                >
                  {link.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {onSignup && (
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onSignup}
                  className="hidden md:inline-flex font-semibold text-sm"
                  style={{
                    padding: "10px 22px",
                    borderRadius: 9999,
                    color: COLORS.textDark,
                    border: `1.5px solid ${COLORS.border}`,
                    background: "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                  }}
                >
                  Sign Up
                </motion.button>
              )}
              <motion.button
                whileHover={{ y: -2, boxShadow: "0 10px 24px rgba(192,132,252,0.45)" }}
                whileTap={{ scale: 0.97 }}
                onClick={onLogin}
                className="font-semibold text-sm"
                style={{
                  padding: "10px 26px",
                  borderRadius: 9999,
                  color: "#fff",
                  border: "none",
                  background: GRADIENTS.purpleSky,
                  cursor: "pointer",
                  boxShadow: "0 6px 16px rgba(192,132,252,0.35)",
                }}
              >
                Login
              </motion.button>
            </div>
          </div>
        )}

        {/* Hero — two column: copy + CTAs on the left, mockup card on the right */}
        <div className="grid lg:grid-cols-2 gap-10 items-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div
              className="inline-flex items-center gap-2 text-xs font-semibold mb-5"
              style={{
                padding: "7px 16px",
                borderRadius: 9999,
                background: "rgba(212,160,23,0.14)",
                color: COLORS.purple,
              }}
            >
              <Sparkles size={13} /> AI-Powered Adaptive Learning Platform
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold leading-tight" style={{ color: COLORS.textDark }}>
              Master Your IT Career with{" "}
              <span
                style={{
                  background: GRADIENTS.purpleSky,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AI
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base max-w-md" style={{ color: COLORS.textMid }}>
              Pick an IT career path, learn at your own pace, and let AI keep your
              assessments, revisions, and progress on track.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-8">
              <motion.button
                whileHover={{ y: -2, boxShadow: "0 12px 28px rgba(212,160,23,0.45)" }}
                whileTap={{ scale: 0.98 }}
                onClick={onGetStarted}
                className="inline-flex items-center gap-2 font-semibold text-sm"
                style={{
                  padding: "14px 30px",
                  borderRadius: 9999,
                  color: "#fff",
                  border: "none",
                  background: GRADIENTS.purpleSky,
                  cursor: "pointer",
                  boxShadow: "0 8px 20px rgba(212,160,23,0.35)",
                }}
              >
                Get Started <ArrowRight size={16} />
              </motion.button>
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => scrollToSection("home-how-it-works")}
                className="inline-flex items-center gap-2 font-semibold text-sm"
                style={{
                  padding: "14px 26px",
                  borderRadius: 9999,
                  color: COLORS.textDark,
                  border: `1.5px solid ${COLORS.border}`,
                  background: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                }}
              >
                <PlayCircle size={16} /> How It Works
              </motion.button>
            </div>

            {/* Trust row */}
            <div className="flex items-center gap-3 mt-8">
              <div className="flex -space-x-2.5">
                {["S", "A", "R", "P"].map((letter, i) => (
                  <span
                    key={letter}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{
                      background: [COLORS.purple, "#8B5CF6", "#16A34A", "#2563EB"][i],
                      color: "#fff",
                      border: "2px solid #FBF3E1",
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </div>
              <p className="text-xs font-medium" style={{ color: COLORS.textMid }}>
                Learners growing their careers with LearnMatrix
              </p>
            </div>
          </motion.div>

          {/* Right side — student photo + floating "dashboard preview" cards */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative hidden sm:block mx-auto"
            style={{ width: 420, height: 340 }}
          >
            {/* Student photo — real, free-to-use Pexels photo
                (pexels.com/photo/girl-sitting-at-desk-studying-on-laptop-6937704),
                hotlinked directly from Pexels' CDN */}
            <div
              className="absolute inset-x-8 inset-y-6 rounded-[28px] overflow-hidden"
              style={{ boxShadow: "0 20px 50px rgba(13,27,61,0.18)" }}
            >
              <img
                src="https://images.pexels.com/photos/6937704/pexels-photo-6937704.jpeg?auto=compress&cs=tinysrgb&w=900"
                alt="Student learning on LearnMatrix"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextSibling.style.display = "flex";
                }}
              />
              <div
                className="w-full h-full items-center justify-center"
                style={{ display: "none", background: GRADIENTS.purpleSky }}
              >
                <GraduationCap size={40} color="rgba(255,255,255,0.7)" />
              </div>
            </div>

            {/* Overall Progress — top-left */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="absolute -top-2 -left-4 w-44 p-3.5"
              style={{ ...GLASS_CARD, borderRadius: 18 }}
            >
              <p className="text-[10px] font-semibold" style={{ color: COLORS.textMid }}>
                Overall Progress
              </p>
              <div className="flex items-center gap-2.5 mt-1.5">
                <MiniProgressRing percent={72} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "#16A34A" }}>
                    Great job!
                  </p>
                  <p className="text-[9px]" style={{ color: COLORS.textLight }}>
                    Ahead of most learners
                  </p>
                </div>
              </div>
              <p className="text-[10px] font-semibold mt-2" style={{ color: COLORS.purple }}>
                View Details →
              </p>
            </motion.div>

            {/* Today's Plan — top-right */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute -top-4 -right-6 w-40 p-3.5"
              style={{ ...GLASS_CARD, borderRadius: 18 }}
            >
              <p className="text-[10px] font-semibold mb-2" style={{ color: COLORS.textMid }}>
                Today's Plan
              </p>
              <div className="space-y-1.5">
                {[
                  { label: "React Basics", done: true },
                  { label: "Components", done: false },
                  { label: "State & Props", done: false },
                ].map((t) => (
                  <div key={t.label} className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: t.done ? "#16A34A" : COLORS.border }}
                    >
                      {t.done && <Check size={8} color="#fff" />}
                    </span>
                    <span className="text-[9px]" style={{ color: COLORS.textDark }}>
                      {t.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* AI Recommendation — bottom-left */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="absolute -bottom-4 -left-6 w-44 p-3.5"
              style={{ ...GLASS_CARD, borderRadius: 18 }}
            >
              <p className="text-[10px] font-semibold flex items-center gap-1.5" style={{ color: COLORS.textMid }}>
                <Sparkles size={11} color={COLORS.purple} /> AI Recommendation
              </p>
              <p className="text-xs font-bold mt-1.5" style={{ color: COLORS.textDark }}>
                Focus on State & Props
              </p>
              <p
                className="inline-block text-[10px] font-semibold mt-2 px-3 py-1"
                style={{ borderRadius: 9999, background: GRADIENTS.purplePink, color: "#fff" }}
              >
                Start Learning
              </p>
            </motion.div>

            {/* Streak — bottom-right */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="absolute -bottom-2 -right-4 px-4 py-3"
              style={{ ...GLASS_CARD, borderRadius: 18 }}
            >
              <p className="text-[10px] font-semibold" style={{ color: COLORS.textMid }}>
                Streak
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Flame size={16} color="#D4A017" />
                <span className="text-base font-bold" style={{ color: COLORS.textDark }}>
                  7 Days
                </span>
              </div>
              <p className="text-[9px]" style={{ color: COLORS.textLight }}>
                Keep it up!
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* Feature grid */}
        <div id="home-features" className="mb-16">
          <h2 className="text-lg sm:text-xl font-bold text-center mb-8" style={{ color: COLORS.textDark }}>
            Why Choose LearnMatrix?
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                  className="p-4 text-center"
                  style={{ ...GLASS_CARD, borderRadius: 20 }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{ background: `${f.color}1F` }}
                  >
                    <Icon size={17} color={f.color} />
                  </div>
                  <h3 className="text-xs font-bold" style={{ color: COLORS.textDark }}>
                    {f.title}
                  </h3>
                  <p className="text-[11px] mt-1 leading-snug" style={{ color: COLORS.textMid }}>
                    {f.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Popular career paths */}
        <div className="mb-16">
          <h2 className="text-lg sm:text-xl font-bold text-center mb-8" style={{ color: COLORS.textDark }}>
            Popular Career Paths
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {ROLES.map((r, i) => {
              const Icon = ROLE_ICONS[r.id] || Layers;
              return (
                <motion.button
                  key={r.id}
                  onClick={onGetStarted}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  whileHover={{ y: -4 }}
                  className="p-4 text-center"
                  style={{ ...GLASS_CARD, borderRadius: 20, border: "none", cursor: "pointer" }}
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-3"
                    style={{ background: GRADIENTS.purpleSky }}
                  >
                    <Icon size={18} color="#fff" />
                  </div>
                  <h3 className="text-xs font-bold" style={{ color: COLORS.textDark }}>
                    {r.title}
                  </h3>
                  <p className="text-[11px] mt-1" style={{ color: COLORS.textLight }}>
                    {r.skills} skills
                  </p>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* How it works */}
        <motion.div
          id="home-how-it-works"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="p-6 sm:p-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <h2 className="text-lg sm:text-xl font-bold text-center mb-10" style={{ color: COLORS.textDark }}>
            How LearnMatrix Works
          </h2>

          <div className="hidden md:flex items-start">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="flex items-center flex-1 last:flex-none">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.08 }}
                    className="flex flex-col items-center text-center"
                    style={{ width: 116 }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                      style={{ background: `${s.color}1F` }}
                    >
                      <Icon size={20} color={s.color} />
                    </div>
                    <p className="text-xs font-bold mb-1" style={{ color: s.color }}>
                      {s.n}
                    </p>
                    <h3 className="text-xs font-bold" style={{ color: COLORS.textDark }}>
                      {s.title}
                    </h3>
                    <p className="text-[11px] mt-1 leading-snug" style={{ color: COLORS.textMid }}>
                      {s.desc}
                    </p>
                  </motion.div>

                  {i < STEPS.length - 1 && (
                    <div
                      className="flex-1 mx-1"
                      style={{ height: 0, borderTop: `2px dashed ${COLORS.border}`, marginTop: 24 }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile — stacked list, no horizontal connectors */}
          <div className="flex md:hidden flex-col gap-5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                  className="flex items-center gap-3.5"
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${s.color}1F` }}
                  >
                    <Icon size={18} color={s.color} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold" style={{ color: s.color }}>
                      Step {s.n}
                    </p>
                    <h3 className="text-xs font-bold" style={{ color: COLORS.textDark }}>
                      {s.title}
                    </h3>
                    <p className="text-[11px] mt-0.5" style={{ color: COLORS.textMid }}>
                      {s.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Hamburger side drawer — pre-login only */}
      <AnimatePresence>
        {menuOpen && onLogin && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(13,27,61,0.35)", zIndex: 40 }}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                height: "100vh",
                width: 280,
                zIndex: 50,
                ...GLASS_CARD,
                borderRadius: 0,
              }}
            >
              <div className="flex flex-col h-full p-5">
                <div className="flex items-center justify-between mb-8">
                  <Logo />
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Close menu"
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.5)",
                      border: `1px solid ${COLORS.border}`,
                      cursor: "pointer",
                    }}
                  >
                    <X size={14} color={COLORS.textDark} />
                  </button>
                </div>

                <nav className="flex flex-col gap-1">
                  {MENU_LINKS.map((link) => (
                    <button
                      key={link.id}
                      onClick={() => scrollToSection(link.id)}
                      className="text-left text-sm font-semibold px-3 py-2.5 rounded-xl"
                      style={{ color: COLORS.textDark, background: "transparent", border: "none", cursor: "pointer" }}
                    >
                      {link.label}
                    </button>
                  ))}
                </nav>

                <div className="mt-auto flex flex-col gap-2.5 pt-5" style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onLogin();
                    }}
                    className="w-full text-sm font-semibold"
                    style={{
                      padding: "11px 0",
                      borderRadius: 9999,
                      color: "#fff",
                      border: "none",
                      background: GRADIENTS.purpleSky,
                      cursor: "pointer",
                    }}
                  >
                    Login
                  </button>
                  {onSignup && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onSignup();
                      }}
                      className="w-full text-sm font-semibold"
                      style={{
                        padding: "11px 0",
                        borderRadius: 9999,
                        color: COLORS.textDark,
                        border: `1.5px solid ${COLORS.border}`,
                        background: "rgba(255,255,255,0.6)",
                        cursor: "pointer",
                      }}
                    >
                      Sign Up
                    </button>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Small decorative progress ring for the "Welcome back" preview card —
// illustrative marketing content, not real user data.
function MiniProgressRing({ percent }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke={COLORS.border} strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={COLORS.purple}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color: COLORS.textDark }}>
        {percent}%
      </div>
    </div>
  );
}

// Simple friendly mascot, built entirely from basic shapes (no external
// image asset) — a small decorative touch behind the hero preview card.
function RobotMascot() {
  return (
    <svg width="150" height="190" viewBox="0 0 150 190" className="flex-shrink-0">
      {/* antenna */}
      <line x1="75" y1="18" x2="75" y2="34" stroke={COLORS.purple} strokeWidth="3" strokeLinecap="round" />
      <circle cx="75" cy="14" r="6" fill={COLORS.purple} />

      {/* head */}
      <rect x="35" y="34" width="80" height="60" rx="20" fill={COLORS.sky} />
      <circle cx="58" cy="62" r="7" fill="#fff" />
      <circle cx="92" cy="62" r="7" fill={COLORS.purple} />
      <rect x="58" y="78" width="34" height="4" rx="2" fill="rgba(255,255,255,0.4)" />

      {/* body */}
      <rect x="25" y="100" width="100" height="80" rx="26" fill={COLORS.purple} />
      <rect x="50" y="122" width="50" height="36" rx="12" fill="rgba(255,255,255,0.18)" />
      <text x="75" y="146" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">
        LM
      </text>

      {/* arms */}
      <circle cx="18" cy="130" r="10" fill={COLORS.sky} />
      <circle cx="132" cy="130" r="10" fill={COLORS.sky} />
    </svg>
  );
}
