import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus, Trash2, Pencil, Pin, PinOff, Eye, EyeOff, Check, X,
  Youtube, Sparkles, Loader2, Undo2, Zap,
} from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import {
  fetchResources, createResource, updateResource, deleteResource,
  setResourcePinned, setResourceEnabled,
  suggestResourcesViaAI, suggestResourcesViaYouTube, bulkGenerateAndVerify,
  fetchPendingResources, verifyResource, unverifyResource, rejectResource,
} from "../../services/adminResourceService";
import { getRoles } from "../../services/roleService";
import { getSkillsByRole } from "../../services/skillService";

// Role -> Skill picker uses the static role/skill catalog every other
// screen in this app already uses (constants/roles.js, constants/skills.js)
// — covers all 8 roles regardless of whether that role's TOPIC tree has
// been seeded into Firestore yet (irrelevant here — see next paragraph).
//
// Resources are organized Skill -> Band only — NOT Skill -> Topic. `band`
// is one of fundamentals/application/advanced/polish (config/settings.py's
// VALID_RESOURCE_BANDS), the exact same level services/focus_band.py
// already computes per learner from their topic quiz mastery. A resource
// created for (skill, band) is shown to every learner studying that skill
// whose current level matches, regardless of which topic/lesson they're
// on — see services/resource_repository.py's module docstring. Since the
// band list is fixed (4 values), there's no Firestore lookup needed here
// at all — no "topic not seeded yet" failure mode.

// Mirrors backend config/settings.py's DEFAULT_CATEGORY_BY_TYPE exactly
// — used to derive a resource's effective category when it (or a
// legacy resource with no stored category) doesn't have one set.
// "video" has no entry on purpose: it's never part of either category,
// same as the backend and the learner-facing TopicContentPane.jsx.
const DEFAULT_CATEGORY_BY_TYPE = {
  github: "practice", practice: "practice",
  documentation: "reference", article: "reference", pdf: "reference", cheatsheet: "reference",
};
const CATEGORY_TYPES = {
  practice: ["github", "practice"],
  reference: ["documentation", "article", "pdf", "cheatsheet"],
};
function effectiveCategory(resource) {
  if (resource.type === "video") return "video";
  return resource.category || DEFAULT_CATEGORY_BY_TYPE[resource.type] || "reference";
}

// Same fundamentals/application/advanced/polish vocabulary as
// services/focus_band.py's determine_content_level() — a resource is
// tagged with the band it's a good fit for, matched against the
// learner's own current band for that skill.
const BANDS = ["fundamentals", "application", "advanced", "polish"];
const BAND_LABELS = { fundamentals: "Fundamentals", application: "Application", advanced: "Advanced", polish: "Polish" };

const TYPE_LABELS = {
  video: "📺 Video", documentation: "📄 Documentation", article: "📝 Article",
  pdf: "📚 PDF/Notes", cheatsheet: "📚 Cheat Sheet", practice: "🎯 Practice", github: "💻 GitHub",
};
const CATEGORY_LABELS = { practice: "🎯 Practice", reference: "📖 Reference & Reading", video: "📺 Video" };
const CATEGORY_OPTIONS = ["practice", "reference", "video"];

const TABS = [
  { key: "practice", label: "Practice Resources" },
  { key: "reference", label: "Reference & Reading" },
  { key: "video", label: "Videos" },
];

const EMPTY_FORM = { skill: "", band: "fundamentals", category: "practice", type: "practice", title: "", url: "", description: "" };

/**
 * ResourceBankScreen — the admin Resource Management section.
 *
 * Organized Skill -> Band (see module comment above), not Skill -> Topic.
 * Resources are grouped for the admin into Practice Resources (GitHub /
 * coding practice) and Reference & Reading (articles / cheat sheets /
 * documentation), with Videos kept as its own tab since it has its own
 * pin/generate workflow.
 *
 * Two Firestore-backed lists shown here:
 *   - Resource Bank: everything except status="pending" (verified +
 *     rejected), full edit/pin/enable/delete control.
 *   - Pending Review: status="pending" only, verify/reject actions —
 *     preserves the exact existing "AI suggests, human verifies"
 *     workflow (services/resource_review_service.py).
 *
 * Lifecycle: Create -> Pending Review -> Verify -> Available to Learners.
 * Only verified (and enabled) resources are ever shown to students.
 */
