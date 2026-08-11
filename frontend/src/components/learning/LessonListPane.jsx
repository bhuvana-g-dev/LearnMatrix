import { motion } from "framer-motion";
import { Loader2, XCircle, RotateCcw, BookOpen, ChevronRight, ListChecks } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";

/**
 * LessonListPane — the new middle layer between a Topic and its
 * content: Topic -> Lessons -> (theory + resources per lesson).
 *
 * Purely presentational — CourseWorkspaceScreen owns the fetch (via
 * services/lessonService.js) and passes state down, because the
 * "content" view that follows a lesson selection also needs the
 * lesson's Title (to build the composite topic key) and the full list
 * (for Next/Previous between lessons) — a single source of truth here
 * avoids a second, possibly-inconsistent fetch when the content view
 * takes over.
 */
export default function LessonListPane({ topic, state, errorMessage, lessons, onSelectLesson, onRetry }) {
  if (state === "loading") {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-16">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}>
          <Loader2 size={32} style={{ color: COLORS.purple }} />
        </motion.div>
        <div>
          <h3 className="text-base font-bold" style={{ color: COLORS.textDark }}>Breaking this topic into lessons…</h3>
          <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
            First time studying {topic} — this is quick and only happens once.
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-16">
        <XCircle size={32} style={{ color: "#E0559C" }} />
        <p className="text-sm max-w-sm" style={{ color: COLORS.textMid }}>{errorMessage}</p>
        <motion.button
          onClick={onRetry}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 text-sm font-semibold"
          style={{
            padding: "10px 20px", borderRadius: 9999, color: "#fff", border: "none",
            background: GRADIENTS.purpleSky, cursor: "pointer",
          }}
        >
          <RotateCcw size={15} /> Try Again
        </motion.button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ListChecks size={16} style={{ color: COLORS.purple }} />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.textLight }}>
          {lessons.length} lesson{lessons.length === 1 ? "" : "s"} in {topic}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {lessons.map((lesson, i) => (
          <motion.div
            key={lesson.Order}
            onClick={() => onSelectLesson(i)}
            whileHover={{ x: 3 }}
            className="flex items-center gap-3.5 p-4 cursor-pointer"
            style={{ ...GLASS_CARD, borderRadius: 16 }}
          >
            <div
              className="flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ width: 34, height: 34, borderRadius: "50%", background: GRADIENTS.purplePink, color: "#fff" }}
            >
              {lesson.Order}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: COLORS.textDark }}>{lesson.Title}</p>
              <p className="text-xs mt-0.5 line-clamp-1" style={{ color: COLORS.textMid }}>{lesson.Summary}</p>
            </div>
            <BookOpen size={14} style={{ color: COLORS.textLight, flexShrink: 0 }} />
            <ChevronRight size={16} style={{ color: COLORS.textLight, flexShrink: 0 }} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
