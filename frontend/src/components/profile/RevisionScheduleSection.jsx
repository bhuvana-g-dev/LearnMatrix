import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Check } from "lucide-react";
import SectionCard from "./SectionCard";
import { COLORS, GRADIENTS } from "../../constants/theme";

const PRIORITY_COLOR = {
  High: "#E4568A",
  Medium: "#F0AB5C",
  Low: "#22C08E",
};

function RevisionItem({ item, onToggle }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-between gap-3 p-3.5"
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.6)",
        background: item.completed ? "rgba(192,132,252,0.12)" : "rgba(255,255,255,0.3)",
      }}
    >
      <div className="min-w-0">
        <p
          className="text-sm font-semibold truncate"
          style={{ color: COLORS.textDark, textDecoration: item.completed ? "line-through" : "none" }}
        >
          {item.topic}
        </p>
        <p className="text-xs mt-0.5" style={{ color: COLORS.textMid }}>
          {item.module} • {item.date} • {item.time}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-full"
          style={{ color: "#fff", background: PRIORITY_COLOR[item.priority] || COLORS.textLight }}
        >
          {item.priority}
        </span>
        <button
          onClick={() => onToggle(item.id)}
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            border: item.completed ? "none" : `1px solid ${COLORS.purple}`,
            background: item.completed ? GRADIENTS.purplePink : "transparent",
            cursor: "pointer",
          }}
          aria-label="Mark as completed"
        >
          <Check size={13} color={item.completed ? "#fff" : COLORS.purple} />
        </button>
      </div>
    </motion.div>
  );
}

function Group({ label, items, onToggle }) {
  if (!items.length) return null;
  return (
    <div className="mb-5 last:mb-0">
      <p className="text-xs font-bold uppercase tracking-wide mb-2.5" style={{ color: COLORS.textLight }}>
        {label}
      </p>
      <div className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <RevisionItem key={item.id} item={item} onToggle={onToggle} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * SECTION 5 — AI Revision Schedule.
 * Data comes from `revisions` (revisionSchedule.js via revisionService.js).
 * Marking a revision complete flips local React state immediately
 * (via `onToggle` = useProfile().toggleRevisionCompleted) and fires a
 * background sync call — ready for a real Flask endpoint later.
 */
export default function RevisionScheduleSection({ revisions, onToggle }) {
  const today = revisions.filter((r) => r.bucket === "today" && !r.completed);
  const upcoming = revisions.filter((r) => r.bucket === "upcoming" && !r.completed);
  const completed = revisions.filter((r) => r.completed);

  return (
    <SectionCard icon={Calendar} title="AI Revision Schedule" delay={0.2}>
      <Group label="Today's Revision" items={today} onToggle={onToggle} />
      <Group label="Upcoming Revision Sessions" items={upcoming} onToggle={onToggle} />
      <Group label="Completed Revision Sessions" items={completed} onToggle={onToggle} />
      {revisions.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: COLORS.textMid }}>
          No revision sessions scheduled yet.
        </p>
      )}
    </SectionCard>
  );
}
