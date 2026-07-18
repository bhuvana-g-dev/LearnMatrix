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
} from "lucide-react";
import Logo from "../components/common/Logo";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";

const FEATURES = [
  {
    icon: Target,
    title: "Role-Based Career Paths",
    desc: "Pick an IT career — Full Stack, Cyber Security, Data Analyst, and more — and get a path built around it.",
  },
  {
    icon: Brain,
    title: "Adaptive Assessments",
    desc: "Initial assessments, topic quizzes, and practice tests that adjust to where you actually stand.",
  },
  {
    icon: BookOpen,
    title: "Structured Learning",
    desc: "A roadmap, learning sessions, and curated resources for every skill in your chosen path.",
  },
  {
    icon: Bot,
    title: "AI Study Assistant",
    desc: "Chat, flashcards, mind maps, and audio overviews to help concepts actually stick.",
  },
  {
    icon: Calendar,
    title: "AI Revision Scheduler",
    desc: "A revision plan that resurfaces topics right when you're about to forget them.",
  },
  {
    icon: Award,
    title: "Certificates",
    desc: "Earn verifiable certificates as you complete courses — ready to share on LinkedIn.",
  },
];

const STEPS = [
  { n: "01", title: "Choose your path", desc: "Select the IT career you want to master." },
  { n: "02", title: "Learn & get assessed", desc: "Work through skills with AI-adjusted assessments." },
  { n: "03", title: "Revise & earn", desc: "Stay sharp with AI revision, then earn your certificate." },
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

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: GRADIENTS.purplePink, boxShadow: "0 10px 26px rgba(192,132,252,0.45)" }}
          >
            <Sparkles size={26} color="#fff" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold" style={{ color: COLORS.textDark }}>
            Welcome to LearnMatrix
          </h1>
          <p className="mt-4 text-sm sm:text-base max-w-xl mx-auto" style={{ color: COLORS.textMid }}>
            Your AI-powered adaptive learning platform — pick an IT career path, learn at your
            own pace, and let AI keep your assessments, revisions, and progress on track.
          </p>

          <motion.button
            whileHover={{ y: -2, boxShadow: "0 12px 28px rgba(192,132,252,0.55)" }}
            whileTap={{ scale: 0.98 }}
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 font-semibold mt-8"
            style={{
              padding: "14px 34px",
              borderRadius: 9999,
              color: "#fff",
              border: "none",
              background: GRADIENTS.purpleSky,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
            }}
          >
            Get Started <ArrowRight size={16} />
          </motion.button>
        </motion.div>

        {/* Feature grid */}
        <div id="home-features" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                whileHover={{ y: -4 }}
                className="p-5"
                style={{ ...GLASS_CARD, borderRadius: 24 }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "linear-gradient(135deg, rgba(192,132,252,0.35), rgba(125,211,252,0.3))" }}
                >
                  <Icon size={18} color="#8B5CF6" />
                </div>
                <h3 className="text-sm font-bold" style={{ color: COLORS.textDark }}>
                  {f.title}
                </h3>
                <p className="text-xs mt-1.5 leading-snug" style={{ color: COLORS.textMid }}>
                  {f.desc}
                </p>
              </motion.div>
            );
          })}
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
          <h2 className="text-lg sm:text-xl font-bold text-center mb-8" style={{ color: COLORS.textDark }}>
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <p
                  className="text-2xl font-bold mb-2"
                  style={{
                    background: GRADIENTS.purplePink,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {s.n}
                </p>
                <h3 className="text-sm font-bold" style={{ color: COLORS.textDark }}>
                  {s.title}
                </h3>
                <p className="text-xs mt-1.5" style={{ color: COLORS.textMid }}>
                  {s.desc}
                </p>
              </div>
            ))}
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
