import { motion } from "framer-motion";
import {
  Target,
  Brain,
  BookOpen,
  Bot,
  Calendar,
  Award,
  ArrowRight,
  Sparkles,
} from "lucide-react";
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

/**
 * HomeScreen — the full-view "About LearnMatrix" landing page shown to a
 * newly logged-in user, before they pick a role. Purely presentational —
 * no data fetching — so it needs no service/hook of its own.
 */
export default function HomeScreen({ onGetStarted }) {
  return (
    <div className="px-4 sm:px-8 py-14 pb-20">
      <div className="max-w-5xl mx-auto">
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
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
    </div>
  );
}