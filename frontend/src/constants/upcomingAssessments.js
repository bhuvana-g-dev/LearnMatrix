/**
 * Dummy upcoming assessments list. Same shape a future
 * GET /api/assessments/upcoming response would have.
 * Set to [] to preview the empty state in UpcomingAssessmentsSection.
 */
export const UPCOMING_ASSESSMENTS = [
  {
    id: "a1",
    name: "Network Security Quiz",
    module: "Network Security Fundamentals",
    date: "18 Jul 2026",
    time: "10:00 AM",
    difficulty: "Intermediate",
    duration: "30 mins",
    status: "Scheduled",
  },
  {
    id: "a2",
    name: "Cryptography Basics Test",
    module: "Applied Cryptography",
    date: "22 Jul 2026",
    time: "4:00 PM",
    difficulty: "Advanced",
    duration: "45 mins",
    status: "Scheduled",
  },
];
