import { GraduationCap } from "lucide-react";
import { COLORS, GRADIENTS } from "../../constants/theme";

export default function Logo() {
  return (
    <div className="flex items-center justify-center gap-2">
      <div
        className="w-9 h-9 rounded-2xl flex items-center justify-center"
        style={{ background: GRADIENTS.purpleSky, boxShadow: "0 6px 16px rgba(192,132,252,0.5)" }}
      >
        <GraduationCap size={18} color="#fff" />
      </div>
      <span className="text-xl font-bold tracking-tight" style={{ color: COLORS.textDark }}>
        Learn<span style={{ color: COLORS.purple }}>Matrix</span>
      </span>
    </div>
  );
}
