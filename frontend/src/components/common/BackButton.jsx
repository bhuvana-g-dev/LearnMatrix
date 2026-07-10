import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { COLORS } from "../../constants/theme";

export default function BackButton({ onClick, label = "Back" }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: -3 }}
      whileTap={{ scale: 0.96 }}
      className="flex items-center gap-1.5 text-sm font-semibold mb-6"
      style={{
        color: COLORS.textMid,
        background: "rgba(255,255,255,0.4)",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 9999,
        padding: "7px 16px 7px 12px",
        cursor: "pointer",
      }}
    >
      <ArrowLeft size={15} /> {label}
    </motion.button>
  );
}
