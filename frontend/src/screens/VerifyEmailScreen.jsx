import { useState } from "react";
import { motion } from "framer-motion";
import { MailCheck, RefreshCw, LogOut, Pencil, Check, X } from "lucide-react";
import PageShell from "../components/layout/PageShell";
import Logo from "../components/common/Logo";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
/**
 * VerifyEmailScreen — shown when the person is authenticated but
 * auth.user.emailVerified is still false (App.jsx gates on this). Blocks
 * access to the rest of the app until the verification link is clicked,
 * which is the real defense against fake/typo'd signup emails — a regex
 * can't catch "gmai.com" since it's a syntactically valid domain, and it
 * definitely can't catch a typo inside someone's own username (e.g.
 * "selvameenakshi@gmail.com" instead of "selvameenakshik@gmail.com") since
 * both are syntactically valid addresses that may or may not exist.
 */
export default function VerifyEmailScreen({ auth }) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info"); // info | success | error

  // "Wrong email" editing state — kept separate from the check/resend
  // message above so switching between them doesn't stomp on either.
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [changeMessage, setChangeMessage] = useState("");
  const [changeMessageType, setChangeMessageType] = useState("info");

  const handleCheck = async () => {
    setChecking(true);
    setMessage("");
    try {
      const verified = await auth.refreshVerificationStatus();
      if (!verified) {
        setMessageType("error");
        setMessage("Still not verified — click the link in your email, then try again.");
      }
    } catch {
      setMessageType("error");
      setMessage("Couldn't check verification status. Try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setMessage("");
    try {
      await auth.resendVerification();
      setMessageType("success");
      setMessage("Verification email resent — check your inbox (and spam folder).");
    } catch {
      setMessageType("error");
      setMessage("Couldn't resend the email. Try again in a moment.");
    }
  };

  const openEditEmail = () => {
    setEditingEmail(true);
    setNewEmail(auth.user?.email || "");
    setChangeMessage("");
  };

  const cancelEditEmail = () => {
    setEditingEmail(false);
    setNewEmail("");
    setChangeMessage("");
  };

  const handleChangeEmail = async () => {
    setChangeMessage("");
    const trimmed = newEmail.trim();

    if (!trimmed) {
      setChangeMessageType("error");
      setChangeMessage("Please enter an email address.");
      return;
    }
    if (trimmed === auth.user?.email) {
      setChangeMessageType("error");
      setChangeMessage("That's the same email you already have.");
      return;
    }

    try {
      setChangingEmail(true);
      await auth.changeEmail(trimmed);
      setChangeMessageType("success");
      setChangeMessage(
        `Verification link sent to ${trimmed}. Click it there, then come back and hit "I've verified — check again".`
      );
      setEditingEmail(false);
    } catch (err) {
      setChangeMessageType("error");
      setChangeMessage(err.message || "Couldn't update your email. Try again.");
    } finally {
      setChangingEmail(false);
    }
  };

  return (
    <PageShell>
      <div
        className="flex items-center justify-center px-4 py-10"
        style={{ minHeight: "100vh" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md p-8 text-center"
          style={{ ...GLASS_CARD, borderRadius: 30 }}
        >
          <Logo />

          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto my-6"
            style={{ background: GRADIENTS.purplePink, boxShadow: "0 10px 26px rgba(192,132,252,0.45)" }}
          >
            <MailCheck size={26} color="#fff" />
          </div>

          <h1 className="text-xl font-bold" style={{ color: COLORS.textDark }}>
            Verify your email
          </h1>
          <p className="text-sm mt-3" style={{ color: COLORS.textMid }}>
            We sent a verification link to{" "}
            <strong style={{ color: COLORS.textDark }}>{auth.user?.email}</strong>. Click it,
            then come back here.
          </p>

          {!editingEmail && (
            <button
              type="button"
              onClick={openEditEmail}
              className="flex items-center gap-1 mx-auto text-xs font-semibold mt-2"
              style={{ color: "#8B5CF6", background: "none", border: "none", cursor: "pointer" }}
            >
              <Pencil size={12} /> Wrong email? Change it
            </button>
          )}

          {editingEmail && (
            <div className="mt-4 text-left">
              <input
                type="email"
                autoFocus
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="your.correct@email.com"
                disabled={changingEmail}
                style={{
                  width: "100%",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.6)",
                  border: "1px solid rgba(255,255,255,0.8)",
                  padding: "11px 14px",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <div className="flex gap-2 mt-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={handleChangeEmail}
                  disabled={changingEmail}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold"
                  style={{
                    padding: "10px",
                    borderRadius: 9999,
                    border: "none",
                    background: GRADIENTS.purpleSky,
                    color: "#fff",
                    cursor: changingEmail ? "default" : "pointer",
                    opacity: changingEmail ? 0.8 : 1,
                  }}
                >
                  <Check size={14} />
                  {changingEmail ? "Sending..." : "Send link to this email"}
                </motion.button>
                <button
                  type="button"
                  onClick={cancelEditEmail}
                  disabled={changingEmail}
                  className="flex items-center justify-center"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 9999,
                    border: `1px solid ${COLORS.border}`,
                    background: "rgba(255,255,255,0.55)",
                    cursor: changingEmail ? "default" : "pointer",
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {changeMessage && (
            <p
              className="text-xs mt-3"
              style={{ color: changeMessageType === "success" ? "#22C08E" : "#E4568A" }}
            >
              {changeMessage}
            </p>
          )}

          {message && (
            <p
              className="text-xs mt-4"
              style={{ color: messageType === "success" ? "#22C08E" : "#E4568A" }}
            >
              {message}
            </p>
          )}

          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCheck}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 mt-6"
            style={{
              padding: "13px",
              borderRadius: 9999,
              border: "none",
              background: GRADIENTS.purpleSky,
              color: "#fff",
              fontWeight: 700,
              cursor: checking ? "default" : "pointer",
              opacity: checking ? 0.85 : 1,
            }}
          >
            <RefreshCw size={15} />
            {checking ? "Checking..." : "I've verified — check again"}
          </motion.button>

          <button
            onClick={handleResend}
            className="text-xs font-semibold mt-4"
            style={{ color: "#8B5CF6", background: "none", border: "none", cursor: "pointer" }}
          >
            Resend verification email
          </button>

          <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <button
              onClick={auth.logout}
              className="flex items-center gap-1.5 mx-auto text-xs font-semibold"
              style={{ color: "#E4568A", background: "none", border: "none", cursor: "pointer" }}
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </motion.div>
      </div>
    </PageShell>
  );
}
