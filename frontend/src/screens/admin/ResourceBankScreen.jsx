import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus, Trash2, Pencil, Pin, PinOff, Eye, EyeOff, Check, X,
  Youtube, Sparkles, Loader2,
} from "lucide-react";
import { COLORS, GRADIENTS, GLASS_CARD } from "../../constants/theme";
import {
  fetchResources, createResource, updateResource, deleteResource,
  setResourcePinned, setResourceEnabled,
  suggestResourcesViaAI, suggestResourcesViaYouTube,
  fetchPendingResources, verifyResource, rejectResource,
} from "../../services/adminResourceService";

const RESOURCE_TYPES = ["video", "documentation", "article", "pdf", "cheatsheet", "practice", "github"];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const TYPE_LABELS = {
  video: "📺 Video", documentation: "📄 Documentation", article: "📝 Article",
  pdf: "📚 PDF/Notes", cheatsheet: "📚 Cheat Sheet", practice: "🎯 Practice", github: "💻 GitHub",
};

const EMPTY_FORM = { skill: "", topic: "", type: "video", title: "", url: "", difficulty: "", description: "" };

/**
 * ResourceBankScreen — the admin Learning Resources Management section.
 * Same visual/CRUD conventions as QuestionBankScreen.jsx, but built as
 * one self-contained screen (own fetch/filter/CRUD state) rather than a
 * separate hook+table+modal split — smaller surface for this first
 * version; splitting out is a mechanical refactor later if this screen
 * grows further.
 *
 * Two Firestore-backed lists shown here:
 *   - Resource Bank: everything except status="pending" (verified +
 *     rejected), full edit/pin/enable/delete control.
 *   - Pending Review: status="pending" only, verify/reject actions —
 *     preserves the exact existing "AI suggests, human verifies"
 *     workflow (services/resource_review_service.py), now fed by BOTH
 *     the Gemini suggestion agent AND real YouTube search results.
 */