export default function ResourceBankScreen({ admin }) {
  const [resources, setResources] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("practice");

  // Filter bar: Role -> Skill -> Band, plus Status. Band is a fixed
  // 4-value list, not fetched from anywhere.
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("");
  const [filterSkillsForRole, setFilterSkillsForRole] = useState([]);
  const [filterSkillsLoading, setFilterSkillsLoading] = useState(false);
  const [filterSkill, setFilterSkill] = useState("");
  const [filterBand, setFilterBand] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingResource, setEditingResource] = useState(null); // null = Add mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [suggestRole, setSuggestRole] = useState("");
  const [bandBySkill, setBandBySkill] = useState({}); // skill -> selected band for that section, defaults to "fundamentals"
  const [suggestingKey, setSuggestingKey] = useState(""); // `${skill}:${action}` while a request is in flight, else ""
  const [skillMessages, setSkillMessages] = useState({}); // skill -> { message, error }

  const [skillsForRole, setSkillsForRole] = useState([]); // suggest-panel skill list for suggestRole
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [suggestError2, setSuggestError2] = useState(""); // role/skill load error, kept separate from the generate-call error below

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRolesLoading(true);
      try {
        const data = await getRoles();
        if (!cancelled) setRoles(data || []);
      } catch {
        if (!cancelled) setSuggestError2("Couldn't load the role list.");
      } finally {
        if (!cancelled) setRolesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Filter bar: Role -> Skill -> Band ----

  const handleFilterRoleChange = async (roleId) => {
    setFilterRole(roleId);
    setFilterSkill("");
    setFilterSkillsForRole([]);
    if (!roleId) return;
    setFilterSkillsLoading(true);
    try {
      const categories = await getSkillsByRole(roleId);
      setFilterSkillsForRole(Object.values(categories || {}).flat());
    } catch {
      setFilterSkillsForRole([]);
    } finally {
      setFilterSkillsLoading(false);
    }
  };

  // ---- Generate Suggestions panel: Role -> Skill sections, each with its own Band picker ----

  const handleSuggestRoleChange = async (roleId) => {
    setSuggestRole(roleId);
    setSkillsForRole([]);
    setSkillMessages({});
    if (!roleId) return;
    setSkillsLoading(true);
    setSuggestError2("");
    try {
      const categories = await getSkillsByRole(roleId); // { CategoryName: [skill, skill, ...], ... }
      const flat = Object.values(categories || {}).flat();
      setSkillsForRole(flat);
    } catch {
      setSuggestError2("Couldn't load skills for that role.");
    } finally {
      setSkillsLoading(false);
    }
  };

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchResources({
        skill: filterSkill || undefined,
        band: filterBand || undefined,
        status: filterStatus || undefined,
      });
      // Pending is shown in its own section below — exclude it here so
      // a resource doesn't appear twice while awaiting review.
      setResources((data || []).filter((r) => r.status !== "pending"));
    } catch (err) {
      setError(err.message || "Couldn't load resources.");
    } finally {
      setLoading(false);
    }
  }, [filterSkill, filterBand, filterStatus]);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const data = await fetchPendingResources();
      setPending(data || []);
    } catch {
      // Non-fatal — the main Resource Bank table still works without the queue.
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const clearFilters = () => {
    setFilterRole(""); setFilterSkill(""); setFilterSkillsForRole([]);
    setFilterBand(""); setFilterStatus("");
  };

  const openAddModal = () => {
    setEditingResource(null);
    // Pre-fill category/type from whichever tab is open.
    const category = activeTab;
    setForm({ ...EMPTY_FORM, category, type: category === "video" ? "video" : CATEGORY_TYPES[category][0] });
    setFormError("");
    setShowFormModal(true);
  };

  const openEditModal = (resource) => {
    setEditingResource(resource);
    const category = effectiveCategory(resource);
    setForm({
      skill: resource.skill || "", band: resource.band || "fundamentals",
      category,
      type: resource.type || (category === "video" ? "video" : CATEGORY_TYPES[category][0]),
      title: resource.title || "", url: resource.url || "",
      description: resource.description || "",
    });
    setFormError("");
    setShowFormModal(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.skill.trim() || !form.band || !form.title.trim() || !form.url.trim()) {
      setFormError("Skill, Band, Title, and URL are required.");
      return;
    }
    setSaving(true);
    try {
      // "video" is a form-only pseudo-category (see CATEGORY_OPTIONS) —
      // video resources don't carry a category on the backend, same as
      // everywhere else in the app (video is its own thing, never part
      // of Practice/Reference & Reading).
      const payload = { ...form, category: form.category === "video" ? null : form.category };
      if (editingResource) {
        await updateResource(editingResource.id, payload);
      } else {
        await createResource(payload);
      }
      setShowFormModal(false);
      await loadResources();
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || "Couldn't save resource.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (resource) => {
    if (!window.confirm(`Delete "${resource.title}"? This can't be undone.`)) return;
    try {
      await deleteResource(resource.id);
      setResources((rs) => rs.filter((r) => r.id !== resource.id));
    } catch (err) {
      setError(err.message || "Couldn't delete resource.");
    }
  };

  const handleTogglePin = async (resource) => {
    try {
      const updated = await setResourcePinned(resource.id, !resource.isPinned);
      setResources((rs) => rs.map((r) => (r.id === resource.id ? { ...r, ...updated } : r)));
    } catch (err) {
      setError(err.message || "Couldn't update pin status.");
    }
  };

  const handleToggleEnabled = async (resource) => {
    try {
      const nextEnabled = resource.enabled === false; // treat missing/undefined as currently enabled
      const updated = await setResourceEnabled(resource.id, nextEnabled);
      setResources((rs) => rs.map((r) => (r.id === resource.id ? { ...r, ...updated } : r)));
    } catch (err) {
      setError(err.message || "Couldn't update visibility.");
    }
  };

  // Every action below runs at (skill, band) directly — the band comes
  // from that section's own picker, no Firestore lookup involved.
  const setSkillMsg = (skill, patch) =>
    setSkillMessages((m) => ({ ...m, [skill]: { message: "", error: "", ...m[skill], ...patch } }));

  const bandFor = (skill) => bandBySkill[skill] || "fundamentals";

  const handleSuggest = async (skill, via) => {
    const band = bandFor(skill);
    setSkillMsg(skill, { message: "", error: "" });
    setSuggestingKey(`${skill}:${via}`);
    try {
      const results =
        via === "youtube"
          ? await suggestResourcesViaYouTube(skill, band)
          : await suggestResourcesViaAI(skill, band);
      setSkillMsg(skill, {
        message: results.length > 0 ? `Found ${results.length} suggestion(s) for ${BAND_LABELS[band]} — review below before they go live.` : "No results found.",
      });
      await loadPending();
    } catch (err) {
      setSkillMsg(skill, { error: err.message || "Request failed." });
    } finally {
      setSuggestingKey("");
    }
  };

  // VIDEO-ONLY, one-click path — publishes one real YouTube video,
  // immediately verified. articleCount:0 tells the backend to skip
  // article generation cleanly (see resource_review_service.py's
  // generate_and_auto_verify()).
  const handleGenerateVideo = async (skill) => {
    const band = bandFor(skill);
    setSkillMsg(skill, { message: "", error: "" });
    if (!admin?.email) {
      setSkillMsg(skill, { error: "No logged-in admin identity found — please log back in." });
      return;
    }
    setSuggestingKey(`${skill}:video`);
    try {
      const result = await bulkGenerateAndVerify(skill, band, admin.email, { articleCount: 0, videoCount: 1 });
      setSkillMsg(skill, {
        message: result.videos.length > 0 ? `Published "${result.videos[0].title}" for ${BAND_LABELS[band]} — verified by ${admin.email}.` : "No video found for this skill/band.",
        error: result.errors.join(" · "),
      });
      await loadResources();
    } catch (err) {
      setSkillMsg(skill, { error: err.message || "Video generation failed." });
    } finally {
      setSuggestingKey("");
    }
  };

  const handleBulkGenerate = async (skill) => {
    const band = bandFor(skill);
    setSkillMsg(skill, { message: "", error: "" });
    if (!admin?.email) {
      setSkillMsg(skill, { error: "No logged-in admin identity found — please log back in." });
      return;
    }
    setSuggestingKey(`${skill}:bulk`);
    try {
      const result = await bulkGenerateAndVerify(skill, band, admin.email);
      const total = result.articles.length + result.videos.length;
      setSkillMsg(skill, {
        message: total > 0 ? `Published ${total} resource(s) for ${BAND_LABELS[band]} (${result.articles.length} article/doc/practice + ${result.videos.length} video) — verified by ${admin.email}.` : "No resources could be generated.",
        error: result.errors.join(" · "),
      });
      await loadResources();
    } catch (err) {
      setSkillMsg(skill, { error: err.message || "Bulk generation failed." });
    } finally {
      setSuggestingKey("");
    }
  };

  const handleVerify = async (resource) => {
    try {
      await verifyResource(resource.id, admin?.email || "");
      setPending((p) => p.filter((r) => r.id !== resource.id));
      await loadResources();
    } catch (err) {
      setError(err.message || "Couldn't verify resource.");
    }
  };

  const handleUnverify = async (resource) => {
    if (!window.confirm(`Pull "${resource.title}" out of student view? It'll go back to Pending Review.`)) return;
    try {
      await unverifyResource(resource.id);
      setResources((rs) => rs.filter((r) => r.id !== resource.id));
      await loadPending();
    } catch (err) {
      setError(err.message || "Couldn't unverify resource.");
    }
  };

  const handleReject = async (resource) => {
    try {
      await rejectResource(resource.id);
      setPending((p) => p.filter((r) => r.id !== resource.id));
    } catch (err) {
      setError(err.message || "Couldn't reject resource.");
    }
  };

  const visibleResources = resources.filter((r) => effectiveCategory(r) === activeTab);

  return (
    <div className="px-4 sm:px-8 pt-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: COLORS.textDark }}>Resource Management</h1>
          <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
            Manage Practice Resources and Reference &amp; Reading materials, organized by Skill → Band.
          </p>
        </div>
        <motion.button
          onClick={openAddModal}
          whileHover={{ y: -2 }}
          className="flex items-center gap-2 text-sm font-semibold"
          style={{
            padding: "10px 20px", borderRadius: 9999, background: GRADIENTS.purplePink,
            color: "#fff", border: "none", cursor: "pointer",
            boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
          }}
        >
          <Plus size={15} /> Add Resource
        </motion.button>
      </div>

      {/* Generate suggestions: real YouTube search + AI-suggested docs/articles/github/etc.
          Scoped to Role -> Skill, each skill section has its own Band
          picker (fundamentals/application/advanced/polish) — no topic
          anywhere, no dependency on a seeded topic tree. */}
      <div className="p-5 mb-6" style={{ ...GLASS_CARD, borderRadius: 20 }}>
        <p className="text-sm font-bold mb-3" style={{ color: COLORS.textDark }}>Generate Suggestions</p>
        {suggestError2 && (
          <p className="text-xs font-semibold mb-2" style={{ color: "#DC2626" }}>{suggestError2}</p>
        )}
        <select
          value={suggestRole}
          onChange={(e) => handleSuggestRoleChange(e.target.value)}
          disabled={rolesLoading}
          className="text-sm px-3 py-2 rounded-lg outline-none mb-4"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff", minWidth: 220, color: suggestRole ? COLORS.textDark : COLORS.textLight }}
        >
          <option value="">{rolesLoading ? "Loading roles…" : "Select role"}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.title || r.id}</option>
          ))}
        </select>

        {skillsLoading && <p className="text-xs" style={{ color: COLORS.textLight }}>Loading skills…</p>}

        <div className="flex flex-col gap-3">
          {skillsForRole.map((skill) => {
            const busy = suggestingKey.startsWith(`${skill}:`);
            const busyAction = busy ? suggestingKey.split(":")[1] : "";
            const msg = skillMessages[skill] || {};
            const band = bandFor(skill);
            return (
              <div key={skill} className="p-3.5 rounded-xl" style={{ background: "rgba(255,255,255,0.55)", border: `1px solid ${COLORS.border}` }}>
                <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
                  <p className="text-sm font-bold" style={{ color: COLORS.textDark }}>{skill}</p>
                  <select
                    value={band}
                    onChange={(e) => setBandBySkill((b) => ({ ...b, [skill]: e.target.value }))}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg outline-none"
                    style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.textDark }}
                  >
                    {BANDS.map((b) => (
                      <option key={b} value={b}>{BAND_LABELS[b]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <motion.button
                    onClick={() => handleGenerateVideo(skill)}
                    disabled={!!suggestingKey}
                    whileHover={{ y: -1 }}
                    title="Publishes one real YouTube video immediately for this skill/band — no docs/articles/github/cheatsheet, no review queue."
                    className="flex items-center gap-1.5 text-sm font-semibold"
                    style={{
                      padding: "9px 16px", borderRadius: 9999, background: "#FF0000", color: "#fff",
                      border: "none", cursor: suggestingKey ? "default" : "pointer", opacity: suggestingKey ? 0.7 : 1,
                    }}
                  >
                    {busyAction === "video" ? <Loader2 size={14} className="animate-spin" /> : <Youtube size={14} />}
                    Generate &amp; Publish Video
                  </motion.button>
                  <motion.button
                    onClick={() => handleSuggest(skill, "youtube")}
                    disabled={!!suggestingKey}
                    whileHover={{ y: -1 }}
                    title="Search only — saves as pending for review, doesn't publish."
                    className="flex items-center gap-1.5 text-sm font-semibold"
                    style={{
                      padding: "9px 16px", borderRadius: 9999, background: "#fff", color: "#DC2626",
                      border: "1px solid #DC2626", cursor: suggestingKey ? "default" : "pointer", opacity: suggestingKey ? 0.7 : 1,
                    }}
                  >
                    {busyAction === "youtube" ? <Loader2 size={14} className="animate-spin" /> : <Youtube size={14} />}
                    Search Only (review queue)
                  </motion.button>
                  <motion.button
                    onClick={() => handleSuggest(skill, "ai")}
                    disabled={!!suggestingKey}
                    whileHover={{ y: -1 }}
                    className="flex items-center gap-1.5 text-sm font-semibold"
                    style={{
                      padding: "9px 16px", borderRadius: 9999, background: GRADIENTS.purpleSky, color: "#fff",
                      border: "none", cursor: suggestingKey ? "default" : "pointer", opacity: suggestingKey ? 0.7 : 1,
                    }}
                  >
                    {busyAction === "ai" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    AI Suggest (docs/articles/github)
                  </motion.button>
                  <motion.button
                    onClick={() => handleBulkGenerate(skill)}
                    disabled={!!suggestingKey}
                    whileHover={{ y: -1 }}
                    title="Generates AI docs/articles/github AND a YouTube video, and publishes them immediately — no review queue."
                    className="flex items-center gap-1.5 text-sm font-semibold"
                    style={{
                      padding: "9px 16px", borderRadius: 9999, background: "#22C55E", color: "#fff",
                      border: "none", cursor: suggestingKey ? "default" : "pointer", opacity: suggestingKey ? 0.7 : 1,
                    }}
                  >
                    {busyAction === "bulk" ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    Generate &amp; Publish Now
                  </motion.button>
                </div>
                {msg.error && <p className="text-xs mt-2 font-medium" style={{ color: "#DC2626" }}>{msg.error}</p>}
                {msg.message && <p className="text-xs mt-2 font-medium" style={{ color: COLORS.textMid }}>{msg.message}</p>}
              </div>
            );
          })}
          {suggestRole && !skillsLoading && skillsForRole.length === 0 && (
            <p className="text-xs" style={{ color: COLORS.textLight }}>No skills found for this role.</p>
          )}
        </div>
      </div>

      {/* Pending Review queue — preserves the existing pending/verified/rejected workflow */}
      {pending.length > 0 && (
        <div className="p-5 mb-6" style={{ ...GLASS_CARD, borderRadius: 20, border: "1px solid rgba(212,160,23,0.35)" }}>
          <p className="text-sm font-bold mb-3" style={{ color: COLORS.textDark }}>
            Pending Review ({pending.length})
          </p>
          <div className="flex flex-col gap-2">
            {pending.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.6)" }}
              >
                {r.thumbnail && (
                  <img src={r.thumbnail} alt="" style={{ width: 64, height: 36, borderRadius: 6, objectFit: "cover" }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: COLORS.textDark }}>{r.title}</p>
                  <p className="text-xs" style={{ color: COLORS.textLight }}>
                    {TYPE_LABELS[r.type] || r.type} · {r.skill} / {BAND_LABELS[r.band] || r.band} · via {r.source === "youtube_api" ? "YouTube API" : "AI"}
                  </p>
                </div>
                <a
                  href={r.url} target="_blank" rel="noreferrer"
                  className="text-xs font-semibold underline flex-shrink-0"
                  style={{ color: COLORS.purple }}
                >
                  Open link
                </a>
                <button
                  onClick={() => handleVerify(r)}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
                  style={{ background: "#22C55E", color: "#fff", border: "none", cursor: "pointer" }}
                >
                  <Check size={12} /> Verify
                </button>
                <button
                  onClick={() => handleReject(r)}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
                  style={{ background: "#DC2626", color: "#fff", border: "none", cursor: "pointer" }}
                >
                  <X size={12} /> Reject
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search bar: Role -> Skill -> Band, plus Status. Band is a fixed
          4-value dropdown, not fetched from anywhere. */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <select
          value={filterRole}
          onChange={(e) => handleFilterRoleChange(e.target.value)}
          disabled={rolesLoading}
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: filterRole ? COLORS.textDark : COLORS.textLight }}
        >
          <option value="">{rolesLoading ? "Loading roles…" : "All roles"}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.title || r.id}</option>
          ))}
        </select>
        <select
          value={filterSkill}
          onChange={(e) => setFilterSkill(e.target.value)}
          disabled={!filterRole || filterSkillsLoading}
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: filterSkill ? COLORS.textDark : COLORS.textLight, opacity: filterRole ? 1 : 0.6 }}
        >
          <option value="">{!filterRole ? "Select a role first" : filterSkillsLoading ? "Loading skills…" : "All skills"}</option>
          {filterSkillsForRole.map((skill) => (
            <option key={skill} value={skill}>{skill}</option>
          ))}
        </select>
        <select
          value={filterBand}
          onChange={(e) => setFilterBand(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: filterBand ? COLORS.textDark : COLORS.textLight }}
        >
          <option value="">All bands</option>
          {BANDS.map((b) => (
            <option key={b} value={b}>{BAND_LABELS[b]}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff" }}
        >
          <option value="">Verified + Rejected</option>
          <option value="verified">Verified only</option>
          <option value="rejected">Rejected only</option>
        </select>
        {(filterRole || filterSkill || filterBand || filterStatus) && (
          <button
            onClick={clearFilters}
            className="text-xs font-semibold underline"
            style={{ color: COLORS.textMid, background: "none", border: "none", cursor: "pointer" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Practice / Reference & Reading / Videos tabs */}
      <div className="flex items-center gap-2 mb-4">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = resources.filter((r) => effectiveCategory(r) === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="text-sm font-semibold px-4 py-2 rounded-full"
              style={{
                background: isActive ? GRADIENTS.purplePink : "#fff",
                color: isActive ? "#fff" : COLORS.textMid,
                border: `1px solid ${isActive ? "transparent" : COLORS.border}`,
                cursor: "pointer",
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Main Resource table, filtered to the active tab's types */}
      <div style={{ ...GLASS_CARD, borderRadius: 20, overflow: "hidden" }}>
        {loading ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>Loading resources…</p>
        ) : error ? (
          <p className="text-sm p-6" style={{ color: "#DC2626" }}>{error}</p>
        ) : visibleResources.length === 0 ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>
            No {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} yet — add one above, or generate suggestions for a skill/band.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {["", "Title", "Type", "Skill / Band", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.textLight }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleResources.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleTogglePin(r)}
                      title={r.isPinned ? "Unpin" : "Pin as recommended"}
                      style={{ background: "none", border: "none", cursor: "pointer", color: r.isPinned ? COLORS.purple : COLORS.textLight }}
                    >
                      {r.isPinned ? <Pin size={16} /> : <PinOff size={16} />}
                    </button>
                  </td>
                  <td className="px-4 py-3 max-w-[240px]">
                    <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold truncate block" style={{ color: COLORS.textDark }}>
                      {r.title}
                    </a>
                  </td>
                  <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{TYPE_LABELS[r.type] || r.type}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{r.skill} / {BAND_LABELS[r.band] || r.band}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold rounded-full"
                      style={{
                        color: "#fff",
                        background: r.status === "verified" ? "#22C55E" : "#9CA3AF",
                      }}
                    >
                      {r.status}
                    </span>
                    {r.status === "verified" && r.verifiedBy && (
                      <span className="block text-[10px] mt-1" style={{ color: COLORS.textLight }}>
                        by {r.verifiedBy}
                      </span>
                    )}
                    {r.enabled === false && (
                      <span className="ml-1.5 px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ color: "#fff", background: "#8A93A8" }}>
                        Hidden
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleEnabled(r)} title={r.enabled === false ? "Enable" : "Disable"} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight }}>
                        {r.enabled === false ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      {r.status === "verified" && (
                        <button onClick={() => handleUnverify(r)} title="Unverify — remove from student view" style={{ background: "none", border: "none", cursor: "pointer", color: "#D4A017" }}>
                          <Undo2 size={15} />
                        </button>
                      )}
                      <button onClick={() => openEditModal(r)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textLight }}>
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(r)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>
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

      {/* Add/Edit modal */}
      {showFormModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: "rgba(13,27,61,0.45)", zIndex: 50 }}
          onClick={() => setShowFormModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md p-6"
            style={{ ...GLASS_CARD, background: "#fff", borderRadius: 20 }}
          >
            <p className="text-base font-bold mb-4" style={{ color: COLORS.textDark }}>
              {editingResource ? "Edit Resource" : "Add Resource"}
            </p>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  value={form.skill}
                  onChange={(e) => setForm((f) => ({ ...f, skill: e.target.value }))}
                  placeholder="Skill *"
                  className="text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                />
                <select
                  value={form.band}
                  onChange={(e) => setForm((f) => ({ ...f, band: e.target.value }))}
                  className="text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                >
                  {BANDS.map((b) => (
                    <option key={b} value={b}>{BAND_LABELS[b]}</option>
                  ))}
                </select>
              </div>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title *"
                className="text-sm px-3 py-2 rounded-lg outline-none"
                style={{ border: `1px solid ${COLORS.border}` }}
              />
              <input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="URL *"
                className="text-sm px-3 py-2 rounded-lg outline-none"
                style={{ border: `1px solid ${COLORS.border}` }}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={form.category}
                  onChange={(e) => {
                    const category = e.target.value;
                    // Switching category resets type to that category's
                    // first valid type (or "video" for the video pseudo-category)
                    // so form.type never points at a type outside the
                    // chosen category.
                    const type = category === "video" ? "video" : CATEGORY_TYPES[category][0];
                    setForm((f) => ({ ...f, category, type }));
                  }}
                  className="text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  disabled={form.category === "video"}
                  className="text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ border: `1px solid ${COLORS.border}`, opacity: form.category === "video" ? 0.6 : 1 }}
                >
                  {(form.category === "video" ? ["video"] : CATEGORY_TYPES[form.category]).map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description (optional)"
                rows={2}
                className="text-sm px-3 py-2 rounded-lg outline-none resize-none"
                style={{ border: `1px solid ${COLORS.border}` }}
              />
              {formError && <p className="text-xs font-medium" style={{ color: "#DC2626" }}>{formError}</p>}
              <div className="flex items-center justify-end gap-2.5 mt-1">
                <button
                  onClick={() => setShowFormModal(false)}
                  className="text-sm font-semibold px-4 py-2 rounded-full"
                  style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.textMid, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-sm font-semibold px-5 py-2 rounded-full"
                  style={{ background: GRADIENTS.purplePink, color: "#fff", border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "Saving…" : editingResource ? "Save Changes" : "Add Resource"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
