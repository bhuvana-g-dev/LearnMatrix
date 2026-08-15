import { Trophy } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";
import DashCard, { DashCardTitle } from "./DashCard";

/**
 * There is no achievements/badges backend yet (no collection tracks
 * "first course completed", streak milestones, etc.), so — instead of
 * showing invented badges — this is an honest empty state until that
 * exists. See useProfileDashboard.js's docstring for what's real today.
 */
export default function AchievementsCard() {
  return (
    <DashCard>
      <DashCardTitle icon={Trophy} iconColor={DASH.accentOrange}>
        Achievements
      </DashCardTitle>
      <div className="flex flex-col items-center text-center gap-2 py-6">
        <Trophy size={28} color={DASH.textLight} />
        <p className="text-xs" style={{ color: DASH.textLight }}>
          No achievements yet — keep learning and they'll show up here.
        </p>
      </div>
    </DashCard>
  );
}
