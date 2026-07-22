import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Map, ArrowRight, XCircle } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import RoadmapDisplay from "../components/roadmap/RoadmapDisplay";
import { loadSavedRoadmap } from "../services/aiAssessmentService";

/**
 * RoadmapScreen — "My Roadmap" nav item. Loads whatever roadmap was last
 * saved for this user (see backend/services/roadmap_repository.py) via
 * GET /api/roadmap/<uid> — does NOT regenerate anything itself.
 *
 * Three states:
 *   loading -> "empty" (no roadmap saved yet) | "error" | "ready"
 *
 * "empty" is a normal, expected state for a brand-new user, not an error
 * — it just means they haven't taken the diagnostic assessment yet.
 */
export default function RoadmapScreen({ uid, onNavigate, onSelectTopic }) {
  const [state, setState] = useState("loading"); // loading | empty | error | ready
  const [roadmap, setRoadmap] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchRoadmap = useCallback(async () => {
    if (!uid) {
      setState("error");
      setErrorMessage("You need to be logged in to view your roadmap.");
      return;
    }
    setState("loading");
    try {
      const result = await loadSavedRoadmap(uid);
      if (result === null) {
        setState("empty");
      } else {
        setRoadmap(result);
        setState("ready");
      }
    } catch (err) {
      setErrorMessage(err.message || "Couldn't load your roadmap.");
      setState("error");
    }
  }, [uid]);

  useEffect(() => {
    fetchRoadmap();
  }, [fetchRoadmap]);

  if (state === "loading") {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20 flex justify-center">
        <div
          className="max-w-lg w-full flex flex-col items-center text-center gap-4 py-16 px-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}>
            <Loader2 size={40} style={{ color: COLORS.purple }} />
          </motion.div>
          <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            Loading your roadmap…
          </h3>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20 flex justify-center">
        <div
          className="max-w-lg w-full flex flex-col items-center text-center gap-4 py-14 px-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <XCircle size={40} style={{ color: "#E0559C" }} />
          <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            Couldn't load your roadmap
          </h3>
          <p className="text-sm" style={{ color: COLORS.textMid }}>{errorMessage}</p>
          <motion.button
            onClick={fetchRoadmap}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="mt-2 font-semibold"
            style={{
              padding: "12px 24px", borderRadius: 9999, color: "#fff", border: "none",
              background: GRADIENTS.purpleSky, cursor: "pointer",
            }}
          >
            Try Again
          </motion.button>
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="px-4 sm:px-8 pt-10 pb-20 flex justify-center">
        <div
          className="max-w-lg w-full flex flex-col items-center text-center gap-4 py-16 px-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
        >
          <Map size={40} style={{ color: COLORS.purple }} />
          <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            No roadmap yet
          </h3>
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            Take the diagnostic assessment first — your personalized, week-by-week
            roadmap is built from those results.
          </p>
          <motion.button
            onClick={() => onNavigate("initial-assessment")}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="mt-2 flex items-center gap-2 font-semibold"
            style={{
              padding: "14px 28px", borderRadius: 9999, color: "#fff", border: "none",
              background: GRADIENTS.purpleSky, cursor: "pointer",
            }}
          >
            Take the Assessment <ArrowRight size={16} />
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 pt-10 pb-20">
      <div className="max-w-3xl mx-auto">
        <RoadmapDisplay roadmap={roadmap} showProgress onSelectEntry={onSelectTopic} />
      </div>
    </div>
  );
}
