import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  CheckCircle2,
  ArrowLeft,
  Phone,
  Camera,
  GraduationCap,
  Building2,
  CalendarDays,
  ChevronDown,
  Search,
  Briefcase,
  School,
} from "lucide-react";
import PageShell from "../components/layout/PageShell";
import Logo from "../components/common/Logo";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { TN_COLLEGES } from "../constants/tnColleges";
import { saveUserProfileDoc } from "../services/userProfileService";
import { suggestEmailCorrection } from "../utils/emailTypoCheck";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_REGEX = /^[0-9]{10}$/;

// Firebase throws a technical error like "Firebase: The email address is
// already in use by another account. (auth/email-already-in-use)." — this
// maps the codes we actually see on signup to a friendly message instead.
function getSignupErrorMessage(err) {
  switch (err?.code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Try another email, or log in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "That password is too weak. Please choose a stronger one.";
    case "auth/network-request-failed":
      return "Network error — please check your connection and try again.";
    default:
      return err?.message || "Something went wrong. Please try again.";
  }
}

// At least 8 characters, one uppercase, one lowercase, one number, and
// one special character.
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

const USER_TYPES = [
  { key: "college", label: "College Student", icon: GraduationCap },
  { key: "fresher", label: "Fresher", icon: School },
  { key: "professional", label: "Professional", icon: Briefcase },
];

