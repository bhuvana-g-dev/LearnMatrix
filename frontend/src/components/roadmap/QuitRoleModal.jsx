import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";

/**
 * QuitRoleModal — the ONLY way back to Role Selection once a role has
 * been chosen (see App.jsx / CareerStatusScreen.jsx). Requires typing
 * an exact confirmation phrase so a student can't quit a role by
 * accident — this wipes their saved assessment + roadmap for good.
 *
 * `roleTitle` is the student's CURRENT role (e.g. "Frontend Developer"),
 * shown so the phrase they must type is unambiguous about which course
 * they're leaving.
 */
export default function QuitRoleModal({ roleTitle, onClose, onConfirm }) {
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requiredPhrase = `I am quitting ${roleTitle}`;
  const matches = typed.trim().toLowerCase() === requiredPhrase.toLowerCase();

  const handleConfirm = async () => {
    if (!matches || loading) return;
    setError("");
    setLoading(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message || "Couldn't quit this role. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={loading ? undefined : onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(13,27,61,0.45)", zIndex: 60 }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        className="fixed inset-0 flex items-center justify-center px-4"
        style={{ zIndex: 70, pointerEvents: "none" }}
      >
        <div
          className="w-full max-w-md p-7"
          style={{ ...GLASS_CARD, background: "rgba(255,255,255,0.94)", borderRadius: 28, pointerEvents: "auto" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: "#E0559C" }} />
              <h2 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
                Quit {roleTitle}?
              </h2>
            </div>
            {!loading && (
              <button
                onClick={onClose}
                aria-label="Close"
                style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: 10, width: 30, height: 30, cursor: "pointer" }}
              >
                <X size={15} style={{ margin: "0 auto" }} />
              </button>
            )}
          </div>

          <p className="text-sm mb-4" style={{ color: COLORS.textMid }}>
            This permanently deletes your diagnostic assessment and roadmap for{" "}
            <strong>{roleTitle}</strong>, and unlocks Role Selection so you can start a
            different course. This can't be undone.
          </p>

          <p className="text-xs font-semibold mb-2" style={{ color: COLORS.textDark }}>
            Type <span style={{ color: "#E0559C" }}>"{requiredPhrase}"</span> to confirm:
          </p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requiredPhrase}
            disabled={loading}
            className="w-full mb-4"
            style={{
              borderRadius: 14,
              background: "rgba(255,255,255,0.6)",
              border: `1px solid ${COLORS.border}`,
              padding: "12px 16px",
              fontSize: 14,
              outline: "none",
              color: COLORS.textDark,
            }}
          />

          {error && (
            <p className="text-xs font-semibold mb-3" style={{ color: "#E0559C" }}>
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={loading}
              className="font-semibold text-sm"
              style={{
                padding: "12px 22px", borderRadius: 9999, color: COLORS.textDark,
                border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.5)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <motion.button
              onClick={handleConfirm}
              disabled={!matches || loading}
              whileHover={matches && !loading ? { y: -2 } : {}}
              whileTap={matches && !loading ? { scale: 0.97 } : {}}
              className="flex items-center gap-2 font-semibold text-sm"
              style={{
                padding: "12px 22px", borderRadius: 9999, color: "#fff", border: "none",
                background: matches ? GRADIENTS.purplePink : "#C9C4D6",
                opacity: matches && !loading ? 1 : 0.65,
                cursor: matches && !loading ? "pointer" : "not-allowed",
              }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              Quit Role
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
