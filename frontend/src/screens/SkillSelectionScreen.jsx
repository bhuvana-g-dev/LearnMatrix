import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ArrowRight } from "lucide-react";
import BackButton from "../components/common/BackButton";
import SkillChip from "../components/skills/SkillChip";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";
import { ROLE_TITLES } from "../constants/roles";

/**
 * SkillSelectionScreen is now purely presentational. `skillCategories`,
 * `selectedSkills`, `onToggleSkill` all come from useCareerPath() (backed
 * by skillService), so this file never needs to change when skillService
 * starts calling Flask / gets personalized via Scikit-Learn.
 */
export default function SkillSelectionScreen({
  skillCategories,
  skillsLoading,
  selectedSkills,
  onToggleSkill,
  onFinish,
  onBack,
  selectedRole,
}) {
  const [query, setQuery] = useState("");
  const roleTitle = ROLE_TITLES[selectedRole];

  const filteredCategories = useMemo(() => {
    if (!query.trim()) return skillCategories;
    const q = query.toLowerCase();
    const result = {};
    Object.entries(skillCategories).forEach(([cat, skills]) => {
      const matches = skills.filter((s) => s.toLowerCase().includes(q));
      if (matches.length) result[cat] = matches;
    });
    return result;
  }, [query, skillCategories]);

  return (
    <div className="px-4 sm:px-8 pt-10 pb-40">
      <div className="mb-6">
        <BackButton onClick={onBack} label="Back to Role Selection" />
      </div>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: COLORS.textDark }}>
            Tell us what you already know
          </h1>
          <p className="mt-3 text-sm sm:text-base" style={{ color: COLORS.textMid }}>
            {roleTitle
              ? `Skills tailored for ${roleTitle} — we'll personalize your learning roadmap.`
              : "We'll personalize your learning roadmap."}
          </p>
        </motion.div>

        <div style={{ position: "relative" }} className="mb-4">
          <Search size={16} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: COLORS.textLight }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills..."
            style={{
              width: "100%",
              borderRadius: 16,
              background: "rgba(255,255,255,0.45)",
              border: `1px solid ${COLORS.border}`,
              padding: "12px 16px 12px 44px",
              fontSize: 14,
              color: COLORS.textDark,
              outline: "none",
            }}
          />
        </div>

        <div className="p-4 mb-8" style={{ ...GLASS_CARD, borderRadius: 24 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: COLORS.textDark }}>
              Selected Skills
            </span>
            <span className="text-xs font-bold" style={{ color: "#8B5CF6" }}>
              {selectedSkills.length}
            </span>
          </div>
          {selectedSkills.length === 0 ? (
            <p className="text-xs" style={{ color: COLORS.textLight }}>
              Nothing selected yet — pick skills below.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {selectedSkills.map((skill) => (
                  <motion.span
                    key={skill}
                    layout
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                    className="flex items-center gap-1.5 text-xs font-medium"
                    style={{ paddingLeft: 12, paddingRight: 6, paddingTop: 6, paddingBottom: 6, borderRadius: 9999, background: GRADIENTS.purplePink, color: "#fff" }}
                  >
                    {skill}
                    <button
                      onClick={() => onToggleSkill(skill)}
                      className="flex items-center justify-center"
                      style={{ width: 16, height: 16, borderRadius: 9999, background: "rgba(255,255,255,0.3)", border: "none", cursor: "pointer" }}
                    >
                      <X size={10} color="#fff" />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {skillsLoading ? (
          <p className="text-center text-sm" style={{ color: COLORS.textLight }}>
            Loading skills...
          </p>
        ) : (
          <div className="space-y-7">
            {Object.keys(filteredCategories).length === 0 && (
              <p className="text-center text-sm" style={{ color: COLORS.textLight }}>
                No skills match "{query}".
              </p>
            )}
            {Object.entries(filteredCategories).map(([cat, skills]) => (
              <div key={cat}>
                <h4 className="text-sm font-bold mb-3" style={{ color: COLORS.textDark }}>
                  {cat}
                </h4>
                <div className="flex flex-wrap gap-2.5">
                  {skills.map((skill) => (
                    <SkillChip
                      key={skill}
                      label={skill}
                      selected={selectedSkills.includes(skill)}
                      onClick={() => onToggleSkill(skill)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, padding: "0 16px 16px" }}>
        <div
          className="max-w-4xl mx-auto flex items-center justify-between gap-4 px-5 sm:px-7 py-4"
          style={{ ...GLASS_CARD, borderRadius: 26, boxShadow: "0 -8px 30px rgba(160,100,255,0.25)" }}
        >
          <div>
            <p className="text-xs" style={{ color: COLORS.textMid }}>
              Selected Skills
            </p>
            <p className="text-lg font-bold" style={{ color: COLORS.textDark }}>
              {selectedSkills.length}
            </p>
          </div>
          <motion.button
            disabled={selectedSkills.length === 0}
            onClick={onFinish}
            whileHover={selectedSkills.length ? { y: -2, boxShadow: "0 12px 28px rgba(192,132,252,0.55)" } : {}}
            whileTap={selectedSkills.length ? { scale: 0.98 } : {}}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 font-semibold"
            style={{
              padding: "14px 28px",
              borderRadius: 9999,
              color: "#fff",
              border: "none",
              background: selectedSkills.length ? GRADIENTS.purpleSky : "#C9C4D6",
              opacity: selectedSkills.length ? 1 : 0.65,
              cursor: selectedSkills.length ? "pointer" : "not-allowed",
              boxShadow: selectedSkills.length ? "0 8px 20px rgba(192,132,252,0.4)" : "none",
            }}
          >
            Continue to Skill Assessment <ArrowRight size={16} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
