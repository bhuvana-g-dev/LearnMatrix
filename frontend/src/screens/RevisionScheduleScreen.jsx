import { useState, useEffect, useCallback } from "react";
import { RotateCcw, XCircle } from "lucide-react";
import RevisionScheduleSection from "../components/profile/RevisionScheduleSection";
import TopicQuizModal from "../components/learning/TopicQuizModal";
import { getRevisionSchedule, snoozeRevision } from "../services/revisionService";
import { COLORS, GRADIENTS } from "../constants/theme";

/**
 * RevisionScheduleScreen — "Revision" now lives as its own single nav
 * link (constants/navigation.js), not nested under My Profile with two
 * dead sub-links. Owns its own data fetch straight from
 * services/revisionService.js (real backend now, not the old dummy
 * stub) instead of going through useProfile()'s big multi-section
 * bundle, since this page no longer has anything to do with the rest
 * of My Profile.
 *
 * "Completed" was dropped as a section (see RevisionScheduleSection.jsx)
 * since the backend has no separate completed-history log — a topic's
 * only real "done" state is a fresh NextReviewDate after retaking its
 * quiz, which just removes it from `due` on the next fetch.
 */
export default function RevisionScheduleScreen({ uid }) {
  const [state, setState] = useState("loading"); // loading | error | ready
  const [errorMessage, setErrorMessage] = useState("");
  const [due, setDue] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [quizTarget, setQuizTarget] = useState(null); // { skill, topic } | null — "Retake Test"

  const fetchSchedule = useCallback(async () => {
    if (!uid) return;
    setState("loading");
    setErrorMessage("");
    try {
      const { due: dueItems, upcoming: upcomingItems } = await getRevisionSchedule(uid);
      setDue(dueItems);
      setUpcoming(upcomingItems);
      setState("ready");
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong loading your revision schedule.");
      setState("error");
    }
  }, [uid]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleSnooze = async (item) => {
    // Optimistic remove from "due" — if the call fails, refetch below
    // puts it right back, so no separate rollback state needed.
    setDue((prev) => prev.filter((r) => r.id !== item.id));
    try {
      await snoozeRevision(uid, item.skill, item.topic);
    } finally {
      fetchSchedule();
    }
  };

  const handleQuizComplete = () => {
    setQuizTarget(null);
    fetchSchedule(); // submitting clears/reschedules NextReviewDate server-side
  };

  if (state === "loading") {
    return (
      <div className="px-4 sm:px-8 py-10 text-center">
        <p className="text-sm" style={{ color: COLORS.textLight }}>
          Loading your revision schedule...
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="px-4 sm:px-8 py-16 flex flex-col items-center text-center gap-4">
        <XCircle size={36} style={{ color: "#E0559C" }} />
        <h3 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
          Couldn't load your revision schedule
        </h3>
        <p className="text-sm max-w-sm" style={{ color: COLORS.textMid }}>{errorMessage}</p>
        <button
          onClick={fetchSchedule}
          className="flex items-center gap-2 font-semibold"
          style={{
            padding: "12px 24px", borderRadius: 9999, color: "#fff", border: "none",
            background: GRADIENTS.purpleSky, cursor: "pointer",
          }}
        >
          <RotateCcw size={16} /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-10 pb-20">
      <div className="max-w-3xl mx-auto">
        <RevisionScheduleSection
          due={due}
          upcoming={upcoming}
          onRetake={(item) => setQuizTarget({ skill: item.skill, topic: item.topic })}
          onSnooze={handleSnooze}
        />
      </div>

      {quizTarget && (
        <TopicQuizModal
          skill={quizTarget.skill}
          topic={quizTarget.topic}
          uid={uid}
          onClose={() => setQuizTarget(null)}
          onComplete={handleQuizComplete}
        />
      )}
    </div>
  );
}
