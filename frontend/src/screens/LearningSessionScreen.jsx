import BackButton from "../components/common/BackButton";
import TopicContentPane from "../components/learning/TopicContentPane";

/**
 * LearningSessionScreen — thin page wrapper around TopicContentPane
 * for a single standalone topic (reached directly from a roadmap
 * click, not through the Course Workspace's navigator). No Previous/
 * Next here — that's CourseWorkspaceScreen.jsx's job, which uses the
 * exact same TopicContentPane so the actual content never differs
 * between the two entry points.
 */
export default function LearningSessionScreen({ skill, topic, focusBand, skillLevel, onBack }) {
  return (
    <div className="px-4 sm:px-8 pt-10 pb-20">
      <BackButton onClick={onBack} label="Back to Roadmap" />
      <TopicContentPane skill={skill} topic={topic} focusBand={focusBand} skillLevel={skillLevel} />
    </div>
  );
}
