import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ClipboardCheck, Clock3, Info, ChevronDown, Sun, Lightbulb } from "lucide-react";
import SectionCard from "./SectionCard";
import { SkillIcon, brandColorFor } from "../../utils/skillBadge";
import { COLORS, GRADIENTS } from "../../constants/theme";

const PRIORITY_COLOR = {
  High: "#E4568A",
  Medium: "#F0AB5C",
  Low: "#22C08E",
};

function RevisionItem({ item, onRetake, onSnooze, showSnooze }) {
  const [showReason, setShowReason] = useState(false);
  const accent = brandColorFor(item.skill);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-3.5 pl-3"
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.6)",
        borderLeft: `4px solid ${accent}`,
        background: "rgba(255,255,255,0.3)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <SkillIcon skill={item.skill} size={38} />
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

// Decorative empty state for "Today's Revision" — a calm little scene
// (sun over hills) instead of a bare line of text, so an empty day reads
// as a small reward rather than a blank.
function TodayAllDoneCard({ emptyText }) {
  return (
    <div
      className="relative overflow-hidden flex items-center gap-3 px-4 py-4"
      style={{
        borderRadius: 18,
        background: "linear-gradient(120deg, rgba(255,255,255,0.55), rgba(232,185,61,0.22))",
        border: "1px solid rgba(212,160,23,0.25)",
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "#fff" }}
      >
        <Sun size={18} color={COLORS.purple} />
      </div>
      <p className="text-sm font-medium relative" style={{ color: COLORS.textMid }}>
        {emptyText}
      </p>

      <svg
        width="140"
        height="60"
        viewBox="0 0 140 60"
        className="absolute right-0 bottom-0 pointer-events-none hidden xs:block"
        style={{ opacity: 0.55 }}
      >
        <circle cx="112" cy="18" r="12" fill={COLORS.pink} opacity="0.55" />
        <path d="M0,60 L28,28 L52,48 L78,20 L100,44 L140,14 L140,60 Z" fill={COLORS.purple} opacity="0.28" />
        <path d="M0,60 L40,40 L66,54 L96,32 L140,50 L140,60 Z" fill={COLORS.purple} opacity="0.4" />
      </svg>
    </div>
  );
}

// Collapsible group — each section (Today's / Upcoming) can be hidden
// independently, replacing the old "Completed Revision Sessions" group
// entirely (dropped — the backend has no separate completed-history log,
// see revisionService.js's module docstring).
function Group({ label, items, onRetake, onSnooze, showSnooze, emptyText, defaultOpen = true, variant = "upcoming" }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isToday = variant === "today";

  return (
    <div className="mb-5 last:mb-0">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between mb-2.5"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <span className="flex items-center gap-2">
          {isToday ? (
            <Sun size={13} style={{ color: COLORS.purple }} />
          ) : (
            <span className="w-1 h-3.5 rounded-full flex-shrink-0" style={{ background: COLORS.purple }} />
          )}
          <span
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: isToday ? COLORS.purple : COLORS.textDark }}
          >
            {label} {items.length > 0 && `(${items.length})`}
          </span>
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
            ) : isToday ? (
              <TodayAllDoneCard emptyText={emptyText} />
            ) : (
              <p className="text-xs" style={{ color: COLORS.textMid }}>{emptyText}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Small trending-up sparkline for the AI Tip footer — built from plain
// SVG shapes, no chart library, matching RobotMascot's "shapes only"
// convention used elsewhere (screens/HomeScreen.jsx).
function MiniSparkline() {
  const points = [6, 10, 8, 14, 11, 18, 15, 24, 19, 30];
  const w = 92;
  const h = 34;
  const max = Math.max(...points);
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [Number((i * step).toFixed(1)), Number((h - (p / max) * h).toFixed(1))]);

  return (
    <svg width={w} height={h} className="hidden sm:block flex-shrink-0">
      <polyline
        points={coords.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={COLORS.purple}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 3 : 1.5} fill={COLORS.purple} />
      ))}
    </svg>
  );
}

function AITip() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5"
      style={{
        borderRadius: 16,
        background: "linear-gradient(90deg, rgba(212,160,23,0.10), rgba(232,185,61,0.18))",
        border: "1px solid rgba(212,160,23,0.25)",
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "#fff" }}
      >
        <Lightbulb size={15} color={COLORS.purple} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: COLORS.purple }}>
          AI Tip
        </p>
        <p className="text-xs mt-0.5" style={{ color: COLORS.textMid }}>
          Regular revision boosts memory retention by up to 80%!
        </p>
      </div>
      <MiniSparkline />
    </div>
  );
}

// Small hand-built illustration for the section header — a friendly
// robot pointing at a revision calendar. Built entirely from basic SVG
// shapes (no external image asset), same approach as RobotMascot in
// screens/HomeScreen.jsx.
function RevisionMascot() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96">
      {/* calendar */}
      <rect x="46" y="10" width="66" height="76" rx="10" fill="#fff" stroke={COLORS.border} strokeWidth="1.5" />
      <rect x="46" y="10" width="66" height="20" rx="10" fill={COLORS.purple} />
      <rect x="46" y="22" width="66" height="8" fill={COLORS.purple} />
      <circle cx="62" cy="8" r="4" fill={COLORS.sky} />
      <circle cx="96" cy="8" r="4" fill={COLORS.sky} />
      {Array.from({ length: 9 }).map((_, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <rect
            key={i}
            x={56 + col * 18}
            y={40 + row * 15}
            width="12"
            height="9"
            rx="2"
            fill={i === 4 ? COLORS.pink : "rgba(212,160,23,0.18)"}
          />
        );
      })}

      {/* robot */}
      <circle cx="20" cy="34" r="4" fill={COLORS.sky} />
      <rect x="6" y="34" width="28" height="24" rx="10" fill={COLORS.sky} />
      <circle cx="15" cy="45" r="3" fill="#fff" />
      <circle cx="25" cy="45" r="3" fill={COLORS.purple} />
      <rect x="2" y="58" width="36" height="30" rx="12" fill={COLORS.purple} />
      <rect x="14" y="66" width="12" height="12" rx="4" fill="rgba(255,255,255,0.25)" />

      {/* little plant */}
      <path d="M108 88 q-4 -10 0 -16 q4 6 0 16" fill="#4C8C3B" />
      <path d="M108 88 q6 -6 4 -14 q-8 2 -4 14" fill="#67AE4E" />
      <rect x="102" y="86" width="12" height="8" rx="2" fill={COLORS.pink} />
    </svg>
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
    <SectionCard
      icon={Calendar}
      title="AI Revision Schedule"
      subtitle="Smartly planned revisions to help you learn better and remember longer."
      illustration={<RevisionMascot />}
      delay={0.2}
    >
      <Group
        label="Today's Revision"
        items={due}
        onRetake={onRetake}
        onSnooze={onSnooze}
        showSnooze
        emptyText="Nothing due today — enjoy the break!"
        variant="today"
      />

      <Group
        label="Upcoming Revision Sessions"
        items={upcoming}
        onRetake={onRetake}
        emptyText="Nothing scheduled in the next 7 days."
        defaultOpen={false}
        variant="upcoming"
      />

      <AITip />
    </SectionCard>
  );
}
