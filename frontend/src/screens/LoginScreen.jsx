import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Github, Check, ArrowLeft, Sparkles } from "lucide-react";
import Logo from "../components/common/Logo";
import GoogleIcon from "../components/common/GoogleIcon";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";

// Background video for the login screen — served from /public/videos, so
// this path is stable regardless of build hashing. Muted + looped, purely
// decorative (see the <video> element below for accessibility notes).
const LOGIN_BG_VIDEO = "/videos/login-bg.mp4";

export default function LoginScreen({ auth, onSuccess, onSignup, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [focused, setFocused] = useState("");
  const [resetStatus, setResetStatus] = useState("idle"); // idle | sending | sent | error
  const [resetMessage, setResetMessage] = useState("");

  const inputStyle = (name) => ({
    width: "100%",
    borderRadius: 16,
    background: "rgba(255,255,255,0.55)",
    border: `1.5px solid ${
      focused === name ? COLORS.purple : "rgba(255,255,255,0.7)"
    }`,
    boxShadow:
      focused === name ? "0 0 0 4px rgba(192,132,252,0.25)" : "none",
    padding: "13px 16px 13px 44px",
    fontSize: 14,
    color: COLORS.textDark,
    outline: "none",
    transition: "all .25s ease",
  });

  const handleLogin = async () => {
    try {
      await auth.login({ email, password, remember });
      onSuccess();
    } catch (e) {}
  };

  // Firebase blocks a second provider from signing in under an email
  // that's already registered with a different one
  // ("auth/account-exists-with-different-credential") — useAuth.js's
  // loginGoogle/loginGithub catch that and set auth.linkPrompt with the
  // email + which provider already owns it, instead of leaving the user
  // stuck on Firebase's raw error text. When that provider is the
  // password account, prefill the email field so all they have to do is
  // type their password and hit Login — doing so completes the
  // connection automatically (see useAuth.js's maybeCompleteLink).
  useEffect(() => {
    if (auth.linkPrompt?.existingMethods?.includes("password") && auth.linkPrompt.email) {
      setEmail(auth.linkPrompt.email);
    }
  }, [auth.linkPrompt]);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setResetStatus("error");
      setResetMessage("Enter your email above first, then click Forgot Password.");
      return;
    }

    try {
      setResetStatus("sending");
      setResetMessage("");
      await auth.resetPassword(email.trim());
      setResetStatus("sent");
      setResetMessage(`Reset link sent to ${email.trim()} — check your inbox.`);
    } catch {
      setResetStatus("error");
      setResetMessage(auth.error || "Couldn't send the reset email. Check the address and try again.");
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", overflow: "hidden", background: COLORS.sky }}>
      {/* Background video — autoplay/muted/loop/playsInline so it plays
          inline without controls on both desktop and mobile browsers. */}
      <video
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        src={LOGIN_BG_VIDEO}
      />

      {/* Dark navy overlay so the white hero copy and the glass card both
          stay readable against whatever the video is showing. Slightly
          heavier on the left (behind the text) and lighter toward the
          card on the right, which already has its own blur/tint. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, rgba(13,27,61,0.72) 0%, rgba(13,27,61,0.45) 45%, rgba(13,27,61,0.25) 100%)",
        }}
      />

      <div
        className="relative flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-10 px-4 sm:px-10 lg:px-20 py-10"
        style={{ minHeight: "100vh", zIndex: 10 }}
      >
        {/* Brand copy — hidden on small screens so the login card gets
            full attention there; shown alongside it from lg breakpoint up. */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex flex-col items-start max-w-md"
        >
          <Logo />
          <h1 className="text-3xl sm:text-4xl font-bold mt-6" style={{ color: "#fff" }}>
            Learn. Connect. Grow.
          </h1>
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold mt-5"
            style={{
              padding: "8px 18px",
              borderRadius: 9999,
              background: "rgba(255,255,255,0.16)",
              color: "#fff",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <Sparkles size={13} /> An AI Powered Adaptive Learning Platform
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md p-8 sm:p-10"
          style={{ ...GLASS_CARD, borderRadius: 30 }}
        >
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-semibold mb-5"
              style={{ color: COLORS.textMid, background: "none", border: "none", cursor: "pointer" }}
            >
              <ArrowLeft size={14} /> Back to Home
            </button>
          )}

          <Logo />

          <h1
            className="text-center text-2xl sm:text-3xl font-bold mt-5"
            style={{ color: COLORS.textDark }}
          >
            Welcome Back
          </h1>

          <p
            className="text-center text-sm mt-2 mb-8"
            style={{ color: COLORS.textMid }}
          >
            Login to continue your learning journey
          </p>

          <div className="space-y-4">

            {/* Email */}
            <div style={{ position: "relative" }}>
              <Mail
                size={17}
                style={{
                  position: "absolute",
                  left: 15,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: COLORS.textLight,
                }}
              />

              <input
                type="email"
                placeholder="Username / Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (resetStatus !== "idle") {
                    setResetStatus("idle");
                    setResetMessage("");
                  }
                }}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused("")}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleLogin()
                }
                style={inputStyle("email")}
              />
            </div>

            {/* Password */}
            <div style={{ position: "relative" }}>
              <Lock
                size={17}
                style={{
                  position: "absolute",
                  left: 15,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: COLORS.textLight,
                }}
              />

              <input
                type={showPw ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("pw")}
                onBlur={() => setFocused("")}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleLogin()
                }
                style={{
                  ...inputStyle("pw"),
                  paddingRight: 44,
                }}
              />

              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: "absolute",
                  right: 15,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {showPw ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label
                className="flex items-center gap-2"
                style={{ color: COLORS.textMid }}
              >
                <span
                  onClick={() => setRemember(!remember)}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 5,
                    background: remember
                      ? GRADIENTS.purplePink
                      : "#fff",
                    border: "1px solid #ccc",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  {remember && (
                    <Check size={11} color="#fff" />
                  )}
                </span>

                Remember Me
              </label>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetStatus === "sending"}
                style={{
                  color: "#8B5CF6",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: resetStatus === "sending" ? "default" : "pointer",
                  padding: 0,
                  font: "inherit",
                }}
              >
                {resetStatus === "sending" ? "Sending..." : "Forgot Password?"}
              </button>
            </div>

            {resetMessage && (
              <p
                className="text-xs -mt-1"
                style={{ color: resetStatus === "sent" ? "#22C08E" : "#E4568A" }}
              >
                {resetMessage}
              </p>
            )}

            {/* Login Button */}
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogin}
              disabled={auth.loading}
              className="w-full"
              style={{
                padding: "14px 0",
                borderRadius: 9999,
                background: GRADIENTS.purplePink,
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              {auth.loading ? "Logging in..." : "Login"}
            </motion.button>

            {/* Error */}
            {auth.error && (
              <p
                className="text-center text-sm"
                style={{
                  color: "#E4568A",
                  marginTop: 8,
                }}
              >
                {auth.error}
              </p>
            )}

            {/* Account-linking guidance — see the useEffect above and
                useAuth.js's linkPrompt/maybeCompleteLink. Only the
                "already uses Google" case needs an extra instruction
                pointing at the Google button below; the password case
                is self-explanatory once the email field is prefilled. */}
            {auth.linkPrompt?.existingMethods?.includes("google.com") && (
              <p
                className="text-center text-xs"
                style={{ color: COLORS.textMid, marginTop: 4 }}
              >
                Click <strong>Google</strong> below to sign in and connect GitHub to that account.
              </p>
            )}

          </div>

          <div className="flex items-center gap-3 my-6">
            <div
              style={{
                height: 1,
                flex: 1,
                background: COLORS.border,
              }}
            />
            <span
              className="text-xs"
              style={{ color: COLORS.textLight }}
            >
              or continue with
            </span>
            <div
              style={{
                height: 1,
                flex: 1,
                background: COLORS.border,
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">

            <motion.button
              whileHover={{ y: -2 }}
              onClick={async () => {
                try {
                  await auth.loginGoogle();
                  onSuccess();
                } catch (e) {
                  // auth.error / auth.linkPrompt already reflect what
                  // happened (see useAuth.js) — nothing else to do here.
                }
              }}
              className="flex items-center justify-center gap-2"
              style={{
                padding: "10px",
                borderRadius: 9999,
              }}
            >
              <GoogleIcon />
              Google
            </motion.button>

            <motion.button
              whileHover={{ y: -2 }}
              onClick={async () => {
                try {
                  await auth.loginGithub();
                  onSuccess();
                } catch (e) {
                  // auth.error / auth.linkPrompt already reflect what
                  // happened (see useAuth.js) — nothing else to do here.
                }
              }}
              className="flex items-center justify-center gap-2"
              style={{
                padding: "10px",
                borderRadius: 9999,
              }}
            >
              <Github size={16} />
              GitHub
            </motion.button>

          </div>

          <p
            className="text-center text-xs mt-7"
            style={{ color: COLORS.textMid }}
          >
            Don't have an account?{" "}
            <span
              onClick={onSignup}
              style={{
                color: "#8B5CF6",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Sign Up
            </span>
          </p>

        </motion.div>
      </div>
    </div>
  );
}
