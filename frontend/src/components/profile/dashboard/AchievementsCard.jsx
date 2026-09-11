import { Trophy, Medal } from "lucide-react";
import { DASH } from "../../../constants/profileDashboardTheme";
import DashCard, { DashCardTitle } from "./DashCard";

/**
 * One badge per fully-mastered module (useProfileDashboard.js derives
 * this live from roadmap.entries — every skill tagged with that
 * module has status "mastered"). Not a separate achievements
 * collection, so it can't drift out of sync with the actual roadmap,
 * and a brand-new/ungrouped roadmap honestly shows the empty state
 * below instead of an invented badge.
 */
export default function AchievementsCard({ achievements = [] }) {
  const hasAchievements = achievements.length > 0;

  return (
    <DashCard>
      <DashCardTitle icon={Trophy} iconColor={DASH.accentOrange}>
        Achievements
      </DashCardTitle>

      {!hasAchievements ? (
        <div className="flex flex-col items-center text-center gap-2 py-6">
          <Trophy size={28} color={DASH.textLight} />
          <p className="text-xs" style={{ color: DASH.textLight }}>
            No achievements yet — keep learning and they'll show up here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((badge) => (
            <div
              key={badge.id}
              className="flex flex-col items-center text-center gap-1.5 p-3"
              style={{
                borderRadius: 14,
                border: `1px solid ${DASH.accentOrangeSoft}`,
                background: `linear-gradient(135deg, ${DASH.accentOrangeSoft}, transparent)`,
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: DASH.accentOrangeSoft }}
              >
                <Medal size={18} color={DASH.accentOrange} />
              </div>
              <p className="text-xs font-bold" style={{ color: DASH.textPrimary }}>
                {badge.title}
              </p>
              <p className="text-[10px]" style={{ color: DASH.textLight }}>
                {badge.skillCount} skill{badge.skillCount === 1 ? "" : "s"} mastered
              </p>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );
}
