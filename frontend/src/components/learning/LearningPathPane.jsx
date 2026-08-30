import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2, XCircle, RotateCcw, CheckCircle2, ExternalLink,
  Youtube, FileText, Github, Circle,
} from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import { getLearningPath } from "../../services/learningPathService";

// Kept local rather than imported from TopicContentPane.jsx (which
// doesn't export these) — same values, see that file's module-level
// consts of the same name.
const BAND_COLORS = { fundamentals: "#22C55E", application: "#F59E0B", advanced: "#E0559C", polish: "#7C3AED" };
const FOCUS_BAND_LABELS = { fundamentals: "Fundamentals", application: "Applying It", advanced: "Advanced", polish: "Quick Reference" };
const RESOURCE_ICONS = { documentation: FileText, github: Github };
const CATEGORY_SECTIONS = [
  { key: "practice", label: "🎯 Practice" },
  { key: "reference", label: "📖 Reference & Reading" },
];

/**
 * LearningPathPane — the initial-assessment-driven multi-session view
 * for one (skill, topic): fetches the FULL path in one call
 * (services/learningPathService.getLearningPath), then lets the
 * learner step through each included band as its own session tab.
 *
 * Distinct from TopicContentPane.jsx (which shows exactly one band,
 * fetched by whatever focusBand the caller already decided) — this
 * component IS the thing deciding which bands to show, via the
 * backend's services/learning_path.py band sequence. Deliberately a
 * separate component rather than reusing TopicContentPane, since that
 * component fetches its own single package internally; here all
 * sessions arrive pre-fetched together and we just page through them
 * client-side with no extra network calls per band.
 */
