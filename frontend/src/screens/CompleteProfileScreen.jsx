import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Building2, CalendarDays, Phone, Camera } from "lucide-react";
import PageShell from "../components/layout/PageShell";
import Logo from "../components/common/Logo";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { saveUserProfileDoc } from "../services/userProfileService";

const MOBILE_REGEX = /^[0-9]{10}$/;

// Firestore documents cap out at 1MB, so we keep the base64 photo small
// by resizing it down before storing it — otherwise a full-res phone
// photo could blow past that limit on its own.
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

export default function CompleteProfileScreen({ user, onComplete }) {
  const [college, setCollege] = useState("");
  const [department, setDepartment] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [mobile, setMobile] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      const dataUrl = await resizeImageToBase64(file);
      setAvatarUrl(dataUrl);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!college.trim()) return setError("Please enter your college.");
    if (!department.trim()) return setError("Please enter your department.");
    if (!academicYear.trim()) return setError("Please enter your academic year.");
    if (!MOBILE_REGEX.test(mobile.trim())) {
      return setError("Please enter a valid 10-digit mobile number.");
    }

    try {
      setLoading(true);
      await saveUserProfileDoc(user.uid, {
        college: college.trim(),
        department: department.trim(),
        academicYear: academicYear.trim(),
        mobile: mobile.trim(),
        avatarUrl: avatarUrl || null,
      });
      onComplete?.();
    } catch (err) {
      setError(err.message || "Couldn't save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="flex items-center justify-center px-4 py-10" style={{ minHeight: "100vh" }}>
        <div className="w-full max-w-md p-8" style={{ ...GLASS_CARD, borderRadius: 28 }}>
          <Logo />

          <h1 className="text-center text-2xl sm:text-3xl font-bold mt-5" style={{ color: COLORS.textDark }}>
            Complete Your Profile
          </h1>
          <p className="text-center text-sm mb-8" style={{ color: COLORS.textMid }}>
            Just a few more details before you get started
          </p>

          <div className="flex justify-center mb-6">
            <label style={{ cursor: "pointer", position: "relative" }}>
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden"
                style={{
                  background: avatarUrl ? "transparent" : GRADIENTS.purplePink,
                  boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={26} color="#fff" />
                )}
              </div>
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
            </label>
          </div>

          <div className="space-y-4">
            <div style={{ position: "relative" }}>
              <Building2 size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={inputStyle}
                placeholder="College Name"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                disabled={loading}
              />
            </div>

            <div style={{ position: "relative" }}>
              <GraduationCap size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={inputStyle}
                placeholder="Department (e.g. B.Sc. Computer Science)"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={loading}
              />
            </div>

            <div style={{ position: "relative" }}>
              <CalendarDays size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={inputStyle}
                placeholder="Academic Year (e.g. Final Year (2027))"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                disabled={loading}
              />
            </div>

            <div style={{ position: "relative" }}>
              <Phone size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="tel"
                style={inputStyle}
                placeholder="Mobile Number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-center text-sm" style={{ color: "red" }}>
                {error}
              </p>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={loading}
              className="w-full"
              style={{
                padding: "14px",
                borderRadius: 9999,
                border: "none",
                background: GRADIENTS.purplePink,
                color: "#fff",
                fontWeight: 700,
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? "Saving..." : "Continue"}
            </motion.button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
