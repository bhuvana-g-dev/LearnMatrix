import BackButton from "../components/common/BackButton";
import LearningPathPane from "../components/learning/LearningPathPane";

/**
 * LearningPathScreen — thin page wrapper around LearningPathPane, for
 * the initial-assessment-driven multi-session view of one (skill,
 * topic). Mirrors screens/LearningSessionScreen.jsx's structure
 * exactly; the difference is entirely inside the pane (one band per
 * TopicContentPane render vs. every included band walked as a
 * session here) — no focusBand/skillLevel props needed here since
 * LearningPathPane derives the whole band sequence itself from the
 * signed-in learner's roadmap.
 */
export default function LearningPathScreen({ skill, topic, onBack }) {
  return (
    <div className="px-4 sm:px-8 pt-10 pb-20">
      <BackButton onClick={onBack} label="Back to Roadmap" />
      <LearningPathPane skill={skill} topic={topic} />
    </div>
  );
}
