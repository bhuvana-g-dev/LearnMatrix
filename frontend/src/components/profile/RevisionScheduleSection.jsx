import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Check, Flame, Clock3, Info, Zap, Sparkles } from "lucide-react";
import SectionCard from "./SectionCard";
import { COLORS, GRADIENTS } from "../../constants/theme";

const PRIORITY_COLOR = {
  High: "#E4568A",
  Medium: "#F0AB5C",
  Low: "#22C08E",
};

// Small circular "today's progress" ring — animates in on mount/update.
function ProgressRing({ percent, size = 44, stroke = 5 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.55)" strokeWidth={stroke} fill="none" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#C084FC"
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </svg>
  );
}

function RevisionItem({ item, onToggle, onSnooze, showSnooze }) {
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
        background: item.completed ? "rgba(192,132,252,0.12)" : "rgba(255,255,255,0.3)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: COLORS.textDark, textDecoration: item.completed ? "line-through" : "none" }}
            >
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

          {showSnooze && (
            <button
              onClick={() => onSnooze(item.id)}
              title="Postpone to tomorrow"
              aria-label="Postpone to tomorrow"
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.5)", cursor: "pointer" }}
            >
              <Clock3 size={12} color={COLORS.textMid} />
            </button>
          )}

          <button
            onClick={() => onToggle(item)}
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

function Group({ label, items, onToggle, onSnooze, showSnooze, emptyText, extraAction }) {
  if (!items.length && !emptyText) return null;

  return (
    <div className="mb-5 last:mb-0">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.textLight }}>
          {label}
        </p>
        {extraAction}
      </div>

      {items.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <RevisionItem
                key={item.id}
                item={item}
                onToggle={onToggle}
                onSnooze={onSnooze}
                showSnooze={showSnooze}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <p className="text-xs" style={{ color: COLORS.textMid }}>
          {emptyText}
        </p>
      )}
    </div>
  );
}

/**
 * SECTION 5 — AI Revision Schedule.
 * Data comes from `revisions` (revisionSchedule.js via revisionService.js).
 * `streak` comes from Learning Statistics — reused here, not refetched.
 * Marking a revision complete flips local state immediately (useProfile's
 * toggleRevisionCompleted) and fires a background sync call; snoozing and
 * bulk-complete follow the same optimistic-update pattern.
 */
export default function RevisionScheduleSection({
  revisions,
  onToggle,
  onSnooze,
  onMarkAllToday,
  streak,
}) {
  const [xpToast, setXpToast] = useState(false);
  const xpTimerRef = useRef(null);

  const today = revisions.filter((r) => r.bucket === "today" && !r.completed);
  const upcoming = revisions.filter((r) => r.bucket === "upcoming" && !r.completed);
  const completed = revisions.filter((r) => r.completed);

  const todayTotal = revisions.filter((r) => r.bucket === "today").length;
  const todayDone = revisions.filter((r) => r.bucket === "today" && r.completed).length;
  const todayPercent = todayTotal === 0 ? 0 : Math.round((todayDone / todayTotal) * 100);

  const handleToggle = (item) => {
    const wasIncomplete = !item.completed;
    onToggle(item.id);
    if (wasIncomplete) {
      setXpToast(true);
      clearTimeout(xpTimerRef.current);
      xpTimerRef.current = setTimeout(() => setXpToast(false), 1800);
    }
  };

  return (
    <SectionCard icon={Calendar} title="AI Revision Schedule" delay={0.2}>
      {/* Streak + today's progress */}
      <div
        className="flex flex-wrap items-center gap-5 mb-6 p-4"
        style={{ borderRadius: 18, background: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.6)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, rgba(240,171,92,0.35), rgba(228,86,138,0.22))" }}
          >
            <Flame size={16} color="#F0AB5C" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: COLORS.textDark }}>
              {streak ?? 0}-day streak
            </p>
            <p className="text-[11px]" style={{ color: COLORS.textMid }}>Keep it going!</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:ml-auto">
          <ProgressRing percent={todayPercent} />
          <div>
            <p className="text-sm font-bold" style={{ color: COLORS.textDark }}>
              {todayDone}/{todayTotal} today
            </p>
            <p className="text-[11px]" style={{ color: COLORS.textMid }}>
              {todayTotal === 0 ? "Nothing due today" : todayDone === todayTotal ? "All done! 🎉" : "Keep going"}
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {xpToast && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2 mb-4 text-xs font-bold w-fit"
              style={{ borderRadius: 9999, background: GRADIENTS.purplePink, color: "#fff" }}
            >
              <Zap size={13} /> +10 XP — nice work!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Group
        label="Today's Revision"
        items={today}
        onToggle={handleToggle}
        onSnooze={onSnooze}
        showSnooze
        emptyText="Nothing due today — enjoy the break!"
        extraAction={
          today.length > 0 && onMarkAllToday ? (
            <button
              onClick={onMarkAllToday}
              className="text-[11px] font-semibold"
              style={{ color: "#8B5CF6", background: "transparent", border: "none", cursor: "pointer" }}
            >
              Mark all done
            </button>
          ) : null
        }
      />

      <Group label="Upcoming Revision Sessions" items={upcoming} onToggle={handleToggle} />

      <Group
        label="Completed Revision Sessions"
        items={completed}
        onToggle={handleToggle}
        emptyText="No completed sessions yet — mark one done to see it here."
        extraAction={
          completed.length > 0 ? (
            <span className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "#22C08E" }}>
              <Sparkles size={11} /> {completed.length} completed
            </span>
          ) : null
        }
      />
    </SectionCard>
  );
}
