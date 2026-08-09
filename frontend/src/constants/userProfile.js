/**
 * Dummy "logged-in user" profile. Shaped exactly like the JSON a future
 * Flask endpoint (e.g. GET /api/profile/me) would return, so swapping in
 * the real API later is a one-line change inside services/profileService.js.
 */
export const USER_PROFILE = {
  id: "u_1021",
  fullName: "Selva Meenakshi K",
  email: "selva.meenakshi@example.com",
  avatarUrl: null, // null -> UI falls back to initials avatar
  college: "Thiagarajar College of Arts and Science",
  department: "B.Sc. Computer Science",
  academicYear: "Final Year (2027)",
  careerPath: "Cyber Security Analyst",
  joinedDate: "2025-08-14",
};
