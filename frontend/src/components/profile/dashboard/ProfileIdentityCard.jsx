import { Mail, Building2, GraduationCap, CalendarDays, Star, Pencil } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export default function ProfileIdentityCard({ profile, onEditProfile }) {
  if (!profile) return null;

  return (
    <div
      className="p-5 sm:p-7 mb-6 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8"
      style={{
        background: DASH.card,
        border: `1px solid ${DASH.border}`,
        borderRadius: 20,
        boxShadow: "0 4px 24px rgba(13,27,61,0.08)",
      }}
    >
      <div
        className="w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center text-xl font-bold overflow-hidden"
        style={{ background: DASH.accentPurpleSoft, color: DASH.accentPurple }}
      >
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
        ) : (
          initials(profile.fullName)
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap mb-2">
          <h2 className="text-lg font-bold" style={{ color: DASH.textPrimary }}>
            {profile.fullName}
          </h2>
          <span
            className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: DASH.accentPurple, color: "#fff" }}
          >
            Student
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-xs" style={{ color: DASH.textMid }}>
          {profile.email && (
            <span className="flex items-center gap-2">
              <Mail size={13} /> {profile.email}
            </span>
          )}
          {profile.college && (
            <span className="flex items-center gap-2">
              <Building2 size={13} /> {profile.college}
            </span>
          )}
          {profile.department && (
            <span className="flex items-center gap-2">
              <GraduationCap size={13} /> {profile.department}
            </span>
          )}
          {profile.academicYear && (
            <span className="flex items-center gap-2">
              <CalendarDays size={13} /> {profile.academicYear}
            </span>
          )}
          {profile.careerPath && (
            <span className="flex items-center gap-2" style={{ color: DASH.accentOrange }}>
              <Star size={13} /> Career Path: {profile.careerPath}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onEditProfile}
          className="inline-flex items-center gap-2 text-xs font-semibold"
          style={{
            padding: "9px 16px",
            borderRadius: 10,
            color: "#fff",
            background: DASH.accentPurple,
            border: "none",
            cursor: "pointer",
          }}
        >
          <Pencil size={13} /> Edit Profile
        </button>

        {/* Decorative motivational quote — not user data */}
        <p
          className="text-xs italic max-w-[220px] text-left sm:text-right px-3 py-2"
          style={{ color: DASH.accentPurple, background: DASH.accentPurpleSoft, borderRadius: 10 }}
        >
          "The expert in anything was once a beginner."
        </p>
      </div>
    </div>
  );
}
