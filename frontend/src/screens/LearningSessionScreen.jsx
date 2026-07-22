import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2, XCircle, RotateCcw, BookOpen, Code2,
  CheckCircle2, ExternalLink, Youtube, FileText, Github,
} from "lucide-react";
import BackButton from "../components/common/BackButton";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { getTopicPackage } from "../services/learningContentService";

const RESOURCE_ICONS = { video: Youtube, documentation: FileText, github: Github };

const FOCUS_BAND_LABELS = {
  fundamentals: "Fundamentals",
  application: "Applying It",
  advanced: "Advanced",
  polish: "Quick Reference",
};

/**
 * LearningSessionScreen — the actual content-delivery page for one
 * roadmap week: AI-generated (cached) notes at the student's current
 * focusBand, plus any admin-verified curated resources for that topic.
 *
 * Reached by clicking a roadmap entry (see RoadmapDisplay.jsx's
 * onSelectEntry). skill/topic/focusBand are passed down from App.jsx's
 * navigation state — this screen has no routing of its own.
 */
export default function LearningSessionScreen({ skill, topic, focusBand, onBack }) {
  const [state, setState] = useState("loading"); // loading | error | ready
  const [errorMessage, setErrorMessage] = useState("");
  const [pkg, setPkg] = useState(null);

  const fetchContent = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    try {
      const result = await getTopicPackage(skill, topic, focusBand);
      setPkg(result);
      setState("ready");
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong loading this topic.");
      setState("error");
    }
  }, [skill, topic, focusBand]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  if (state === "loading") {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20">
        <BackButton onClick={onBack} label="Back to Roadmap" />
        <div
          className="max-w-2xl mx-auto flex flex-col items-center text-center gap-4 py-16 px-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}>
            <Loader2 size={40} style={{ color: COLORS.purple }} />
          </motion.div>
          <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            Preparing your learning session…
          </h3>
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            Loading notes on {topic}. The first time anyone studies this at your
            level, this takes a little longer — after that it's instant for everyone.
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20">
        <BackButton onClick={onBack} label="Back to Roadmap" />
        <div
          className="max-w-2xl mx-auto flex flex-col items-center text-center gap-4 py-14 px-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <XCircle size={40} style={{ color: "#E0559C" }} />
          <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            Couldn't load this topic
          </h3>
          <p className="text-sm" style={{ color: COLORS.textMid }}>{errorMessage}</p>
          <motion.button
            onClick={fetchContent}
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
      </div>
    );
  }

  const { notes, resources } = pkg;

  return (
    <div className="px-4 sm:px-8 pt-10 pb-20">
      <BackButton onClick={onBack} label="Back to Roadmap" />

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="px-3 py-1 text-[11px] font-bold rounded-full"
            style={{ color: COLORS.purple, background: "rgba(212,160,23,0.14)" }}
          >
            {skill}
          </span>
          <span
            className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide rounded-full"
            style={{ color: "#fff", background: GRADIENTS.purpleSky }}
          >
            {FOCUS_BAND_LABELS[focusBand] || focusBand}
          </span>
        </div>

        {/* Notes */}
        <div className="p-7 mb-6" style={{ ...GLASS_CARD, borderRadius: 24 }}>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={18} style={{ color: COLORS.purple }} />
            <h1 className="text-xl font-extrabold" style={{ color: COLORS.textDark }}>
              {notes.title}
            </h1>
          </div>
          <p className="text-sm mb-6" style={{ color: COLORS.textMid }}>{notes.summary}</p>

          <div className="flex flex-col gap-5">
            {notes.sections.map((section, i) => (
              <div key={i}>
                <h3 className="text-sm font-bold mb-1.5" style={{ color: COLORS.textDark }}>
                  {section.heading}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: COLORS.textMid }}>
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          {notes.codeExample && (
            <div className="mt-6">
              <div className="flex items-center gap-1.5 mb-2">
                <Code2 size={14} style={{ color: COLORS.textLight }} />
                <span className="text-xs font-semibold" style={{ color: COLORS.textLight }}>
                  Example
                </span>
              </div>
              <pre
                className="text-xs p-4 overflow-x-auto"
                style={{ borderRadius: 14, background: "rgba(13,27,61,0.06)", color: COLORS.textDark }}
              >
                <code>{notes.codeExample}</code>
              </pre>
            </div>
          )}

          <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.textLight }}>
              Key Takeaways
            </p>
            <div className="flex flex-col gap-1.5">
              {notes.keyTakeaways.map((point, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={14} style={{ color: "#22C55E", flexShrink: 0, marginTop: 3 }} />
                  <span className="text-sm" style={{ color: COLORS.textDark }}>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Curated resources — only ever "verified" ones, see backend docs */}
        {resources.length > 0 && (
          <div className="p-6 mb-6" style={{ ...GLASS_CARD, borderRadius: 24 }}>
            <h3 className="text-base font-bold mb-4" style={{ color: COLORS.textDark }}>
              Recommended Resources
            </h3>
            <div className="flex flex-col gap-2.5">
              {resources.map((r) => {
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
        )}
      </div>
    </div>
  );
}
