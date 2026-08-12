import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, ShieldCheck } from "lucide-react";
import PageShell from "../../components/layout/PageShell";
import Logo from "../../components/common/Logo";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";

export default function AdminLoginScreen({ auth, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [focused, setFocused] = useState("");

  const inputStyle = (name) => ({
    width: "100%",
    borderRadius: 16,
    background: "rgba(255,255,255,0.55)",
    border: `1.5px solid ${focused === name ? COLORS.purple : "rgba(255,255,255,0.7)"}`,
    boxShadow: focused === name ? "0 0 0 4px rgba(192,132,252,0.25)" : "none",
    padding: "13px 16px 13px 44px",
    fontSize: 14,
    color: COLORS.textDark,
    outline: "none",
    transition: "all .25s ease",
  });

  const handleLogin = async () => {
    try {
      await auth.login({ email, password });
      onSuccess();
    } catch {
      // auth.error is already set by useAdminAuth and rendered below
    }
  };

  return (
    <PageShell>
      <div className="flex items-center justify-center px-4 py-10" style={{ minHeight: "100vh" }}>
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md p-8 sm:p-10"
          style={{ ...GLASS_CARD, borderRadius: 30 }}
        >
          <Logo />
          <div className="flex items-center justify-center gap-1.5 mt-4">
            <ShieldCheck size={14} color={COLORS.purple} />
            <span className="text-xs font-bold" style={{ color: COLORS.purple }}>ADMIN ACCESS</span>
          </div>
          <h1 className="text-center text-2xl sm:text-3xl font-bold mt-3" style={{ color: COLORS.textDark }}>
            Admin Login
          </h1>
          <p className="text-center text-sm mt-2 mb-8" style={{ color: COLORS.textMid }}>
            Sign in to manage LearnMatrix
          </p>

          <div className="space-y-4">
            <div style={{ position: "relative" }}>
              <Mail size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: COLORS.textLight }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Admin Email"
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused("")}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                style={inputStyle("email")}
              />
            </div>

            <div style={{ position: "relative" }}>
              <Lock size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: COLORS.textLight }} />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                onFocus={() => setFocused("pw")}
                onBlur={() => setFocused("")}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                style={{ ...inputStyle("pw"), paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                style={{ position: "absolute", right: 15, top: "50%", transform: "translateY(-50%)", color: COLORS.textLight, background: "none", border: "none", cursor: "pointer" }}
              >
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <motion.button
              type="button"
              onClick={handleLogin}
              disabled={auth.loading}
              whileHover={{ y: -2, boxShadow: "0 12px 30px rgba(192,132,252,0.6)" }}
              whileTap={{ scale: 0.98 }}
              className="w-full font-semibold"
              style={{
                padding: "14px 0",
                borderRadius: 9999,
                background: GRADIENTS.purplePink,
                color: "#ffffff",
                border: "none",
                boxShadow: "0 8px 20px rgba(192,132,252,0.45)",
                cursor: "pointer",
                fontSize: 15,
                opacity: auth.loading ? 0.75 : 1,
              }}
            >
              {auth.loading ? "Logging in..." : "Login"}
            </motion.button>

            {auth.error && (
              <p className="text-center text-xs" style={{ color: "#E4568A" }}>{auth.error}</p>
            )}
          </div>
        </motion.div>
      </div>
    </PageShell>
  );
}
