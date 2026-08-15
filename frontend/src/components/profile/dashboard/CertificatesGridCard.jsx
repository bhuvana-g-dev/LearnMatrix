import { Award } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";
import DashCard, { DashCardTitle } from "./DashCard";

/**
 * certificateService.js is still mock data (see its own "FUTURE (Flask)"
 * comment) — there's no real certificate-issuance backend yet, so this
 * shows an honest empty state for every user rather than the same fixed
 * mock certificates regardless of who's logged in.
 */
export default function CertificatesGridCard() {
  return (
    <DashCard>
      <DashCardTitle icon={Award} iconColor={DASH.accentOrange}>
        Certificates Earned
      </DashCardTitle>
      <div className="flex flex-col items-center text-center gap-2 py-6">
        <Award size={28} color={DASH.textLight} />
        <p className="text-xs" style={{ color: DASH.textLight }}>
          No certificates yet — complete a skill's roadmap to earn your first one.
        </p>
      </div>
    </DashCard>
  );
}
