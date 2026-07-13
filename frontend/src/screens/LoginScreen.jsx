import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Github, Check } from "lucide-react";
import PageShell from "../components/layout/PageShell";
import Logo from "../components/common/Logo";
import GoogleIcon from "../components/common/GoogleIcon";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";

export default function LoginScreen({ auth, onSuccess, onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [focused, setFocused] = useState("");

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

  return (
    <PageShell>
      <div
        className="flex items-center justify-center px-4 py-10"
        style={{ minHeight: "100vh" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md p-8 sm:p-10"
          style={{ ...GLASS_CARD, borderRadius: 30 }}
        >
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
                onChange={(e) => setEmail(e.target.value)}
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

              <a
                href="#"
                style={{
                  color: "#8B5CF6",
                  fontWeight: 600,
                }}
              >
                Forgot Password?
              </a>
            </div>

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
                await auth.loginGoogle();
                onSuccess();
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
                await auth.loginGithub();
                onSuccess();
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
    </PageShell>
  );
}