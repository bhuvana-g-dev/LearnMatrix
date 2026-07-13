import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import BackButton from "../../components/common/BackButton";
import { COLORS, GLASS_CARD } from "../../constants/theme";

const badgeStyle = {
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 10px",
  borderRadius: 9999,
  background: "rgba(192,132,252,0.18)",
  color: COLORS.purple,
};

export default function QuestionPreviewScreen({ question, onBack }) {
  if (!question) return null;

  const options = [
    ["A", question.OptionA],
    ["B", question.OptionB],
    ["C", question.OptionC],
    ["D", question.OptionD],
  ];

  return (
    <div className="px-4 sm:px-8 pt-8 pb-12">
      <BackButton onClick={onBack} label="Back to Question Bank" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span style={badgeStyle}>{question.QuestionID}</span>
        <span style={badgeStyle}>{question.Skill}</span>
        <span style={badgeStyle}>{question.Difficulty}</span>
        <span style={badgeStyle}>{question.QuestionType}</span>
        <span style={{ ...badgeStyle, background: question.Status === "Active" ? "rgba(52,199,89,0.15)" : "rgba(228,86,138,0.15)", color: question.Status === "Active" ? "#1F9254" : "#E4568A" }}>
          {question.Status}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 sm:p-8 max-w-2xl"
        style={{ ...GLASS_CARD, borderRadius: 24 }}
      >
        <h2 className="text-lg font-semibold mb-6" style={{ color: COLORS.textDark }}>
          {question.Question}
        </h2>

        <div className="flex flex-col gap-3">
          {options.map(([letter, text]) => {
            const isCorrect = question.CorrectAnswer === letter;
            return (
              <div
                key={letter}
                className="flex items-center justify-between px-4 py-3"
                style={{
                  borderRadius: 14,
                  border: `1.5px solid ${isCorrect ? "#34C759" : COLORS.border}`,
                  background: isCorrect ? "rgba(52,199,89,0.1)" : "rgba(255,255,255,0.45)",
                }}
              >
                <span className="text-sm" style={{ color: COLORS.textDark }}>
                  <strong style={{ marginRight: 8 }}>{letter}.</strong>
                  {text}
                </span>
                {isCorrect && <CheckCircle2 size={16} color="#1F9254" />}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
