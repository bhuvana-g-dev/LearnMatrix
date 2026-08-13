import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ClipboardCheck, Clock3, Info, ChevronDown } from "lucide-react";
import SectionCard from "./SectionCard";
import { COLORS, GRADIENTS } from "../../constants/theme";

const PRIORITY_COLOR = {
  High: "#E4568A",
  Medium: "#F0AB5C",
  Low: "#22C08E",
};

function RevisionItem({ item, onRetake, onSnooze, showSnooze }) {
  const [showReason, setShowReason] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-3.5"
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.6)",
        background: "rgba(255,255,255,0.3)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate" style={{ color: COLORS.textDark }}>
              {item.topic}
            </p>
            {item.reason && (
              <button
                onClick={() => setShowReason((prev) => !prev)}
                aria-label="Why am I reviewing this now?"
                className="flex-shrink-0"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
              >
                <Info size={12} color={COLORS.textLight} />
              </button>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: COLORS.textMid }}>
            {item.skill} • {item.date}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-[10px] font-bold px-2 py-1 rounded-full"
            style={{ color: "#fff", background: PRIORITY_COLOR[item.priority] || COLORS.textLight }}
          >
            {item.priority}
          </span>

          {showSnooze && (
            <button
              onClick={() => onSnooze(item)}
              title="Postpone to tomorrow"
              aria-label="Postpone to tomorrow"
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.5)", cursor: "pointer" }}
            >
              <Clock3 size={12} color={COLORS.textMid} />
            </button>
          )}

          <button
            onClick={() => onRetake(item)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full flex-shrink-0"
            style={{ background: GRADIENTS.purplePink, color: "#fff", border: "none", cursor: "pointer" }}
          >
            <ClipboardCheck size={13} /> Retake Test
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showReason && item.reason && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <p
              className="text-[11px] mt-2.5 pt-2.5"
              style={{ color: COLORS.textMid, borderTop: "1px solid rgba(255,255,255,0.6)" }}
            >
              <span className="font-semibold" style={{ color: "#8B5CF6" }}>Why now? </span>
              {item.reason}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Collapsible group — each section (Today's / Upcoming) can be hidden
// independently, replacing the old "Completed Revision Sessions" group
// entirely (dropped — the backend has no separate completed-history log,
// see revisionService.js's module docstring).
function Group({ label, items, onRetake, onSnooze, showSnooze, emptyText, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-5 last:mb-0">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between mb-2.5"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.textLight }}>
          {label} {items.length > 0 && `(${items.length})`}
        </span>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} style={{ display: "flex" }}>
          <ChevronDown size={14} style={{ color: COLORS.textLight }} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            {items.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <RevisionItem
                      key={item.id}
                      item={item}
                      onRetake={onRetake}
                      onSnooze={onSnooze}
                      showSnooze={showSnooze}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <p className="text-xs" style={{ color: COLORS.textMid }}>{emptyText}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * AI Revision Schedule — two sections now, not three: "Today's Revision"
 * (due today or overdue, snoozable) and "Upcoming Revision Sessions"
 * (next 7 days). "Completed" was dropped since the backend tracks only
 * the latest state per topic, not a history log — see
 * services/revisionService.js's module docstring for why.
 *
 * No manual "mark complete" toggle anymore either — a topic only
 * actually clears from "Today's Revision" by retaking its quiz (which
 * is what recalculates NextReviewDate server-side), so every item's
 * action is "Retake Test", opening the same TopicQuizModal used
 * elsewhere in the app.
 */
export default function RevisionScheduleSection({ due, upcoming, onRetake, onSnooze }) {
  return (
    <SectionCard icon={Calendar} title="AI Revision Schedule" delay={0.2}>
      <Group
        label="Today's Revision"
        items={due}
        onRetake={onRetake}
        onSnooze={onSnooze}
        showSnooze
        emptyText="Nothing due today — enjoy the break!"
      />

      <Group
        label="Upcoming Revision Sessions"
        items={upcoming}
        onRetake={onRetake}
        emptyText="Nothing scheduled in the next 7 days."
        defaultOpen={false}
      />
    </SectionCard>
  );
}
