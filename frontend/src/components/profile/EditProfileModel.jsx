import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, User, Phone, Building2, GraduationCap, CalendarDays } from "lucide-react";
import { updateProfile as updateAuthProfile } from "firebase/auth";
import { auth } from "../../firebase";
import { saveUserProfileDoc } from "../../services/userProfileService";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";

const MOBILE_REGEX = /^[0-9]{10}$/;
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

/**
 * EditProfileModal — lets the user update the fields ProfileHeaderCard
 * shows: name (Firebase Auth displayName), mobile/college/department/
 * academicYear/avatarUrl (Firestore, users/{uid}). Pre-filled from the
 * `profile` object ProfileScreen already has via useProfile().
 */
export default function EditProfileModal({ profile, onClose, onSaved }) {
  const [fullName, setFullName] = useState(profile.fullName || "");
  const [mobile, setMobile] = useState(profile.mobile || "");
  const [college, setCollege] = useState(profile.college || "");
  const [department, setDepartment] = useState(profile.department || "");
  const [academicYear, setAcademicYear] = useState(profile.academicYear || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || null);
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
      setAvatarUrl(await resizeImageToBase64(file));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async () => {
    setError("");

    if (!fullName.trim()) return setError("Please enter your name.");
    if (!MOBILE_REGEX.test(mobile.trim())) return setError("Please enter a valid 10-digit mobile number.");

    try {
      setLoading(true);

      if (auth.currentUser && fullName.trim() !== profile.fullName) {
        await updateAuthProfile(auth.currentUser, { displayName: fullName.trim() });
      }

      await saveUserProfileDoc(auth.currentUser.uid, {
        mobile: mobile.trim(),
        college: college.trim(),
        department: department.trim(),
        academicYear: academicYear.trim(),
        avatarUrl: avatarUrl || null,
      });

      onSaved?.();
    } catch (err) {
      setError(err.message || "Couldn't save your changes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
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
          style={{ ...GLASS_CARD, background: "rgba(255,255,255,0.92)", borderRadius: 28, pointerEvents: "auto", maxHeight: "90vh", overflowY: "auto" }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
              Edit Profile
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: "rgba(0,0,0,0.05)", border: "none", borderRadius: 10, width: 30, height: 30, cursor: "pointer" }}
            >
              <X size={15} style={{ margin: "0 auto" }} />
            </button>
          </div>

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

          <div className="space-y-3.5">
            <div style={{ position: "relative" }}>
              <User size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={inputStyle}
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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
                placeholder="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={loading}
              />
            </div>

            <div style={{ position: "relative" }}>
              <CalendarDays size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={inputStyle}
                placeholder="Academic Year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-center text-sm" style={{ color: "red" }}>
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 text-sm font-semibold"
                style={{
                  padding: "12px",
                  borderRadius: 9999,
                  border: `1.5px solid ${COLORS.border}`,
                  background: "rgba(255,255,255,0.7)",
                  color: COLORS.textDark,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 text-sm font-semibold"
                style={{
                  padding: "12px",
                  borderRadius: 9999,
                  border: "none",
                  background: GRADIENTS.purplePink,
                  color: "#fff",
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.8 : 1,
                }}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
