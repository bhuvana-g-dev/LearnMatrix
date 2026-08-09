/**
 * Dummy AI revision planner data. Same shape a future
 * GET /api/revision/schedule response would have.
 * `bucket` groups items into Today / Upcoming / Completed sections;
 * `completed` is what the "Mark as Completed" button toggles.
 */
export const REVISION_SCHEDULE = [
  {
    id: "r1",
    topic: "Firewall Rules & ACLs",
    module: "Network Security Fundamentals",
    date: "Today",
    time: "20 mins",
    priority: "High",
    completed: false,
    bucket: "today",
    reason: "You studied this 3 days ago — reviewing now fights the forgetting curve while it's still fresh.",
  },
  {
    id: "r2",
    topic: "Symmetric vs Asymmetric Encryption",
    module: "Applied Cryptography",
    date: "Tomorrow",
    time: "15 mins",
    priority: "Medium",
    completed: false,
    bucket: "upcoming",
    reason: "Your last quiz on this topic scored below your average — an extra pass now should lock it in.",
  },
  {
    id: "r3",
    topic: "OWASP Top 10",
    module: "Web App Security",
    date: "17 Jul 2026",
    time: "25 mins",
    priority: "Low",
    completed: false,
    bucket: "upcoming",
    reason: "First review after initial learning — spaced 5 days out, the ideal gap for long-term retention.",
  },
  {
    id: "r4",
    topic: "Linux File Permissions",
    module: "Linux for Security Professionals",
    date: "07 Jul 2026",
    time: "10 mins",
    priority: "Medium",
    completed: true,
    bucket: "completed",
    reason: "Reviewed on schedule — nice work staying consistent.",
  },
];

