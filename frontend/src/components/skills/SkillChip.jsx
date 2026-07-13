import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { COLORS, GRADIENTS } from "../../constants/theme";

export default function SkillChip({ label, selected, onClick }) {
  return (
    <motion.button
      layout
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="flex items-center gap-1.5 text-xs sm:text-sm font-medium"
      style={{
        padding: "9px 16px",
        borderRadius: 9999,
        background: selected ? GRADIENTS.purplePink : "rgba(255,255,255,0.45)",
        color: selected ? "#fff" : COLORS.textDark,
        border: selected ? "none" : `1px solid ${COLORS.border}`,
        boxShadow: selected ? "0 4px 12px rgba(192,132,252,0.4)" : "none",
        cursor: "pointer",
      }}
    >
      {selected && <Check size={12} />}
      {label}
    </motion.button>
  );
}
