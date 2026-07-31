"""
data/role_skill_categories.py

Mirrors frontend/src/constants/skills.js's ROLE_SKILLS mapping exactly
(same role IDs, same category names, same skills, same order). This is
the ONE piece of frontend product data the backend needs a copy of —
kept as a plain, obviously-a-mirror dict rather than derived some other
way, so a future skill-selection change is a two-file find-and-replace,
not a hidden divergence.

WHY THIS EXISTS: services/skill_topic_service.py's topic-level syllabus
(data/skill_syllabus_seed.py) only covers the "frontend" role — full
topic trees are real content-authoring work, not done yet for the other
7 roles. But the ROLE-DRIVEN ROADMAP RULE ("every skill in the selected
role belongs on the roadmap, not just the ones assessed") shouldn't be
frontend-only — a Full Stack Developer's roadmap should show all 16 of
their role's skills even though only a couple were assessed, same as a
Frontend Developer's. This file is what makes that possible for every
role today, while skill_syllabus_seed.py's topic-level detail
(Verified/Current/Locked expand view) remains frontend-only until the
other roles get seeded too — two independent layers, not blocking on
each other. See services/roadmap_service.py's resolve_role_skills() and
resolve_role_categories() for how this is actually used.

Categories double as the roadmap's MODULE grouping (Module 1, Module 2,
...) — dict order here IS the module order shown to the learner.
"""

ROLE_SKILL_CATEGORIES: dict[str, dict[str, list[str]]] = {
    "fullstack": {
        "Frontend": ["HTML5", "CSS3", "JavaScript", "TypeScript", "Bootstrap", "Tailwind CSS", "React.js"],
        "Backend": ["Node.js", "Express.js"],
        "Database": ["MySQL", "MongoDB"],
        "Tools": ["Git", "GitHub", "REST API", "Postman", "Firebase (Basics)"],
    },
    "frontend": {
        "Core": ["HTML5", "CSS3", "JavaScript", "TypeScript"],
        "Frameworks": ["Bootstrap", "Tailwind CSS", "React.js", "Next.js"],
        "UI/UX": ["Responsive Design", "Figma Basics", "CSS Animations", "Accessibility (WCAG)"],
        "Tools": ["Git", "GitHub", "Vite"],
    },
    "backend": {
        "Programming": ["JavaScript", "Python", "Java"],
        "Backend": ["Node.js", "Express.js"],
        "Database": ["MySQL", "PostgreSQL", "MongoDB"],
        "APIs": ["REST API", "JWT Authentication", "OAuth"],
        "Tools": ["Git", "GitHub", "Postman", "Docker (Basics)"],
    },
    "aiml": {
        "Programming": ["Python"],
        "Mathematics": ["Statistics", "Linear Algebra", "Probability"],
        "Libraries": ["NumPy", "Pandas", "Matplotlib", "Scikit-learn", "TensorFlow", "PyTorch"],
        "AI": ["Machine Learning", "Deep Learning", "NLP", "Computer Vision"],
        "Tools": ["Jupyter Notebook", "Google Colab", "Git"],
    },
    "data": {
        "Programming": ["Python", "SQL"],
        "Data Analysis": ["Excel", "NumPy", "Pandas"],
        "Visualization": ["Power BI", "Tableau", "Matplotlib", "Seaborn"],
        "Statistics": ["Data Cleaning", "Data Visualization", "Descriptive Statistics"],
    },
    "cloud": {
        "Cloud Platforms": ["AWS", "Microsoft Azure", "Google Cloud Platform"],
        "DevOps": ["Docker", "Kubernetes"],
        "CI/CD": ["GitHub Actions", "Jenkins"],
        "Infrastructure": ["Linux", "Networking", "Terraform"],
        "Monitoring": ["CloudWatch", "Prometheus"],
    },
    "cyber": {
        "Networking": ["Computer Networks", "TCP/IP", "DNS", "HTTP/HTTPS"],
        "Security": ["Ethical Hacking", "Cryptography", "Network Security", "Web Security", "OWASP Top 10"],
        "Tools": ["Wireshark", "Nmap", "Burp Suite", "Metasploit", "Kali Linux"],
    },
    "android": {
        "Programming": ["Kotlin", "Java"],
        "Android": ["Android Studio", "XML Layout", "Jetpack Compose", "Material Design"],
        "Architecture": ["MVVM", "Room Database"],
        "APIs": ["REST API", "Firebase", "SQLite"],
        "Tools": ["Git", "GitHub", "Play Console Basics"],
    },
}


def get_role_categories(role_id: str) -> dict[str, list[str]] | None:
    """Returns the {category: [skills]} mapping for a role, in module
    order, or None if role_id isn't recognized at all."""
    return ROLE_SKILL_CATEGORIES.get(role_id)


def get_role_skill_list(role_id: str) -> list[str] | None:
    """Flattened skill list for a role, in category order (category
    order == module order == the order skills appear on the roadmap
    within "mastered"/"upcoming"/"not_assessed" ties). None if role_id
    isn't recognized."""
    categories = ROLE_SKILL_CATEGORIES.get(role_id)
    if categories is None:
        return None
    flat: list[str] = []
    for skills in categories.values():
        flat.extend(skills)
    return flat
