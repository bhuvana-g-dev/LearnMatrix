import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Github, Check, ArrowLeft, Sparkles } from "lucide-react";
import Logo from "../components/common/Logo";
import GoogleIcon from "../components/common/GoogleIcon";
import { COLORS, GRADIENTS } from "../constants/theme";

// Background video for the login screen — served from /public/videos, so
// this path is stable regardless of build hashing. Muted + looped, purely
// decorative (see the <video> element below for accessibility notes).
const LOGIN_BG_VIDEO = "/videos/login-bg.mp4";

// Translucent "glass on dark video" look for this screen only — the
// standard GLASS_CARD (light/opaque) would hide the video, so inputs and
// buttons here use a much lighter, darker-tinted glass instead, with white
// text throughout instead of COLORS.textDark/textMid.
const DARK_GLASS = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.28)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

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
    background: "rgba(255,255,255,0.14)",
    border: `1.5px solid ${
      focused === name ? COLORS.purple : "rgba(255,255,255,0.35)"
    }`,
    boxShadow:
      focused === name ? "0 0 0 4px rgba(212,160,23,0.25)" : "none",
    padding: "13px 16px 13px 44px",
    fontSize: 14,
    color: "#fff",
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
    // No overflow:hidden here — if the form column ever ends up taller
    // than the viewport (small screen + browser chrome), the page simply
    // scrolls instead of clipping content. The video/overlay below are
    // `fixed`, so they still cover the full visible viewport at all
    // times regardless of how tall this wrapper grows.
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", background: COLORS.sky }}>
      {/* Background video — `fixed` + w-screen/h-screen (not w-full/h-full,
          which would only match this wrapper's own box) so it always
          covers the real viewport with no letterboxing, independent of
          how tall the content below grows. */}
      <video
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
        className="fixed inset-0 w-screen h-screen object-cover"
        style={{ zIndex: 0 }}
        src={LOGIN_BG_VIDEO}
      />

      {/* Dark navy overlay so white text stays readable against whatever
          the video is showing — lighter than before since the card itself
          is now much more transparent and needs the video to read through. */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: 1,
          background:
            "linear-gradient(115deg, rgba(13,27,61,0.6) 0%, rgba(13,27,61,0.38) 45%, rgba(13,27,61,0.32) 100%)",
        }}
      />

      {/* Back to Home — top of the page, not tucked inside the form, so
          it reads the same way as the reference design regardless of
          how tall the form column is. */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold"
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            zIndex: 20,
            color: "rgba(255,255,255,0.9)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={14} /> Back to Home
        </button>
      )}

      <div
        className="relative flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-10 px-4 sm:px-10 lg:px-20 py-20"
        style={{ minHeight: "100vh", zIndex: 10 }}
      >
        {/* Brand copy — hidden on small screens so the login form gets
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

        {/* Form column — no big opaque card anymore: content sits
            directly over the video, each control carrying its own
            translucent "glass" background (DARK_GLASS) so the video
            reads through clearly, matching the reference design. The
            column keeps a fixed max-width and natural (not compressed)
            height — see the wrapper comment above re: scrolling. */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <Logo />

          <h1
            className="text-center text-2xl sm:text-3xl font-bold mt-5"
            style={{ color: "#fff" }}
          >
            Welcome Back
          </h1>

          <p
            className="text-center text-sm mt-2 mb-8"
            style={{ color: "rgba(255,255,255,0.75)" }}
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
                  color: "rgba(255,255,255,0.7)",
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
                className="placeholder-white/60"
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
                  color: "rgba(255,255,255,0.7)",
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
                className="placeholder-white/60"
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
                  color: "rgba(255,255,255,0.7)",
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
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                <span
                  onClick={() => setRemember(!remember)}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 5,
                    background: remember
                      ? GRADIENTS.purplePink
                      : "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.5)",
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
                  color: "#F2C744",
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
                style={{ color: resetStatus === "sent" ? "#5EEAB5" : "#FF9EB2" }}
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
                  color: "#FF9EB2",
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
                style={{ color: "rgba(255,255,255,0.75)", marginTop: 4 }}
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
                background: "rgba(255,255,255,0.25)",
              }}
            />
            <span
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              or continue with
            </span>
            <div
              style={{
                height: 1,
                flex: 1,
                background: "rgba(255,255,255,0.25)",
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
                color: "#fff",
                ...DARK_GLASS,
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
                color: "#fff",
                ...DARK_GLASS,
              }}
            >
              <Github size={16} />
              GitHub
            </motion.button>

          </div>

          <p
            className="text-center text-xs mt-7"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            Don't have an account?{" "}
            <span
              onClick={onSignup}
              style={{
                color: "#F2C744",
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
