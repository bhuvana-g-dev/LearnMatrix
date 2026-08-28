import { auth } from "../firebase";
import { getCachedRoadmap } from "./userProgressCache";
import { getCertificate } from "./certificateService";

/**
 * getCompletedCourses — every status="mastered" roadmap skill, shown as
 * a completed module. Real data end to end:
 *   - the mastered list itself     <- GET /api/roadmap/<uid>
 *   - certificateAvailable / date  <- the student's ONE real certificate
 *                                     (see services/certificateService.js —
 *                                     one certificate per career path, not
 *                                     per skill), only true/shown once that
 *                                     certificate's status is "completed"
 *
 * A brand-new user, or one with no mastered skills yet, gets [] —
 * CompletedCoursesSection already renders a clean empty state for that.
 */
export async function getCompletedCourses() {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const [roadmap, certificate] = await Promise.all([
    getCachedRoadmap(uid).catch(() => null),
    getCertificate(uid).catch(() => null),
  ]);
  if (!roadmap) return [];

  const certificateCompleted = certificate?.status === "completed";
  const completionDateLabel = certificateCompleted
    ? new Date(certificate.completedOn).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (roadmap.entries || [])
    .filter((e) => e.status === "mastered")
    .map((e) => ({
      id: e.skill,
      moduleName: e.skill,
      completionDate: completionDateLabel,
      finalScore: e.scorePercent != null ? `${Math.round(e.scorePercent)}%` : "—",
      status: "Completed",
      certificateAvailable: certificateCompleted,
    }));
}
