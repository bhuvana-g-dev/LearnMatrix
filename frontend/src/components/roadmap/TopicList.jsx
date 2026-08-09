import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Lock } from "lucide-react";
import { COLORS } from "../../constants/theme";

const STATUS_STYLE = {
  Verified: { icon: CheckCircle2, color: "#22C55E" },
  Current: { icon: Circle, color: COLORS.purple },
  Locked: { icon: Lock, color: COLORS.textLight },
};

/**
 * TopicList — the syllabus tree (backend/data/skill_syllabus_seed.py)
 * for ONE skill, compressed by services/syllabus_compression_service.py
 * into Verified/Current/Locked per topic.
 *
 * This is what turns a roadmap entry from "Week 2: React.js — Weak"
 * into the actual nested "here's what's inside React.js, here's what
 * you can skip, here's exactly where to start" view the brief calls for.
 *
 * `topics` shape (per topic): { topicId, title, order, status, note }
 */
export default function TopicList({ topics }) {
  if (!topics || topics.length === 0) return null;

  return (
    <AnimatePresence initial={false}>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{ overflow: "hidden" }}
      >
        <div
          className="mt-3 pt-3 flex flex-col gap-1.5"
          style={{ borderTop: "1px solid rgba(13,27,61,0.08)" }}
        >
          {topics.map((topic) => {
            const style = STATUS_STYLE[topic.status] || STATUS_STYLE.Locked;
            const Icon = style.icon;
            const isCurrent = topic.status === "Current";
            const isLocked = topic.status === "Locked";

            return (
              <div
                key={topic.topicId}
                className="flex items-start gap-2.5 px-2.5 py-2"
                style={{
                  borderRadius: 10,
                  background: isCurrent ? "rgba(212,160,23,0.10)" : "transparent",
                  opacity: isLocked ? 0.55 : 1,
                }}
              >
                <Icon
                  size={16}
                  style={{ color: style.color, flexShrink: 0, marginTop: 1 }}
                  fill={topic.status === "Verified" ? style.color : "none"}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm"
                    style={{
                      color: isLocked ? COLORS.textLight : COLORS.textDark,
                      fontWeight: isCurrent ? 600 : 500,
                      textDecoration: topic.status === "Verified" ? "line-through" : "none",
                      textDecorationColor: "rgba(34,197,94,0.4)",
                    }}
                  >
                    {topic.title}
                  </p>
                  {topic.note && (
                    <p className="text-xs mt-0.5" style={{ color: COLORS.textMid }}>
                      {topic.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
