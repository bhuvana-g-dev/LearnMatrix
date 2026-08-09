import { motion } from "framer-motion";

function Bar({ width = "100%", height = 10 }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      style={{ width, height, borderRadius: 6, background: "rgba(255,255,255,0.5)" }}
    />
  );
}

export default function CertificateSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="p-5 flex flex-col gap-3"
          style={{ borderRadius: 22, border: "1px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.28)" }}
        >
          <Bar height={90} />
          <Bar width="70%" height={14} />
          <Bar width="45%" height={10} />
          <div className="flex gap-2 mt-1">
            <Bar width={60} height={20} />
            <Bar width={60} height={20} />
          </div>
        </div>
      ))}
    </div>
  );
}
