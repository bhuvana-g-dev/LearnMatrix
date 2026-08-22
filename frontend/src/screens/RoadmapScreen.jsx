import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Map, ArrowRight, XCircle, LogOut } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { ROLES } from "../constants/roles";
import RoadmapDisplay from "../components/roadmap/RoadmapDisplay";
import QuitRoleModal from "../components/roadmap/QuitRoleModal";
import { loadSavedRoadmap, loadSavedAssessmentResult, quitRole } from "../services/aiAssessmentService";
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
 *
 * "Quit Role" (top-right, "ready" state only) is the ONLY way back to
 * Role Selection once a role has been chosen — see QuitRoleModal.jsx
 * and services/aiAssessmentService.js's quitRole(). Confirming there
 * deletes the saved assessment + roadmap and calls onRoleQuit (wired in
 * App.jsx) to reset careerPath state and navigate to Role Selection.
 */
export default function RoadmapScreen({
  uid, onNavigate, onSelectTopic, onStartJourney, onRoleQuit,
  // Cache lifted up to App.jsx so it survives this screen unmounting when
  // the learner navigates elsewhere (Course Workspace, Learning Session,
  // etc.) and back — without it, every return trip to "My Roadmap" remounts
  // this component from scratch and flashes the full "Loading your
  // roadmap…" spinner again even though nothing changed server-side.
  // cachedRoadmap: { roadmap, compressedSyllabus } | null
  cachedRoadmap, onRoadmapLoaded,
}) {
  const [state, setState] = useState(cachedRoadmap?.roadmap ? "ready" : "loading"); // loading | empty | error | ready
  const [roadmap, setRoadmap] = useState(cachedRoadmap?.roadmap ?? null);
  const [errorMessage, setErrorMessage] = useState("");
  const [compressedSyllabus, setCompressedSyllabus] = useState(cachedRoadmap?.compressedSyllabus ?? null);
  const [showQuitModal, setShowQuitModal] = useState(false);

  const fetchRoadmap = useCallback(async (opts) => {
    // silent = refresh in the background without dropping back to the
    // full-page spinner — used when we already have a cached roadmap to
    // show while the fresh copy loads.
    const silent = !!(opts && opts.silent);
    if (!uid) {
      setState("error");
      setErrorMessage("You need to be logged in to view your roadmap.");
      return;
    }
    if (!silent) setState("loading");
    try {
      const result = await loadSavedRoadmap(uid);
      if (result === null) {
        setState("empty");
      } else {
        setRoadmap(result);
        setState("ready");
        onRoadmapLoaded?.({ roadmap: result });
      }
    } catch (err) {
      if (silent) return; // keep showing the cached roadmap; don't disrupt the learner
      setErrorMessage(err.message || "Couldn't load your roadmap.");
      setState("error");
    }
  }, [uid, onRoadmapLoaded]);

  useEffect(() => {
    fetchRoadmap({ silent: !!cachedRoadmap?.roadmap });
    // Only re-run when the signed-in user changes — fetchRoadmap's own
    // identity already covers that (see its deps above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (compressedSyllabus) return; // already have it (fresh fetch or cache) — skip re-fetching

    if (roadmap?.compressedSyllabus) {
      setCompressedSyllabus(roadmap.compressedSyllabus);
      onRoadmapLoaded?.({ compressedSyllabus: roadmap.compressedSyllabus });
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
        if (!cancelled) {
          setCompressedSyllabus(syllabus);
          onRoadmapLoaded?.({ compressedSyllabus: syllabus });
        }
      } catch {
        // Silent — this role/skill set may not be seeded yet
        // (data/skill_syllabus_seed.py only covers "frontend" so far).
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, uid, roadmap, compressedSyllabus, onRoadmapLoaded]);

  const handleQuitRole = async () => {
    // Wipes the saved assessment + roadmap (backend) and resets
    // careerPath state (App.jsx), then sends the student back to
    // Role Selection — the ONLY path there once a role is chosen.
    await quitRole(uid);
    setShowQuitModal(false);
    // Clear the lifted cache too — otherwise the NEXT role's fresh
    // RoadmapScreen mount would see a stale cachedRoadmap from the role
    // just quit and skip straight to "ready" with the wrong data.
    onRoadmapLoaded?.({ roadmap: undefined, compressedSyllabus: undefined, reset: true });
    if (onRoleQuit) onRoleQuit();
  };

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
            onClick={() => fetchRoadmap()}
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
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowQuitModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{
              padding: "9px 16px", borderRadius: 9999, color: "#E0559C",
              border: "1px solid rgba(224,85,156,0.35)", background: "rgba(224,85,156,0.08)",
              cursor: "pointer",
            }}
          >
            <LogOut size={13} /> Quit Role
          </button>
        </div>

        <RoadmapDisplay
          roadmap={roadmap}
          showProgress
          onSelectEntry={
            onStartJourney
              ? (entry) => onStartJourney({ roadmap, compressedSyllabus, initialEntry: entry })
              : onSelectTopic
          }
          compressedSyllabus={compressedSyllabus}
          onStartJourney={
            onStartJourney
              ? (startEntry) => onStartJourney({ roadmap, compressedSyllabus, initialEntry: startEntry })
              : undefined
          }
        />
      </div>

      {showQuitModal && (
        <QuitRoleModal
          roleTitle={roadmap.role || "this role"}
          onClose={() => setShowQuitModal(false)}
          onConfirm={handleQuitRole}
        />
      )}
    </div>
  );
}
