import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Map, ArrowRight, XCircle } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { ROLES } from "../constants/roles";
import RoadmapDisplay from "../components/roadmap/RoadmapDisplay";
import { loadSavedRoadmap, loadSavedAssessmentResult } from "../services/aiAssessmentService";
import { getCompressedRoleSyllabus } from "../services/syllabusService";

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
export default function RoadmapScreen({ uid, onNavigate, onSelectTopic, onStartJourney }) {
  const [state, setState] = useState("loading"); // loading | empty | error | ready
  const [roadmap, setRoadmap] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [compressedSyllabus, setCompressedSyllabus] = useState(null);

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

  // Topic-level compressed syllabus for RoadmapDisplay's expand affordance.
  // Preferred source: it's now persisted directly on the roadmap doc
  // (backend/services/roadmap_repository.py) whenever the roadmap was
  // generated with a roleId — no extra call needed, and no more relying
  // on a fragile role-TITLE -> role-ID lookup.
  //
  // Fallback: roadmaps saved BEFORE this was persisted won't have the
  // field yet, so for those we fall back to the old best-effort live
  // fetch. Purely additive either way — if it fails (role not seeded
  // yet, saved assessment missing, etc.) the screen still works exactly
  // as before, just without the expand affordance on each entry.
  useEffect(() => {
    if (state !== "ready" || !uid) return;

    if (roadmap?.compressedSyllabus) {
      setCompressedSyllabus(roadmap.compressedSyllabus);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const savedAssessment = await loadSavedAssessmentResult(uid);
        if (!savedAssessment || !savedAssessment.evaluation) return;

        // savedAssessment.role is stored as the role TITLE (e.g.
        // "Frontend Developer" — see AssessmentScreen's calls to
        // evaluateDiagnosticAssessment/generateRoadmap), but the
        // syllabus endpoints key on roleId (e.g. "frontend").
        const roleEntry = ROLES.find((r) => r.title === savedAssessment.role);
        if (!roleEntry) return; // role not resolvable, skip silently

        const syllabus = await getCompressedRoleSyllabus(roleEntry.id, savedAssessment.evaluation);
        if (!cancelled) setCompressedSyllabus(syllabus);
      } catch {
        // Silent — this role/skill set may not be seeded yet
        // (data/skill_syllabus_seed.py only covers "frontend" so far).
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, uid, roadmap]);

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
        <RoadmapDisplay
          roadmap={roadmap}
          showProgress
          onSelectEntry={onSelectTopic}
          compressedSyllabus={compressedSyllabus}
          onStartJourney={
            onStartJourney
              ? (startEntry) => onStartJourney({ roadmap, compressedSyllabus, initialEntry: startEntry })
              : undefined
          }
        />
      </div>
    </div>
  );
}
