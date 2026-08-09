import { motion } from "framer-motion";

export default function MotivationCard({ message }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 flex items-center justify-center text-center"
      style={{ borderRadius: 18, background: "linear-gradient(90deg, #D4A017, #E8B93D)" }}
    >
      <p className="text-sm font-bold text-white">{message}</p>
    </motion.div>
  );
}
