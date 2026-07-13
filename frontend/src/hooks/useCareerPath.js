import { useState, useEffect, useCallback } from "react";
import { getRoles } from "../services/roleService";
import { getSkillsByRole, submitSelectedSkills } from "../services/skillService";

/**
 * useCareerPath — owns the Role Selection + Skill Selection state and all
 * service calls behind them. RoleSelectionScreen and SkillSelectionScreen
 * become pure presentational components that just receive props from this
 * hook, so future Flask wiring never touches the screens.
 */
export function useCareerPath() {
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);

  const [skillCategories, setSkillCategories] = useState({});
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState([]);

  // Fetch role catalog once on mount.
  useEffect(() => {
    let active = true;
    setRolesLoading(true);
    getRoles().then((data) => {
      if (active) {
        setRoles(data);
        setRolesLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Fetch role-specific skills whenever the selected role changes.
  useEffect(() => {
    if (!selectedRole) {
      setSkillCategories({});
      return;
    }
    let active = true;
    setSkillsLoading(true);
    getSkillsByRole(selectedRole).then((data) => {
      if (active) {
        setSkillCategories(data);
        setSkillsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedRole]);

  const selectRole = useCallback((roleId) => {
    setSelectedRole((prev) => {
      if (prev !== roleId) setSelectedSkills([]); // clear stale skills from a different stack
      return roleId;
    });
  }, []);

  const toggleSkill = useCallback((skill) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }, []);

  const finishSkillSelection = useCallback(() => {
    return submitSelectedSkills({ role: selectedRole, skills: selectedSkills });
  }, [selectedRole, selectedSkills]);

  return {
    roles,
    rolesLoading,
    selectedRole,
    selectRole,
    skillCategories,
    skillsLoading,
    selectedSkills,
    toggleSkill,
    finishSkillSelection,
  };
}
