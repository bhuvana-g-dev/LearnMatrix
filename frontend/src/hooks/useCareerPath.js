import { useState, useEffect, useCallback } from "react";
import { getRoles } from "../services/roleService";
import { getSkillsByRole, submitSelectedSkills } from "../services/skillService";
import { loadSavedAssessmentResult } from "../services/aiAssessmentService";
import { ROLES } from "../constants/roles";

/**
 * useCareerPath — owns the Role Selection + Skill Selection state and all
 * service calls behind them. RoleSelectionScreen and SkillSelectionScreen
 * become pure presentational components that just receive props from this
 * hook, so future Flask wiring never touches the screens.
 *
 * @param {string|undefined} uid — needed to recover `selectedRole` from a
 * saved assessment when it's missing (see the skills-fetch effect below).
 */
export function useCareerPath(uid) {
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
  //
  // BUG FIX ("exit role"): selectedRole is in-memory-only state, so it
  // resets to null both on a page refresh AND right after Quit Role
  // (App.jsx's onRoleQuit calls selectRole(null)). The sidebar's "Skill
  // Selection" sub-item navigates straight to SkillSelectionScreen
  // without going through Role Selection first, so a learner could land
  // there with selectedRole === null while they actually DO have a
  // saved diagnostic assessment for a role (e.g. they completed the
  // assessment but haven't generated their roadmap yet). Previously we
  // just returned {} here forever, showing a permanently empty skill
  // list. Now, when selectedRole is missing, fall back to the saved
  // assessment's role — same source of truth CareerStatusScreen already
  // uses — before giving up.
  useEffect(() => {
    if (selectedRole) {
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
    }

    if (!uid) {
      setSkillCategories({});
      return;
    }

    let active = true;
    setSkillsLoading(true);
    loadSavedAssessmentResult(uid)
      .then((assessment) => {
        if (!active) return;
        const roleEntry = assessment ? ROLES.find((r) => r.title === assessment.role) : null;
        if (!roleEntry) {
          // Genuinely no role to recover (brand-new user, or role was
          // actually quit and no new one picked yet) — empty is correct.
          setSkillCategories({});
          setSkillsLoading(false);
          return;
        }
        // Recover selectedRole itself, not just the skill list, so the
        // rest of the app (roleTitle display, finishSkillSelection,
        // AssessmentScreen, etc.) stays consistent. This re-triggers
        // this same effect via the `selectedRole` branch above, which
        // fetches the actual skill categories.
        setSelectedRole(roleEntry.id);
      })
      .catch(() => {
        if (active) {
          setSkillCategories({});
          setSkillsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedRole, uid]);

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
