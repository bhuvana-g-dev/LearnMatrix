"""
services/skill_topic_service.py

Business logic for the Skill Syllabus Tree. Two entry points:

    get_topics_for_skill(db, skill)      -> ordered topic list, one skill
    get_syllabus_for_role(db, role_id)   -> full role -> skill -> topics tree

`get_syllabus_for_role` is what routes/skill_topic_routes.py's
GET /api/roles/<roleId>/syllabus calls — it's the "nested expandable
topics" data the roadmap UI (RoadmapDisplay.jsx) needs to actually
render skill -> topic hierarchy instead of a flat skill list.

Role -> skill list currently comes from
frontend/src/constants/skills.js (ROLE_SKILLS), NOT from Firestore —
there's no role_skill_mapping collection populated yet (per the
brief's DB list). To avoid duplicating that catalog in two places
(Python here + JS there) and having them drift, ROLE_SKILLS is
mirrored below as a plain constant. When role_skill_mapping actually
gets seeded in Firestore, replace ROLE_SKILLS_BY_ROLE's body with a
Firestore read and nothing calling this function needs to change.
"""

from services.skill_topic_repository import list_topics_for_skills

# Mirrors frontend/src/constants/skills.js -> ROLE_SKILLS. Flattened
# (category grouping dropped) since the syllabus tree only cares about
# the skill list itself, not the UI grouping used on SkillSelectionScreen.
ROLE_SKILLS_BY_ROLE: dict[str, list[str]] = {
    "frontend": [
        "HTML5", "CSS3", "JavaScript", "TypeScript",
        "Bootstrap", "Tailwind CSS", "React.js", "Next.js",
        "Responsive Design", "Figma Basics", "CSS Animations", "Accessibility (WCAG)",
        "Git", "GitHub", "Vite",
    ],
}


class SkillTopicError(Exception):
    pass


def get_topics_for_skill(db, skill: str) -> list[dict]:
    from services.skill_topic_repository import list_topics_for_skill
    return list_topics_for_skill(db, skill)


def get_syllabus_for_role(db, role_id: str) -> dict:
    """
    Returns:
        {
            "roleId": "frontend",
            "skills": [
                {"skill": "HTML5", "topicCount": 14, "topics": [...]},
                ...
            ]
        }

    Raises SkillTopicError if role_id has no known skill list yet (i.e.
    this role hasn't been seeded — see data/skill_syllabus_seed.py).
    """
    skills = ROLE_SKILLS_BY_ROLE.get(role_id)
    if skills is None:
        raise SkillTopicError(
            f"No skill list for role '{role_id}'. Seeded roles: "
            f"{list(ROLE_SKILLS_BY_ROLE.keys())}."
        )

    topics_by_skill = list_topics_for_skills(db, skills)

    return {
        "roleId": role_id,
        "skills": [
            {
                "skill": skill,
                "topicCount": len(topics_by_skill.get(skill, [])),
                "topics": topics_by_skill.get(skill, []),
            }
            for skill in skills
        ],
    }
