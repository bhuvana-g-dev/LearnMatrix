import { auth } from "../firebase";
import { loadSavedRoadmap } from "./aiAssessmentService";
import { getCertificates } from "./certificateService";

/**
 * getCompletedCourses — every status="mastered" roadmap skill, shown as
 * a completed module. Real data end to end:
 *   - the mastered list itself     <- GET /api/roadmap/<uid>
 *   - completionDate / finalScore  <- roadmap entry (score) + the real
 *                                     issued certificate's CompletionDate
 *                                     when one exists (see certificateService.js)
 *   - certificateAvailable         <- whether a certificate was actually
 *                                     auto-issued for that skill, not a
 *                                     guess (services/certificate_service.py
 *                                     issues one for every mastered skill,
 *                                     so this is normally true, but stays
 *                                     driven by the real list either way)
 *
 * A brand-new user, or one with no mastered skills yet, gets [] —
 * CompletedCoursesSection already renders a clean empty state for that.
 */
export async function getCompletedCourses() {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const [roadmap, certificates] = await Promise.all([
    loadSavedRoadmap(uid).catch(() => null),
    getCertificates().catch(() => []),
  ]);
  if (!roadmap) return [];

  const certBySkill = new Map(certificates.map((c) => [c.careerPath, c]));

  return (roadmap.entries || [])
    .filter((e) => e.status === "mastered")
    .map((e) => {
      const cert = certBySkill.get(e.skill);
      return {
        id: e.skill,
        moduleName: e.skill,
        completionDate: cert
          ? new Date(cert.completionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "—",
        finalScore: e.scorePercent != null ? `${Math.round(e.scorePercent)}%` : "—",
        status: "Completed",
        certificateAvailable: !!cert,
      };
    });
}
