import { motion } from "framer-motion";
import { COLORS } from "../../constants/theme";

export default function FloatingOrbs() {
  const orbs = [
    { size: 260, top: "-6%", left: "-8%", color: COLORS.purple, delay: 0 },
    { size: 220, top: "60%", left: "-10%", color: COLORS.sky, delay: 1.2 },
    { size: 300, top: "-10%", left: "70%", color: COLORS.pink, delay: 0.6 },
    { size: 200, top: "70%", left: "85%", color: COLORS.lavender, delay: 1.8 },
    { size: 160, top: "35%", left: "45%", color: COLORS.purple, delay: 0.9 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute",
            width: o.size,
            height: o.size,
            top: o.top,
            left: o.left,
            background: o.color,
            borderRadius: "9999px",
            filter: "blur(60px)",
            opacity: 0.4,
          }}
          animate={{ y: [0, -24, 0], x: [0, 16, 0] }}
          transition={{ duration: 8 + i, delay: o.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
