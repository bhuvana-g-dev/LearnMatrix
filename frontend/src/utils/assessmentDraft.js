/**
 * assessmentDraft — local persistence for an in-progress diagnostic
 * assessment attempt.
 *
 * Why this exists: a diagnostic assessment can be 15-45+ questions across
 * several skills, so a student genuinely thinking through answers can
 * easily spend several minutes on this screen with NO request hitting the
 * backend in between (question generation already happened, evaluation
 * only fires on final submit). On Render's free tier that idle gap is
 * long enough for the backend to spin down — so by the time "Submit" is
 * pressed, that request has to eat a cold start (15-50s) on top of
 * grading. Two problems follow from that:
 *
 *   1. If the tab reloads (or App.jsx's activeKey changes and this
 *      screen unmounts/remounts) before submission, there is nothing
 *      server-side yet to recover — the previous behavior silently
 *      generated a BRAND NEW assessment, discarding every answer.
 *   2. If submission itself times out or fails, the in-progress answers
 *      still need to survive a retry.
 *
 * Storing the generated questions + live answers + current position here
 * (localStorage, keyed per-uid) fixes both: AssessmentScreen restores
 * from this instead of regenerating, and only clears it once the server
 * actually has the final saved result.
 */

const TTL_MS = 6 * 60 * 60 * 1000; // 6h — long enough for a slow, interrupted attempt; short enough not to resurrect a days-old quiz

function keyFor(uid) {
  return `lm_assessment_draft_${uid || "anon"}`;
}

// Role + exact skill set identifies "the same assessment" — if either
// changed since the draft was saved (e.g. a different role picked in
// another tab), the draft is stale and should be ignored, not restored.
function signatureFor(role, skills) {
  return `${role}|${[...skills].sort().join(",")}`;
}

export function loadAssessmentDraft(uid, role, skills) {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft.signature !== signatureFor(role, skills)) return null;
    if (!draft.savedAt || Date.now() - draft.savedAt > TTL_MS) return null;
    if (!Array.isArray(draft.questions) || draft.questions.length === 0) return null;
    return draft;
  } catch {
    return null;
  }
}

export function saveAssessmentDraft(uid, role, skills, { questions, answers, currentIndex }) {
  try {
    localStorage.setItem(
      keyFor(uid),
      JSON.stringify({
        signature: signatureFor(role, skills),
        questions,
        answers,
        currentIndex,
        savedAt: Date.now(),
      })
    );
  } catch {
    // best-effort only (private browsing / storage quota) — never block the quiz on this
  }
}

export function clearAssessmentDraft(uid) {
  try {
    localStorage.removeItem(keyFor(uid));
  } catch {
    // ignore
  }
}