export default function ResourceBankScreen() {
  const [resources, setResources] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({ skill: "", topic: "", type: "", difficulty: "", status: "" });

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingResource, setEditingResource] = useState(null); // null = Add mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [suggestSkill, setSuggestSkill] = useState("");
  const [suggestTopic, setSuggestTopic] = useState("");
  const [suggesting, setSuggesting] = useState(""); // "ai" | "youtube" | ""
  const [suggestError, setSuggestError] = useState("");
  const [suggestMessage, setSuggestMessage] = useState("");

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchResources({
        skill: filters.skill || undefined,
        topic: filters.topic || undefined,
        type: filters.type || undefined,
        difficulty: filters.difficulty || undefined,
        status: filters.status || undefined,
      });
      // Pending is shown in its own section below — exclude it here so
      // a resource doesn't appear twice while awaiting review.
      setResources((data || []).filter((r) => r.status !== "pending"));
    } catch (err) {
      setError(err.message || "Couldn't load resources.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

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

  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ skill: "", topic: "", type: "", difficulty: "", status: "" });

  const openAddModal = () => {
    setEditingResource(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowFormModal(true);
  };

  const openEditModal = (resource) => {
    setEditingResource(resource);
    setForm({
      skill: resource.skill || "", topic: resource.topic || "", type: resource.type || "video",
      title: resource.title || "", url: resource.url || "", difficulty: resource.difficulty || "",
      description: resource.description || "",
    });
    setFormError("");
    setShowFormModal(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.skill.trim() || !form.topic.trim() || !form.title.trim() || !form.url.trim()) {
      setFormError("Skill, Topic, Title, and URL are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, difficulty: form.difficulty || null };
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

  const handleSuggest = async (via) => {
    setSuggestError("");
    setSuggestMessage("");
    if (!suggestSkill.trim() || !suggestTopic.trim()) {
      setSuggestError("Enter both a skill and a topic first.");
      return;
    }
    setSuggesting(via);
    try {
      const results =
        via === "youtube"
          ? await suggestResourcesViaYouTube(suggestSkill.trim(), suggestTopic.trim())
          : await suggestResourcesViaAI(suggestSkill.trim(), suggestTopic.trim());
      setSuggestMessage(
        results.length > 0
          ? `Found ${results.length} suggestion(s) — review them below before they go live.`
          : "No results found for that skill/topic."
      );
      await loadPending();
    } catch (err) {
      setSuggestError(err.message || "Suggestion request failed.");
    } finally {
      setSuggesting("");
    }
  };

  const handleVerify = async (resource) => {
    try {
      await verifyResource(resource.id);
      setPending((p) => p.filter((r) => r.id !== resource.id));
      await loadResources();
    } catch (err) {
      setError(err.message || "Couldn't verify resource.");
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

  return (
    <div className="px-4 sm:px-8 pt-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: COLORS.textDark }}>Resource Bank</h1>
          <p className="text-sm mt-1" style={{ color: COLORS.textMid }}>
            Manage every learning resource — videos, docs, articles, PDFs, cheat sheets, practice links, and repos.
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

      {/* Generate suggestions: real YouTube search + AI-suggested docs/articles/github/etc */}
      <div className="p-5 mb-6" style={{ ...GLASS_CARD, borderRadius: 20 }}>
        <p className="text-sm font-bold mb-3" style={{ color: COLORS.textDark }}>Generate Suggestions</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={suggestSkill}
            onChange={(e) => setSuggestSkill(e.target.value)}
            placeholder="Skill (e.g. React.js)"
            className="text-sm px-3 py-2 rounded-lg outline-none"
            style={{ border: `1px solid ${COLORS.border}`, background: "#fff", minWidth: 160 }}
          />
          <input
            value={suggestTopic}
            onChange={(e) => setSuggestTopic(e.target.value)}
            placeholder="Topic (e.g. React Hooks)"
            className="text-sm px-3 py-2 rounded-lg outline-none"
            style={{ border: `1px solid ${COLORS.border}`, background: "#fff", minWidth: 180 }}
          />
          <motion.button
            onClick={() => handleSuggest("youtube")}
            disabled={!!suggesting}
            whileHover={{ y: -1 }}
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{
              padding: "9px 16px", borderRadius: 9999, background: "#FF0000", color: "#fff",
              border: "none", cursor: suggesting ? "default" : "pointer", opacity: suggesting ? 0.7 : 1,
            }}
          >
            {suggesting === "youtube" ? <Loader2 size={14} className="animate-spin" /> : <Youtube size={14} />}
            Search YouTube
          </motion.button>
          <motion.button
            onClick={() => handleSuggest("ai")}
            disabled={!!suggesting}
            whileHover={{ y: -1 }}
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{
              padding: "9px 16px", borderRadius: 9999, background: GRADIENTS.purpleSky, color: "#fff",
              border: "none", cursor: suggesting ? "default" : "pointer", opacity: suggesting ? 0.7 : 1,
            }}
          >
            {suggesting === "ai" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI Suggest (docs/articles/github)
          </motion.button>
        </div>
        {suggestError && <p className="text-xs mt-2.5 font-medium" style={{ color: "#DC2626" }}>{suggestError}</p>}
        {suggestMessage && <p className="text-xs mt-2.5 font-medium" style={{ color: COLORS.textMid }}>{suggestMessage}</p>}
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
                    {TYPE_LABELS[r.type] || r.type} · {r.skill} / {r.topic} · via {r.source === "youtube_api" ? "YouTube API" : "AI"}
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <input
          value={filters.skill}
          onChange={(e) => updateFilter("skill", e.target.value)}
          placeholder="Filter by skill"
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff" }}
        />
        <input
          value={filters.topic}
          onChange={(e) => updateFilter("topic", e.target.value)}
          placeholder="Filter by topic"
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff" }}
        />
        <select
          value={filters.type}
          onChange={(e) => updateFilter("type", e.target.value)}
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff" }}
        >
          <option value="">All Types</option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select
          value={filters.difficulty}
          onChange={(e) => updateFilter("difficulty", e.target.value)}
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff" }}
        >
          <option value="">All Difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="text-sm px-3 py-2 rounded-lg outline-none"
          style={{ border: `1px solid ${COLORS.border}`, background: "#fff" }}
        >
          <option value="">Verified + Rejected</option>
          <option value="verified">Verified only</option>
          <option value="rejected">Rejected only</option>
        </select>
        {(filters.skill || filters.topic || filters.type || filters.difficulty || filters.status) && (
          <button
            onClick={clearFilters}
            className="text-xs font-semibold underline"
            style={{ color: COLORS.textMid, background: "none", border: "none", cursor: "pointer" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Main Resource Bank table */}
      <div style={{ ...GLASS_CARD, borderRadius: 20, overflow: "hidden" }}>
        {loading ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>Loading resources…</p>
        ) : error ? (
          <p className="text-sm p-6" style={{ color: "#DC2626" }}>{error}</p>
        ) : resources.length === 0 ? (
          <p className="text-sm p-6" style={{ color: COLORS.textMid }}>
            No resources yet — add one above, or generate suggestions for a skill/topic.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {["", "Title", "Type", "Skill / Topic", "Difficulty", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.textLight }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
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
                  <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{r.skill} / {r.topic}</td>
                  <td className="px-4 py-3" style={{ color: COLORS.textMid }}>{r.difficulty || "—"}</td>
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
                <input
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="Topic *"
                  className="text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                />
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
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                >
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                  className="text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                >
                  <option value="">No difficulty</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d}</option>
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
