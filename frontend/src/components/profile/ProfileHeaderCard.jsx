import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/**
 * SECTION 1 — Personal Information.
 * All fields come from the `profile` object (Firebase Auth + Firestore,
 * via profileService.js) — nothing here is hardcoded.
 */
export default function ProfileHeaderCard({ profile, onEditProfile }) {
  if (!profile) return null;

  const joined = new Date(profile.joinedDate).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const infoRows = [
    { label: "Email", value: profile.email },
    { label: "Mobile", value: profile.mobile },
    { label: "College", value: profile.college },
    { label: "Department", value: profile.department },
    { label: "Academic Year", value: profile.academicYear },
    { label: "Career Path", value: profile.careerPath },
    { label: "Joined", value: joined },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-6 sm:p-8 mb-6"
      style={{ ...GLASS_CARD, borderRadius: 30 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
          style={{
            background: profile.avatarUrl ? "transparent" : GRADIENTS.purplePink,
            color: "#fff",
            overflow: "hidden",
            boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
          }}
        >
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
          ) : (
            initials(profile.fullName)
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate" style={{ color: COLORS.textDark }}>
            {profile.fullName}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: COLORS.textMid }}>
            {profile.careerPath} • {profile.department}
          </p>
        </div>

        <motion.button
          whileHover={{ y: -2, boxShadow: "0 10px 24px rgba(192,132,252,0.45)" }}
          whileTap={{ scale: 0.97 }}
          onClick={onEditProfile}
          className="flex items-center gap-2 text-xs sm:text-sm font-semibold self-start sm:self-center"
          style={{
            padding: "10px 20px",
            borderRadius: 9999,
            color: "#fff",
            border: "none",
            background: GRADIENTS.purpleSky,
            cursor: "pointer",
            boxShadow: "0 6px 16px rgba(192,132,252,0.35)",
          }}
        >
          <Pencil size={14} /> Edit Profile
        </motion.button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-7">
        {infoRows.map((row) => (
          <div key={row.label}>
            <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: COLORS.textLight }}>
              {row.label}
            </p>
            <p className="text-sm font-medium mt-1" style={{ color: COLORS.textDark }}>
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