export default function LearningPathPane({ skill, topic }) {
  const [state, setState] = useState("loading"); // loading | error | ready
  const [errorMessage, setErrorMessage] = useState("");
  const [path, setPath] = useState(null); // { skill, topic, currentLevel, bandSequence, sessions: [...] }
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState(() => new Set()); // band names marked "done" this visit, client-side only

  const fetchPath = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    setActiveIndex(0);
    setCompleted(new Set());
    try {
      const result = await getLearningPath(skill, topic);
      setPath(result);
      setState("ready");
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong loading your learning path.");
      setState("error");
    }
  }, [skill, topic]);

  useEffect(() => {
    fetchPath();
  }, [fetchPath]);

  if (state === "loading") {
    return (
      <div
        className="max-w-2xl mx-auto flex flex-col items-center text-center gap-4 py-16 px-8"
        style={{ ...GLASS_CARD, borderRadius: 28 }}
      >
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}>
          <Loader2 size={40} style={{ color: COLORS.purple }} />
        </motion.div>
        <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
          Building your learning path…
        </h3>
        <p className="text-sm" style={{ color: COLORS.textMid }}>
          Putting together every session on {topic}, from where you actually
          need to start. This can take longer the first time — after that
          it's instant for everyone.
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        className="max-w-2xl mx-auto flex flex-col items-center text-center gap-4 py-14 px-8"
        style={{ ...GLASS_CARD, borderRadius: 28 }}
      >
        <XCircle size={40} style={{ color: "#E0559C" }} />
        <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
          Couldn't load your learning path
        </h3>
        <p className="text-sm" style={{ color: COLORS.textMid }}>{errorMessage}</p>
        <motion.button
          onClick={fetchPath}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="mt-2 flex items-center gap-2 font-semibold"
          style={{
            padding: "12px 24px", borderRadius: 9999, color: "#fff", border: "none",
            background: GRADIENTS.purpleSky, cursor: "pointer",
          }}
        >
          <RotateCcw size={16} /> Try Again
        </motion.button>
      </div>
    );
  }

  const { currentLevel, bandSequence, sessions } = path;
  const activeSession = sessions[activeIndex];
  const activeBand = bandSequence[activeIndex];
  const { notes, resourcesByCategory, primaryVideo } = activeSession;
  const categorySections = CATEGORY_SECTIONS.map((section) => ({
    ...section,
    items: resourcesByCategory?.[section.key] || [],
  })).filter((s) => s.items.length > 0);

  const markCurrentDone = () => {
    setCompleted((prev) => new Set(prev).add(activeBand));
    if (activeIndex < sessions.length - 1) setActiveIndex(activeIndex + 1);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Path header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className="px-3 py-1 text-[11px] font-bold rounded-full"
          style={{ background: "rgba(212,160,23,0.15)", color: COLORS.purple }}
        >
          {skill}
        </span>
        {currentLevel && (
          <span
            className="px-3 py-1 text-[11px] font-bold rounded-full"
            style={{ background: "rgba(13,27,61,0.08)", color: COLORS.textMid }}
          >
            Starting from your {currentLevel.toLowerCase()} assessment
          </span>
        )}
      </div>
      <h2 className="text-xl font-bold mb-4" style={{ color: COLORS.textDark }}>{topic}</h2>

      {/* Session stepper — one tab per band in this learner's path */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {bandSequence.map((band, i) => {
          const isActive = i === activeIndex;
          const isDone = completed.has(band);
          return (
            <button
              key={band}
              onClick={() => setActiveIndex(i)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold whitespace-nowrap flex-shrink-0"
              style={{
                borderRadius: 9999,
                border: `1.5px solid ${isActive ? (BAND_COLORS[band] || COLORS.purple) : COLORS.border}`,
                background: isActive ? (BAND_COLORS[band] || COLORS.purple) : "rgba(255,255,255,0.5)",
                color: isActive ? "#fff" : COLORS.textMid,
                cursor: "pointer",
              }}
            >
              {isDone ? <CheckCircle2 size={14} /> : <Circle size={14} style={{ opacity: 0.5 }} />}
              {FOCUS_BAND_LABELS[band] || band}
            </button>
          );
        })}
      </div>

      {/* Active session content */}
      <div className="p-6 mb-6" style={{ ...GLASS_CARD, borderRadius: 24 }}>
        <div className="flex items-center gap-2 mb-3">
          <span
            className="px-2.5 py-1 text-[10px] font-bold rounded-full"
            style={{ background: BAND_COLORS[activeBand] || COLORS.purple, color: "#fff" }}
          >
            Session {activeIndex + 1} of {sessions.length} · {FOCUS_BAND_LABELS[activeBand] || activeBand}
          </span>
        </div>
        <h3 className="text-lg font-bold mb-2" style={{ color: COLORS.textDark }}>{notes.title}</h3>
        <p className="text-sm mb-4" style={{ color: COLORS.textMid }}>{notes.summary}</p>

        {notes.sections?.map((section, i) => (
          <div key={i} className="mb-4">
            {section.heading && (
              <p className="text-sm font-bold mb-1.5" style={{ color: COLORS.textDark }}>{section.heading}</p>
            )}
            <p className="text-sm whitespace-pre-line" style={{ color: COLORS.textMid }}>{section.content}</p>
          </div>
        ))}

        {notes.codeExample && (
          <pre
            className="text-xs p-4 mb-4 overflow-x-auto"
            style={{ borderRadius: 14, background: "rgba(13,27,61,0.06)", color: COLORS.textDark }}
          >
            <code>{notes.codeExample}</code>
          </pre>
        )}

        {notes.keyTakeaways?.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.textLight }}>
              Key Takeaways
            </p>
            <ul className="flex flex-col gap-1.5">
              {notes.keyTakeaways.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: COLORS.textMid }}>
                  <CheckCircle2 size={15} style={{ color: BAND_COLORS[activeBand] || COLORS.purple, flexShrink: 0, marginTop: 2 }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* This band's resources */}
      {(primaryVideo || categorySections.length > 0) && (
        <div className="p-6 mb-6 flex flex-col gap-5" style={{ ...GLASS_CARD, borderRadius: 24 }}>
          {primaryVideo && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: COLORS.textLight }}>
                🎬 Recommended Video
              </p>
              <a
                href={primaryVideo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 no-underline"
                style={{ borderRadius: 14, background: "rgba(255,255,255,0.4)" }}
              >
                <Youtube size={18} style={{ color: "#E0559C", flexShrink: 0 }} />
                <span className="text-sm font-medium flex-1" style={{ color: COLORS.textDark }}>
                  {primaryVideo.title}
                </span>
                <ExternalLink size={14} style={{ color: COLORS.textLight, flexShrink: 0 }} />
              </a>
            </div>
          )}

          {categorySections.map((section) => (
            <div key={section.key}>
              <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: COLORS.textLight }}>
                {section.label}
              </p>
              <div className="flex flex-col gap-2.5">
                {section.items.map((r) => {
                  const Icon = RESOURCE_ICONS[r.type] || FileText;
                  return (
                    <a
                      key={r.id}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 no-underline"
                      style={{ borderRadius: 14, background: "rgba(255,255,255,0.4)" }}
                    >
                      <Icon size={18} style={{ color: COLORS.purple, flexShrink: 0 }} />
                      <span className="text-sm font-medium flex-1" style={{ color: COLORS.textDark }}>
                        {r.title}
                      </span>
                      <ExternalLink size={14} style={{ color: COLORS.textLight, flexShrink: 0 }} />
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session walk controls */}
      <div className="flex items-center justify-between gap-3">
        <motion.button
          onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
          disabled={activeIndex === 0}
          whileHover={activeIndex > 0 ? { x: -2 } : {}}
          className="text-sm font-semibold px-5 py-3"
          style={{
            borderRadius: 9999, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.5)",
            color: activeIndex > 0 ? COLORS.textDark : COLORS.textLight,
            cursor: activeIndex > 0 ? "pointer" : "default", opacity: activeIndex > 0 ? 1 : 0.5,
          }}
        >
          Previous Session
        </motion.button>
        <motion.button
          onClick={markCurrentDone}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="text-sm font-bold px-6 py-3"
          style={{
            borderRadius: 9999, border: "none",
            background: activeIndex < sessions.length - 1 ? GRADIENTS.purplePink : "#22C55E",
            color: "#fff", cursor: "pointer",
          }}
        >
          {activeIndex < sessions.length - 1 ? "Mark Done · Next Session" : "Mark Final Session Done"}
        </motion.button>
      </div>
    </div>
  );
}
