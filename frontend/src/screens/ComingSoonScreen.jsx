import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import BackButton from "../components/common/BackButton";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";

export default function ComingSoonScreen({ label, onBack }) {
  return (
    <div className="px-4 sm:px-8 pt-10">
      <BackButton onClick={onBack} label="Back to Role Selection" />
      <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: "70vh" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center p-10 max-w-md"
          style={{ ...GLASS_CARD, borderRadius: 30 }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: GRADIENTS.purpleSky }}
          >
            <Sparkles size={22} color="#fff" />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: COLORS.textDark }}>
            {label}
          </h2>
          <p className="text-sm" style={{ color: COLORS.textMid }}>
            This section is coming soon. For now, check out Role Selection and
            Skill Selection in the sidebar.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
