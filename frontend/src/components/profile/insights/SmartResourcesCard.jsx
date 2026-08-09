import { motion } from "framer-motion";
import { Video, FileText, Wrench } from "lucide-react";

const TYPE_ICONS = { Video, Article: FileText, "Practice Lab": Wrench };

export default function SmartResourcesCard({ resources, theme }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="p-4"
      style={{ borderRadius: 18, background: theme.cardBg, border: `1px solid ${theme.border}` }}
    >
      <p className="text-xs font-bold mb-3" style={{ color: theme.textMid }}>
        Smart Resource Recommendations
      </p>
      <div className="flex flex-col gap-2.5">
        {resources.map((r, i) => {
          const Icon = TYPE_ICONS[r.type] || FileText;
          return (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="p-3 flex items-start gap-2.5"
              style={{ borderRadius: 14, border: `1px solid ${theme.border}` }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(37,99,235,0.15)" }}
              >
                <Icon size={14} color="#2563EB" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold" style={{ color: theme.textDark }}>
                  {r.title}
                </p>
                <div className="flex flex-wrap gap-x-2 text-[10px] mt-0.5" style={{ color: theme.textLight }}>
                  <span>{r.difficulty}</span>
                  <span>·</span>
                  <span>{r.estimatedTime}</span>
                  <span>·</span>
                  <span>{r.type}</span>
                </div>
                <p className="text-[11px] mt-1 italic" style={{ color: theme.textMid }}>
                  {r.reason}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
