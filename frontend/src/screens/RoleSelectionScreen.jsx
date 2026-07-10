import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { COLORS, GRADIENTS } from "../constants/theme";

/**
 * RoleSelectionScreen is now purely presentational. `roles`, `selectedRole`,
 * `onSelectRole` all come from useCareerPath() (backed by roleService),
 * so this file never needs to change when roleService starts calling Flask.
 */
export default function RoleSelectionScreen({ roles, rolesLoading, selectedRole, onSelectRole, onContinue }) {
  return (
    <div className="px-4 sm:px-8 py-10 pb-20">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: COLORS.textDark }}>
            Choose Your Dream IT Career
          </h1>
          <p className="mt-3 text-sm sm:text-base" style={{ color: COLORS.textMid }}>
            Select the career path you want to master.
          </p>
        </motion.div>

        {rolesLoading ? (
          <p className="text-center text-sm" style={{ color: COLORS.textLight }}>
            Loading roles...
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {roles.map((role, i) => {
              const isSelected = selectedRole === role.id;
              return (
                <motion.div
                  key={role.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  whileHover={{ y: -4 }}
                  onClick={() => onSelectRole(role.id)}
                  className="relative cursor-pointer p-5"
                  style={{
                    borderRadius: 30,
                    border: isSelected ? `2px solid ${COLORS.purple}` : "1px solid rgba(255,255,255,0.6)",
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(192,132,252,0.28), rgba(125,211,252,0.22))"
                      : "rgba(255,255,255,0.28)",
                    boxShadow: isSelected
                      ? "0 0 0 4px rgba(192,132,252,0.3), 0 12px 28px rgba(192,132,252,0.35)"
                      : "0 4px 16px rgba(160,100,255,0.12)",
                    transition: "all .25s ease",
                  }}
                >
                  {isSelected && (
                    <div
                      className="absolute flex items-center justify-center"
                      style={{ top: 16, right: 16, width: 24, height: 24, borderRadius: 9999, background: GRADIENTS.purplePink }}
                    >
                      <Check size={13} color="#fff" />
                    </div>
                  )}

                  <div
                    className="flex items-center justify-center text-2xl mb-4"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 9999,
                      background: isSelected ? GRADIENTS.purplePink : `linear-gradient(135deg, ${COLORS.lavender}, rgba(240,171,252,0.6))`,
                    }}
                  >
                    {role.emoji}
                  </div>

                  <h3 className="font-bold text-sm sm:text-base leading-tight" style={{ color: COLORS.textDark }}>
                    {role.title}
                  </h3>
                  <p className="text-xs mt-1.5 leading-snug" style={{ color: COLORS.textMid }}>
                    {role.desc}
                  </p>

                  <div className="flex items-center gap-2 mt-3 text-xs font-medium" style={{ color: "#8B5CF6" }}>
                    <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.5)" }}>
                      {role.skills} Skills
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRole(role.id);
                    }}
                    className="mt-4 w-full py-2 text-xs font-semibold"
                    style={{
                      borderRadius: 9999,
                      background: isSelected ? GRADIENTS.purplePink : "transparent",
                      color: isSelected ? "#fff" : "#8B5CF6",
                      border: isSelected ? "none" : `1px solid ${COLORS.purple}`,
                      boxShadow: isSelected ? "0 4px 12px rgba(192,132,252,0.4)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    {isSelected ? "Selected" : "Select Role"}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="flex justify-center mt-12">
          <motion.button
            disabled={!selectedRole}
            onClick={onContinue}
            whileHover={selectedRole ? { y: -2, boxShadow: "0 12px 28px rgba(192,132,252,0.55)" } : {}}
            whileTap={selectedRole ? { scale: 0.98 } : {}}
            className="flex items-center gap-2 font-semibold"
            style={{
              padding: "14px 34px",
              borderRadius: 9999,
              color: "#fff",
              border: "none",
              background: selectedRole ? GRADIENTS.purpleSky : "#C9C4D6",
              opacity: selectedRole ? 1 : 0.7,
              cursor: selectedRole ? "pointer" : "not-allowed",
              boxShadow: selectedRole ? "0 8px 20px rgba(192,132,252,0.4)" : "none",
            }}
          >
            Continue <ArrowRight size={16} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
