/**
 * Hardcoded role -> skill-category mapping.
 *
 * Isolated here — behind skillService.getSkillsByRole() — so it can later
 * be replaced by a real `GET /api/roles/:roleId/skills` call without
 * touching SkillSelectionScreen at all.
 */
export const ROLE_SKILLS = {
  fullstack: {
    Frontend: ["HTML5", "CSS3", "JavaScript", "TypeScript", "Bootstrap", "Tailwind CSS", "React.js"],
    Backend: ["Node.js", "Express.js"],
    Database: ["MySQL", "MongoDB"],
    Tools: ["Git", "GitHub", "REST API", "Postman", "Firebase (Basics)"],
  },
  frontend: {
    Core: ["HTML5", "CSS3", "JavaScript", "TypeScript"],
    Frameworks: ["Bootstrap", "Tailwind CSS", "React.js", "Next.js"],
    "UI/UX": ["Responsive Design", "Figma Basics", "CSS Animations", "Accessibility (WCAG)"],
    Tools: ["Git", "GitHub", "Vite"],
  },
  backend: {
    Programming: ["JavaScript", "Python", "Java"],
    Backend: ["Node.js", "Express.js"],
    Database: ["MySQL", "PostgreSQL", "MongoDB"],
    APIs: ["REST API", "JWT Authentication", "OAuth"],
    Tools: ["Git", "GitHub", "Postman", "Docker (Basics)"],
  },
  aiml: {
    Programming: ["Python"],
    Mathematics: ["Statistics", "Linear Algebra", "Probability"],
    Libraries: ["NumPy", "Pandas", "Matplotlib", "Scikit-learn", "TensorFlow", "PyTorch"],
    AI: ["Machine Learning", "Deep Learning", "NLP", "Computer Vision"],
    Tools: ["Jupyter Notebook", "Google Colab", "Git"],
  },
  data: {
    Programming: ["Python", "SQL"],
    "Data Analysis": ["Excel", "NumPy", "Pandas"],
    Visualization: ["Power BI", "Tableau", "Matplotlib", "Seaborn"],
    Statistics: ["Data Cleaning", "Data Visualization", "Descriptive Statistics"],
  },
  cloud: {
    "Cloud Platforms": ["AWS", "Microsoft Azure", "Google Cloud Platform"],
    DevOps: ["Docker", "Kubernetes"],
    "CI/CD": ["GitHub Actions", "Jenkins"],
    Infrastructure: ["Linux", "Networking", "Terraform"],
    Monitoring: ["CloudWatch", "Prometheus"],
  },
  cyber: {
    Networking: ["Computer Networks", "TCP/IP", "DNS", "HTTP/HTTPS"],
    Security: ["Ethical Hacking", "Cryptography", "Network Security", "Web Security", "OWASP Top 10"],
    Tools: ["Wireshark", "Nmap", "Burp Suite", "Metasploit", "Kali Linux"],
  },
  android: {
    Programming: ["Kotlin", "Java"],
    Android: ["Android Studio", "XML Layout", "Jetpack Compose", "Material Design"],
    Architecture: ["MVVM", "Room Database"],
    APIs: ["REST API", "Firebase", "SQLite"],
    Tools: ["Git", "GitHub", "Play Console Basics"],
  },
};

export const DEFAULT_SKILL_CATEGORIES = {
  "Programming Languages": ["JavaScript", "Python", "Java", "TypeScript", "C++", "Kotlin"],
  "Web Development": ["HTML", "CSS", "React", "Node.js", "Express", "Next.js"],
  Databases: ["MySQL", "MongoDB", "PostgreSQL", "Firebase"],
  "Cloud & DevOps": ["AWS", "Docker", "Git", "Linux", "CI/CD"],
  "Data & AI": ["Pandas", "TensorFlow", "SQL", "Data Visualization"],
};
