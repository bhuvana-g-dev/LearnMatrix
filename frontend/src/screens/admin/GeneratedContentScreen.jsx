import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Eye, Trash2, X, RefreshCw } from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import {
  fetchGeneratedContent, fetchGeneratedContentItem, deleteGeneratedContent,
} from "../../services/adminGeneratedContentService";
import { getRoles } from "../../services/roleService";
import { getSkillsByRole } from "../../services/skillService";

/**
 * GeneratedContentScreen — the admin "Generated Content Management"
 * section (backend/routes/generated_content_routes.py ->
 * backend/services/notes_repository.py's `learning_notes` cache).
 *
 * This is deliberately separate from Resource Management: it shows
 * AI-generated notes that get GENERATED ONCE per (skill, topic,
 * focusBand) and REUSED for every learner who reaches that same
 * combination afterward (see services/learning_content_service.py) —
 * not resources an admin created or verified by hand. View lets the
 * admin inspect exactly what's being reused; Delete removes the cached
 * entry so the next learner who needs it triggers a fresh generation,
 * which becomes the new reusable version.
 */
export default function GeneratedContentScreen() {
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

  const [viewing, setViewing] = useState(null); // full item shown in the View modal
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const openViewModal = async (item) => {
    setViewing(item); // show what we already have immediately
    setViewError("");
    setViewLoading(true);
    try {
      const full = await fetchGeneratedContentItem(item.id);
      setViewing(full);
    } catch (err) {
      setViewError(err.message || "Couldn't load the full content for this item.");
    } finally {
      setViewLoading(false);
    }
  };

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
      const data = await fetchGeneratedContent({
        skill: filterSkill || undefined,
        topic: filterTopic || undefined,
      });
      setItems(data || []);
    } catch (err) {
      setError(err.message || "Couldn't load generated content.");
    } finally {
      setLoading(false);
    }
  }, [filterSkill, filterTopic]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete cached content for "${item.skill} / ${item.topic}" (${item.focusBand})? The next learner who needs it will trigger a fresh generation.`)) return;
    setDeletingId(item.id);
    try {
      await deleteGeneratedContent(item.id);
      setItems((rows) => rows.filter((r) => r.id !== item.id));
      if (viewing?.id === item.id) setViewing(null);
    } catch (err) {
      setError(err.message || "Couldn't delete this content item.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="px-4 sm:px-8 pt-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: COLORS.textDark }}>Generated Content Management</h1>
          <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
            AI-generated learning content that's cached once per skill/topic/level and reused across learners — separate from admin-managed resources.
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

      {/* Filter bar — Role -> Skill (same catalog as Resource Management), plus an optional Topic filter */}
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
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>Loading generated content…</p>
        ) : error ? (
          <p className="text-sm p-6" style={{ color: "#DC2626" }}>{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>
            No generated content cached yet — it appears here the first time a learner opens a topic.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {["Skill", "Topic", "Level", "Title", "Generated", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.textLight }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{item.skill}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{item.topic}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{item.focusBand}</td>
                  <td className="px-4 py-3 max-w-[240px] truncate font-semibold" style={{ color: COLORS.textDark }}>{item.title}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.textLight }}>
                    {item.generatedAt ? new Date(item.generatedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openViewModal(item)} title="View" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight }}>
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        title="Delete — forces regeneration on next request"
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

      {/* View modal — full notes content for the selected cache entry */}
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
                <p className="text-base font-bold" style={{ color: COLORS.textDark }}>{viewing.title}</p>
                <p className="text-xs mt-1" style={{ color: COLORS.textLight }}>
                  {viewing.skill} / {viewing.topic} · {viewing.focusBand}
                </p>
              </div>
              <button onClick={() => setViewing(null)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight }}>
                <X size={18} />
              </button>
            </div>
            {viewError && <p className="text-xs font-medium mb-3" style={{ color: "#DC2626" }}>{viewError}</p>}
            {viewLoading && <p className="text-xs mb-3" style={{ color: COLORS.textLight }}>Loading full content…</p>}
            <p className="text-sm mb-4" style={{ color: COLORS.textMid }}>{viewing.summary}</p>
            <div className="flex flex-col gap-3">
              {(viewing.sections || []).map((section, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold mb-1" style={{ color: COLORS.textDark }}>{section.heading}</p>
                  <p className="text-sm" style={{ color: COLORS.textMid }}>{section.content}</p>
                </div>
              ))}
            </div>
            {viewing.keyTakeaways?.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold mb-1" style={{ color: COLORS.textDark }}>Key Takeaways</p>
                <ul className="list-disc pl-5 flex flex-col gap-1">
                  {viewing.keyTakeaways.map((k, i) => (
                    <li key={i} className="text-sm" style={{ color: COLORS.textMid }}>{k}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end mt-5">
              <button
                onClick={() => handleDelete(viewing)}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full"
                style={{ background: "#DC2626", color: "#fff", border: "none", cursor: "pointer" }}
              >
                <Trash2 size={14} /> Delete this cached content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
