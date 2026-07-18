import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, User, CheckCircle2, ArrowLeft } from "lucide-react";
import PageShell from "../components/layout/PageShell";
import Logo from "../components/common/Logo";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";

// Catches format mistakes (missing @, no domain, no TLD, spaces, etc).
// It can't catch a typo'd-but-syntactically-valid domain like
// "gmai.com" — only the verification email sent on signup (and the
// verify-email gate in App.jsx) can catch that.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUpScreen({ auth, onLogin, onSuccess, onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const inputStyle = {
    width: "100%",
    borderRadius: 16,
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.7)",
    padding: "13px 16px 13px 44px",
    fontSize: 14,
    outline: "none",
  };

  const handleSignup = async () => {
    setError("");
    setSuccessMessage("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await auth.signup(name.trim(), email.trim(), password);
      setSuccessMessage(
        `Account created! We've sent a verification link to ${email.trim()} — click it to unlock the app.`
      );
      setTimeout(() => {
        (onSuccess || onLogin)?.();
      }, 1600);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div
        className="flex items-center justify-center px-4 py-10"
        style={{ minHeight: "100vh" }}
      >
        <div
          className="w-full max-w-md p-8"
          style={{ ...GLASS_CARD, borderRadius: 28 }}
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
            className="text-center text-3xl font-bold mt-5"
            style={{ color: COLORS.textDark }}
          >
            Create Account
          </h1>

          <p
            className="text-center text-sm mb-8"
            style={{ color: COLORS.textMid }}
          >
            Start your LearnMatrix journey
          </p>

          <div className="space-y-4">

            <div style={{ position: "relative" }}>
              <User
                size={17}
                style={{
                  position: "absolute",
                  left: 15,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />

              <input
                style={inputStyle}
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading || !!successMessage}
              />
            </div>

            <div style={{ position: "relative" }}>
              <Mail
                size={17}
                style={{
                  position: "absolute",
                  left: 15,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />

              <input
                type="email"
                style={inputStyle}
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || !!successMessage}
              />
            </div>

            <div style={{ position: "relative" }}>
              <Lock
                size={17}
                style={{
                  position: "absolute",
                  left: 15,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />

              <input
                type={showPw ? "text" : "password"}
                style={{ ...inputStyle, paddingRight: 40 }}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || !!successMessage}
              />

              <button
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: "absolute",
                  right: 15,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                }}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <Lock
                size={17}
                style={{
                  position: "absolute",
                  left: 15,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />

              <input
                type="password"
                style={inputStyle}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || !!successMessage}
              />
            </div>

            {error && (
              <p
                className="text-center text-sm"
                style={{ color: "red" }}
              >
                {error}
              </p>
            )}

            {successMessage && (
              <div
                className="flex items-start gap-2 text-sm p-3"
                style={{ borderRadius: 14, background: "rgba(34,192,142,0.12)", color: "#22C08E" }}
              >
                <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignup}
              disabled={loading || !!successMessage}
              className="w-full"
              style={{
                padding: "14px",
                borderRadius: 9999,
                border: "none",
                background: GRADIENTS.purplePink,
                color: "#fff",
                fontWeight: 700,
                cursor: loading || successMessage ? "default" : "pointer",
                opacity: loading || successMessage ? 0.8 : 1,
              }}
            >
              {successMessage ? "Redirecting..." : loading ? "Creating Account..." : "Create Account"}
            </motion.button>

            <p
              className="text-center text-sm mt-4"
            >
              Already have an account?{" "}
              <span
                onClick={onLogin}
                style={{
                  color: "#8B5CF6",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Login
              </span>
            </p>

          </div>
        </div>
      </div>
    </PageShell>
  );
}