// Firestore documents cap out at 1MB, so we keep the base64 photo small
// by resizing it down before storing it.
function resizeImageToBase64(file, maxSize = 300) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't read that image."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Searchable, scrollable college dropdown — click to open, type to
// filter, click a row to pick it.
function CollegeDropdown({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = TN_COLLEGES.filter((c) =>
    c.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ position: "relative" }} ref={boxRef}>
      <Building2 size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", zIndex: 1 }} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left"
        style={{
          width: "100%",
          borderRadius: 16,
          background: "rgba(255,255,255,0.55)",
          border: "1px solid rgba(255,255,255,0.7)",
          padding: "13px 40px 13px 44px",
          fontSize: 14,
          color: value ? COLORS.textDark : COLORS.textLight,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {value || "Select your college *"}
      </button>
      <ChevronDown
        size={16}
        style={{ position: "absolute", right: 15, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
      />

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "#fff",
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 12px 32px rgba(13,27,61,0.18)",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "relative", padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>
            <Search size={14} style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)" }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search college..."
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                padding: "8px 8px 8px 28px",
                fontSize: 13,
                background: "transparent",
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filtered.length === 0 && (
              <p className="text-xs px-4 py-3" style={{ color: COLORS.textLight }}>
                No matches — try "Other / Not Listed".
              </p>
            )}
            {filtered.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full text-left text-sm px-4 py-2.5"
                style={{
                  background: c === value ? "rgba(212,160,23,0.12)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: COLORS.textDark,
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SignUpScreen({ auth, onLogin, onSuccess, onBack }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [userType, setUserType] = useState("college");
  const [college, setCollege] = useState("");
  const [department, setDepartment] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  // Live "did you mean...?" nudge for typo'd domains (gmial.com etc.) —
  // purely a suggestion, doesn't block submission on its own.
  const emailSuggestion = suggestEmailCorrection(email);

  const inputStyle = {
    width: "100%",
    borderRadius: 16,
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.7)",
    padding: "13px 16px 13px 44px",
    fontSize: 14,
    outline: "none",
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUrl(await resizeImageToBase64(file));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSignup = async () => {
    setError("");
    setSuccessMessage("");

    if (!firstName.trim()) return setError("Please enter your first name.");
    if (!lastName.trim()) return setError("Please enter your last name.");
    if (!email.trim()) return setError("Please enter your email.");
    if (!EMAIL_REGEX.test(email.trim())) {
      return setError("Please enter a valid email address (e.g. name@example.com).");
    }
    if (emailSuggestion) {
      return setError(
        `That email looks mistyped. Did you mean ${emailSuggestion}?`
      );
    }
    if (email.trim() !== confirmEmail.trim()) {
      return setError("Email addresses don't match. Please check and re-enter.");
    }
    if (!STRONG_PASSWORD_REGEX.test(password)) {
      return setError(
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character."
      );
    }
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (!MOBILE_REGEX.test(mobile.trim())) return setError("Please enter a valid 10-digit mobile number.");
    if (userType === "college" && !college.trim()) return setError("Please select your college.");
    if (userType === "college" && !department.trim()) return setError("Please enter your department.");
    if (userType === "college" && !academicYear.trim()) return setError("Please enter your academic year.");
    if (!agreed) return setError("Please agree to the Privacy Policy and Terms of Use.");

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    try {
      setLoading(true);
      const result = await auth.signup(fullName, email.trim(), password);

      // Save everything else (mobile, user type, college/department/year,
      // photo) onto the same Firestore doc profileService.js reads later —
      // this is what lets ProfileScreen skip the separate "Complete Your
      // Profile" step entirely for anyone who signs up through this form.
      try {
        await saveUserProfileDoc(result.user.uid, {
          mobile: mobile.trim(),
          userType,
          college: userType === "college" ? college.trim() : "",
          department: userType === "college" ? department.trim() : "",
          academicYear: userType === "college" ? academicYear.trim() : "",
          avatarUrl: avatarUrl || null,
        });
      } catch {
        // Non-fatal — CompleteProfileScreen will catch it on next login
        // if this write fails for some reason.
      }

      setSuccessMessage(
        `Account created! We've sent a verification link to ${email.trim()} — click it to unlock the app.`
      );
      setTimeout(() => {
        (onSuccess || onLogin)?.();
      }, 1600);
    } catch (err) {
      setError(getSignupErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="flex items-center justify-center px-4 py-10" style={{ minHeight: "100vh" }}>
        <div className="w-full max-w-lg p-8" style={{ ...GLASS_CARD, borderRadius: 28 }}>
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

          <h1 className="text-center text-2xl sm:text-3xl font-bold mt-5" style={{ color: COLORS.textDark }}>
            Create Account
          </h1>
          <p className="text-center text-sm mb-7" style={{ color: COLORS.textMid }}>
            Start your LearnMatrix journey
          </p>

          <div className="flex justify-center mb-6">
            <label style={{ cursor: "pointer" }}>
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  background: avatarUrl ? "transparent" : GRADIENTS.purplePink,
                  boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={22} color="#fff" />
                )}
              </div>
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} disabled={loading} />
            </label>
          </div>

          <div className="space-y-4">
            {/* First / Last name */}
            <div className="grid grid-cols-2 gap-3">
              <div style={{ position: "relative" }}>
                <User size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  style={inputStyle}
                  placeholder="First Name *"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={loading || !!successMessage}
                />
              </div>
              <input
                style={{ ...inputStyle, paddingLeft: 16 }}
                placeholder="Last Name *"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading || !!successMessage}
              />
            </div>

            {/* Email */}
            <div style={{ position: "relative" }}>
              <Mail size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="email"
                style={inputStyle}
                placeholder="Email *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || !!successMessage}
              />
            </div>
            {emailSuggestion && (
              <button
                type="button"
                onClick={() => setEmail(emailSuggestion)}
                className="text-xs font-semibold"
                style={{
                  color: "#8B5CF6",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  marginTop: -8,
                  display: "block",
                }}
              >
                Did you mean {emailSuggestion}? Tap to fix
              </button>
            )}

            {/* Confirm Email — catches a typo in the person's own
                username (e.g. selvameenakshi@gmail.com instead of
                selvameenakshik@gmail.com) that no domain check can catch,
                since re-typing it from scratch rarely repeats the exact
                same slip twice. */}
            <div style={{ position: "relative" }}>
              <Mail size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="email"
                style={inputStyle}
                placeholder="Confirm Email *"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                onPaste={(e) => e.preventDefault()}
                disabled={loading || !!successMessage}
              />
            </div>
            {confirmEmail && email.trim() !== confirmEmail.trim() && (
              <p className="text-xs" style={{ color: "#E4568A", marginTop: -8 }}>
                Emails don't match yet.
              </p>
            )}

            {/* Password / Confirm */}
            <div className="grid grid-cols-2 gap-3">
              <div style={{ position: "relative" }}>
                <Lock size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type={showPw ? "text" : "password"}
                  style={{ ...inputStyle, paddingRight: 36 }}
                  placeholder="Password *"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || !!successMessage}
                />
                <button
                  onClick={() => setShowPw(!showPw)}
                  type="button"
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer" }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <input
                type="password"
                style={{ ...inputStyle, paddingLeft: 16 }}
                placeholder="Confirm Password *"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || !!successMessage}
              />
            </div>

            {/* Mobile */}
            <div style={{ position: "relative" }}>
              <Phone size={17} style={{ position:
