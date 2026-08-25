import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Eye, Trash2, X, RefreshCw } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import { fetchLessonPlans, deleteLessonPlan } from "../../services/adminLessonPlanService";
import { getRoles } from "../../services/roleService";
import { getSkillsByRole } from "../../services/skillService";

/**
 * LessonPlansScreen — the admin "Lesson Plan Management" section
 * (backend/routes/admin_lesson_routes.py -> backend/services/lesson_repository.py's
 * `lesson_plans` collection).
 *
 * Deliberately separate from Generated Content Management: that screen
 * manages cached NOTES (theory content, one doc per skill/topic/level).
 * This screen manages the cached ordered LESSON LIST (Titles) for a
 * topic — the thing a learner sees before they even open a lesson.
 * Deleting a notes entry never clears this, so the old lesson titles
 * kept showing on the site even after "deleting" generated content —
 * Delete here is what actually forces a fresh lesson list next time a
 * learner (or the admin, via View) reaches that topic.
 */
export default function LessonPlansScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("");
  const [skillsForRole, setSkillsForRole] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [filterSkill, setFilterSkill] = useState("");
  const [filterTopic, setFilterTopic] = useState("");

  const [viewing, setViewing] = useState(null);
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRolesLoading(true);
      try {
        const data = await getRoles();
        if (!cancelled) setRoles(data || []);
      } catch {
        // Non-fatal — role filter just stays empty, skill/topic filters still work.
      } finally {
        if (!cancelled) setRolesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRoleChange = async (roleId) => {
    setFilterRole(roleId);
    setFilterSkill("");
    setSkillsForRole([]);
    if (!roleId) return;
    setSkillsLoading(true);
    try {
      const categories = await getSkillsByRole(roleId);
      setSkillsForRole(Object.values(categories || {}).flat());
    } catch {
      setSkillsForRole([]);
    } finally {
      setSkillsLoading(false);
    }
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchLessonPlans({
        skill: filterSkill || undefined,
        topic: filterTopic || undefined,
      });
      setItems(data || []);
    } catch (err) {
      setError(err.message || "Couldn't load lesson plans.");
    } finally {
      setLoading(false);
    }
  }, [filterSkill, filterTopic]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete the cached lesson list for "${item.Skill} / ${item.Topic}"? The next learner who opens this topic will trigger a fresh lesson plan.`)) return;
    setDeletingId(item.id);
    try {
      await deleteLessonPlan(item.Skill, item.Topic);
      setItems((rows) => rows.filter((r) => r.id !== item.id));
      if (viewing?.id === item.id) setViewing(null);
    } catch (err) {
      setError(err.message || "Couldn't delete this lesson plan.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="px-4 sm:px-8 pt-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: COLORS.textDark }}>Lesson Plan Management</h1>
          <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
            The cached ordered lesson list per skill/topic that learners see — separate from Generated Content (lesson notes). Delete here to force a topic's lesson list to regenerate.
          </p>
        </div>
        <motion.button
          onClick={loadItems}
          whileHover={{ y: -2 }}
          className="flex items-center gap-2 text-sm font-semibold"
          style={{
            padding: "10px 18px", borderRadius: 9999, background: "#fff",
            color: COLORS.purple, border: `1px solid ${COLORS.border}`, cursor: "pointer",
          }}
        >
          <RefreshCw size={14} /> Refresh
        </motion.button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <select
          value={filterRole}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={rolesLoading}
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff", minWidth: 180, color: filterRole ? COLORS.textDark : COLORS.textLight }}
        >
          <option value="">{rolesLoading ? "Loading roles…" : "All roles"}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.title || r.id}</option>
          ))}
        </select>
        <select
          value={filterSkill}
          onChange={(e) => setFilterSkill(e.target.value)}
          disabled={!filterRole || skillsLoading}
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff", minWidth: 180, color: filterSkill ? COLORS.textDark : COLORS.textLight, opacity: filterRole ? 1 : 0.6 }}
        >
          <option value="">{!filterRole ? "Select a role first" : skillsLoading ? "Loading skills…" : "All skills"}</option>
          {skillsForRole.map((skill) => (
            <option key={skill} value={skill}>{skill}</option>
          ))}
        </select>
        <input
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
          placeholder="Filter by topic"
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff" }}
        />
        {(filterRole || filterSkill || filterTopic) && (
          <button
            onClick={() => { setFilterRole(""); setFilterSkill(""); setSkillsForRole([]); setFilterTopic(""); }}
            className="text-xs font-semibold underline"
            style={{ color: COLORS.textMid, background: "none", border: "none", cursor: "pointer" }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div style={{ ...GLASS_CARD, borderRadius: 20, overflow: "hidden" }}>
        {loading ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>Loading lesson plans…</p>
        ) : error ? (
          <p className="text-sm p-6" style={{ color: "#DC2626" }}>{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>
            No lesson plans cached yet — one appears here the first time a learner opens a topic's lesson list.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {["Skill", "Topic", "Lessons", "Updated", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.textLight }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{item.Skill}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{item.Topic}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.textDark }}>{(item.Lessons || []).length}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.textLight }}>
                    {item.UpdatedAt ? new Date(item.UpdatedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setViewing(item)} title="View" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight }}>
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        title="Delete — forces the lesson list to regenerate on next request"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", opacity: deletingId === item.id ? 0.5 : 1 }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewing && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: "rgba(13,27,61,0.45)", zIndex: 50 }}
          onClick={() => setViewing(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg p-6"
            style={{ ...GLASS_CARD, background: "#fff", borderRadius: 20, maxHeight: "80vh", overflowY: "auto" }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-base font-bold" style={{ color: COLORS.textDark }}>{viewing.Skill} / {viewing.Topic}</p>
                <p className="text-xs mt-1" style={{ color: COLORS.textLight }}>
                  {(viewing.Lessons || []).length} lesson(s)
                </p>
              </div>
              <button onClick={() => setViewing(null)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight }}>
                <X size={18} />
              </button>
            </div>
            <ol className="flex flex-col gap-2 list-decimal pl-5">
              {(viewing.Lessons || []).map((lesson, i) => (
                <li key={i} className="text-sm" style={{ color: COLORS.textMid }}>
                  <span className="font-semibold" style={{ color: COLORS.textDark }}>{lesson.Title}</span>
                  {lesson.Summary ? ` — ${lesson.Summary}` : ""}
                </li>
              ))}
            </ol>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => handleDelete(viewing)}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full"
                style={{ background: "#DC2626", color: "#fff", border: "none", cursor: "pointer" }}
              >
                <Trash2 size={14} /> Delete this lesson plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
