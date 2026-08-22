import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Sparkles,
  Plus,
  User as UserIcon,
  FileText,
  Upload,
  X,
  Presentation as PresentationIcon,
  Layers,
  GitBranch,
  Volume2,
  Play,
  Pause,
  Square,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Trash2,
  MessageSquare,
  Download,
  Check,
  Star,
  AlertTriangle,
  Settings,
  Database,
  Network,
  Shield,
  Zap,
  Cloud,
  BookOpen,
  MoreVertical,
  ChevronDown,
  Share2,
  Maximize2,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  RotateCw,
  History,
  Search,
} from "lucide-react";
import {
  sendChatMessage,
  listChatSessions,
  loadChatSession,
  deleteChatSession,
  uploadChatSource,
  listChatSources,
  getSourcesContent,
  deleteChatSource,
} from "../services/aiChatService";
import {
  generateFlashcardsFromChat,
  generateFlashcardsFromSources,
  generateFlashcardsFromCustomText,
} from "../services/flashcardService";
import {
  downloadSourcesSummaryPptx,
  downloadChatSummaryPptx,
  downloadSourcesSummaryPdf,
  downloadChatSummaryPdf,
} from "../services/pptService";
import { generateMindMap } from "../services/mindmapService";
import { generateSlideDeckPreview, downloadDeckContentPptx, downloadDeckContentPdf } from "../services/slideDeckService";
import { listStudioArtifacts, getStudioArtifact, saveStudioArtifact } from "../services/studioService";
import { getUserProfile } from "../services/profileService";
import { COLORS, GRADIENTS, GLASS_CARD } from "../constants/theme";

/**
 * AIStudyAssistantScreen — sidebar: "AI Study Assistant" (navigation.js
 * key "ai"). Four columns: History (permanent, ChatGPT-style) | Sources
 * | Chat | Studio.
 *
 * Chat is SESSION-based — each "+ New Chat" is its own saved
 * conversation; the History column lists every past one.
 *
 * Studio actions:
 *   - Slide Deck / Flashcards: Topic / Chat / Sources modes
 *   - Mind Map / Audio Overview: Sources / Chat / Type-your-own modes
 *     (the "Type" mode opens a small text box — see CustomInputBody)
 */
// Deterministic accent color per chat session (from its id), just so the
// Recent Chats list isn't a monotone stack of identical gray icons.
const SESSION_COLORS = ["#D4A017", "#E4568A", "#0EA5E9", "#22C08E", "#8B5CF6", "#F0AB5C"];
function sessionColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return SESSION_COLORS[Math.abs(hash) % SESSION_COLORS.length];
}

export default function AIStudyAssistantScreen({ uid }) {
  // --- history sidebar ---
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  // --- greeting header: first name + avatar come from the same
  // Firebase-Auth-backed profile Profile screen uses (profileService.js),
  // just the two fields this screen needs rather than the full bundle.
  const [studentName, setStudentName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // --- sources ---
  const [sources, setSources] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const fileInputRef = useRef(null);

  // --- chat (session-based) ---
  const [sessions, setSessions] = useState([]);
  const [sessionsError, setSessionsError] = useState("");
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [chatError, setChatError] = useState("");
  const [loadingChat, setLoadingChat] = useState(true);
  const scrollRef = useRef(null);

  // --- studio modal ---
  // null | "flashcards" | "mindmap" | "audio" | "custom-input"
  const [studioModal, setStudioModal] = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [studioError, setStudioError] = useState("");
  const [pptLoading, setPptLoading] = useState(false);
  const [pptFormat, setPptFormat] = useState("pptx"); // "pptx" | "pdf" — Slide Deck download format
  const [slideDeckContent, setSlideDeckContent] = useState(null); // AI-generated {title, summary, sections, keyTakeaways} for the in-app preview
  const [studioArtifacts, setStudioArtifacts] = useState([]); // [{id, type, title, createdAt}] saved Mind Maps / Slide Decks for the open chat

  const [flashSet, setFlashSet] = useState(null);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);

  const [mindMapNotes, setMindMapNotes] = useState(null);
  const [audioNotes, setAudioNotes] = useState(null);

  // which card ("mindmap" | "audio" | "flashcards" | "slidedeck") the
  // custom-input modal is generating for
  const [customTarget, setCustomTarget] = useState(null);
  const [customText, setCustomText] = useState("");

  async function refreshSessions() {
    try {
      setSessions(await listChatSessions(uid));
      setSessionsError("");
    } catch (err) {
      setSessionsError(err.message || "Couldn't load your chat history.");
    }
  }

  useEffect(() => {
    if (!uid) {
      setLoadingChat(false);
      return;
    }
    (async () => {
      try {
        setSources(await listChatSources(uid));
      } finally {
        setLoadingChat(false);
      }
    })();
    refreshSessions();
    getUserProfile()
      .then((p) => {
        setStudentName((p?.fullName || "").split(" ")[0] || "");
        setAvatarUrl(p?.avatarUrl || "");
      })
      .catch(() => {});

    return () => window.speechSynthesis?.cancel();
  }, [uid]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // ---------------- Chat handlers ----------------
  async function handleSend(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending || !uid) return;
    setChatError("");
    setSuggestions([]);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed, ts: Date.now() }]);
    setSending(true);
    try {
      const result = await sendChatMessage(uid, trimmed, activeSessionId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.reply, ts: Date.now(), citedSources: result.citedSources || [] },
      ]);
      setSuggestions(result.suggestions || []);
      if (!activeSessionId) setActiveSessionId(result.sessionId);
      refreshSessions();
    } catch (err) {
      setChatError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setSuggestions([]);
    setChatError("");
  }

  // Regenerate — re-sends the last user turn as a fresh message (there's
  // no backend "regenerate this reply" endpoint, so this is the closest
  // real equivalent rather than a decorative dead button).
  function handleRegenerate() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) handleSend(lastUser.content);
  }

  const filteredSessions = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => (s.title || "").toLowerCase().includes(q));
  }, [sessions, historySearch]);

  async function handleOpenSession(sessionId) {
    if (sessionId === activeSessionId) return;
    setChatError("");
    setSuggestions([]);
    setMessages([]);
    setActiveSessionId(sessionId);
    try {
      setMessages(await loadChatSession(uid, sessionId));
    } catch (err) {
      setChatError(err.message || "Couldn't load that conversation.");
    }
  }

  async function handleDeleteSession(sessionId, e) {
    e.stopPropagation();
    try {
      await deleteChatSession(uid, sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) handleNewChat();
    } catch (err) {
      setChatError(err.message || "Couldn't delete that conversation.");
    }
  }

  // ---------------- Source handlers ----------------
  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uid) return;
    setSourceError("");
    setUploading(true);
    try {
      await uploadChatSource(uid, file);
      setSources(await listChatSources(uid));
    } catch (err) {
      setSourceError(err.message || "Couldn't add that source.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteSource(sourceId) {
    try {
      await deleteChatSource(uid, sourceId);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    } catch (err) {
      setSourceError(err.message || "Couldn't remove that source.");
    }
  }

  // ---------------- Studio: Slide Deck (Topic / Chat / Sources) ----------------
  // ---------------- Studio: Slide Deck (Sources / Chat / Type) ----------------
  async function handleDownloadPpt(mode) {
    if (mode === "custom") {
      setCustomTarget("slidedeck");
      setCustomText("");
      setStudioError("");
      setStudioModal("custom-input");
      return;
    }
    setStudioError("");
    setPptLoading(true);
    try {
      if (mode === "chat") {
        if (!activeSessionId) throw new Error("Open or start a chat first.");
        if (pptFormat === "pdf") await downloadChatSummaryPdf(uid, activeSessionId);
        else await downloadChatSummaryPptx(uid, activeSessionId);
      } else {
        if (pptFormat === "pdf") await downloadSourcesSummaryPdf(uid);
        else await downloadSourcesSummaryPptx(uid);
      }
    } catch (err) {
      setStudioError(err.message || "Couldn't generate the slide deck.");
    } finally {
      setPptLoading(false);
    }
  }

  // ---------------- Studio: Flashcards (Sources / Chat / Type) ----------------
  async function handleGenerateFlashcards(mode) {
    if (mode === "custom") {
      setCustomTarget("flashcards");
      setCustomText("");
      setStudioError("");
      setStudioModal("custom-input");
      return;
    }
    setStudioError("");
    setStudioLoading(true);
    setStudioModal("flashcards");
    try {
      let result;
      if (mode === "chat") {
        if (!activeSessionId) throw new Error("Open or start a chat first.");
        result = await generateFlashcardsFromChat(uid, activeSessionId);
      } else {
        result = await generateFlashcardsFromSources(uid);
      }
      setFlashSet(result);
      setFlashIndex(0);
      setFlashFlipped(false);
      // Saved into the same per-session Studio history as Mind Map/Slide
      // Deck (see studio_repository.py) so it shows up as an "already
      // generated" card next time this chat is reopened — only when a
      // chat is actually open, same condition mindmap/slidedeck use.
      if (activeSessionId) {
        saveStudioArtifact(uid, activeSessionId, "flashcards", result.title || "Flashcards", result)
          .then(refreshStudioArtifacts)
          .catch(() => {}); // best-effort — a save failure shouldn't block the flashcards the student is already looking at
      }
    } catch (err) {
      setStudioError(err.message || "Couldn't generate flashcards.");
    } finally {
      setStudioLoading(false);
    }
  }

  // ---------------- Studio: Mind Map / Audio Overview (Sources / Chat / Type) ----------------
  function notesFromSections(title, sections) {
    return { title, summary: "", sections, keyTakeaways: [] };
  }

  /** Raw combined text + a label describing it — used as MindMapAgent
   * input. Audio Overview builds its own (structured-by-source)
   * version separately below, since reading aloud doesn't need the
   * LLM to restructure anything. */
  async function getRawTextForMode(mode) {
    if (mode === "sources") {
      if (sources.length === 0) throw new Error("Add a source first.");
      const content = await getSourcesContent(uid);
      if (content.length === 0) throw new Error("Couldn't load your sources' content.");
      return { label: "the student's uploaded sources", text: content.map((s) => `[${s.title}]\n${s.text}`).join("\n\n") };
    }
    if (mode === "chat") {
      if (!activeSessionId) throw new Error("Open or start a chat first.");
      if (messages.length === 0) throw new Error("This conversation has no messages yet.");
      const text = messages.map((m) => `${m.role === "user" ? "Student" : "Assistant"}: ${m.content}`).join("\n");
      return { label: "a chat conversation", text };
    }
    throw new Error("Unknown mode.");
  }

  async function buildAudioNotesForMode(mode) {
    if (mode === "sources") {
      if (sources.length === 0) throw new Error("Add a source first.");
      const content = await getSourcesContent(uid);
      if (content.length === 0) throw new Error("Couldn't load your sources' content.");
      return notesFromSections("Your Sources", content.map((s) => ({ heading: s.title, content: s.text })));
    }
    if (mode === "chat") {
      if (!activeSessionId) throw new Error("Open or start a chat first.");
      const sections = [];
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === "user") {
          const answer = messages[i + 1]?.role === "assistant" ? messages[i + 1].content : "";
          sections.push({ heading: messages[i].content.slice(0, 60), content: answer });
        }
      }
      if (sections.length === 0) throw new Error("This conversation has no messages yet.");
      return notesFromSections("Your Chat", sections);
    }
    throw new Error("Unknown mode.");
  }

  // Loads the saved Mind Map / Slide Deck cards for whichever chat is open —
  // re-runs on every session switch so opening a different chat shows that
  // chat's own studio history rather than the previous one's.
  useEffect(() => {
    if (!uid || !activeSessionId) {
      setStudioArtifacts([]);
      return;
    }
    let cancelled = false;
    listStudioArtifacts(uid, activeSessionId)
      .then((items) => {
        if (!cancelled) setStudioArtifacts(items);
      })
      .catch(() => {
        if (!cancelled) setStudioArtifacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, activeSessionId]);

  function refreshStudioArtifacts() {
    if (!uid || !activeSessionId) return;
    listStudioArtifacts(uid, activeSessionId)
      .then(setStudioArtifacts)
      .catch(() => {});
  }

  async function openStudioArtifact(item) {
    setStudioError("");
    try {
      const full = await getStudioArtifact(uid, activeSessionId, item.id);
      if (full.type === "mindmap") {
        setMindMapNotes(full.content);
        setStudioModal("mindmap");
      } else if (full.type === "slidedeck") {
        setSlideDeckContent(full.content);
        setStudioModal("slidedeck-preview");
      } else if (full.type === "flashcards") {
        setFlashSet(full.content);
        setFlashIndex(0);
        setFlashFlipped(false);
        setStudioModal("flashcards");
      } else if (full.type === "audio") {
        setAudioNotes(full.content);
        setStudioModal("audio");
      }
    } catch (err) {
      setStudioError(err.message || "Couldn't load that item.");
    }
  }

  function handleMindMapAction(mode) {
    if (mode === "custom") {
      setCustomTarget("mindmap");
      setCustomText("");
      setStudioError("");
      setStudioModal("custom-input");
      return;
    }
    runStudioBuild("mindmap", async () => {
      const { label, text } = await getRawTextForMode(mode);
      return generateMindMap(text, label, uid, activeSessionId);
    }, setMindMapNotes, refreshStudioArtifacts);
  }

  function handleAudioAction(mode) {
    if (mode === "custom") {
      setCustomTarget("audio");
      setCustomText("");
      setStudioError("");
      setStudioModal("custom-input");
      return;
    }
    runStudioBuild("audio", () => buildAudioNotesForMode(mode), setAudioNotes, (notes) => {
      // Audio Overview is built entirely client-side (no backend call
      // knows the session the way Mind Map/Slide Deck's own generate
      // endpoints do — see mindmap_routes.py/slidedeck_routes.py), so
      // it's saved into Studio history explicitly here instead.
      if (activeSessionId && notes) {
        saveStudioArtifact(uid, activeSessionId, "audio", notes.title || "Audio Overview", notes)
          .then(refreshStudioArtifacts)
          .catch(() => {}); // best-effort — a save failure shouldn't block playback the student already has
      }
    });
  }

  async function runStudioBuild(modalKey, buildFn, setNotes, onSuccess) {
    setStudioError("");
    setStudioLoading(true);
    setStudioModal(modalKey);
    try {
      const result = await buildFn();
      setNotes(result);
      onSuccess?.(result);
    } catch (err) {
      setStudioError(err.message || "Something went wrong.");
    } finally {
      setStudioLoading(false);
    }
  }

  async function handleGenerateFromCustomText() {
    if (!customText.trim()) {
      setStudioError("Type something first.");
      return;
    }
    const text = customText.trim();
    setStudioError("");

    if (customTarget === "mindmap") {
      setStudioLoading(true);
      setStudioModal("mindmap");
      try {
        setMindMapNotes(await generateMindMap(text, "the student's own notes", uid, activeSessionId));
        refreshStudioArtifacts();
      } catch (err) {
        setStudioError(err.message || "Couldn't build the mind map.");
      } finally {
        setStudioLoading(false);
      }
    } else if (customTarget === "audio") {
      const firstLine = text.split("\n")[0].slice(0, 60);
      setAudioNotes(notesFromSections(firstLine || "Your Topic", [{ heading: "Your Input", content: text }]));
      setStudioModal("audio");
    } else if (customTarget === "flashcards") {
      setStudioLoading(true);
      setStudioModal("flashcards");
      try {
        const result = await generateFlashcardsFromCustomText(uid, text);
        setFlashSet(result);
        setFlashIndex(0);
        setFlashFlipped(false);
      } catch (err) {
        setStudioError(err.message || "Couldn't generate flashcards.");
      } finally {
        setStudioLoading(false);
      }
    } else if (customTarget === "slidedeck") {
      setStudioLoading(true);
      setStudioModal("slidedeck-preview");
      try {
        setSlideDeckContent(await generateSlideDeckPreview(text, uid, activeSessionId));
        refreshStudioArtifacts();
      } catch (err) {
        setStudioError(err.message || "Couldn't generate the slide deck.");
      } finally {
        setStudioLoading(false);
      }
    }
  }

  function closeStudioModal() {
    window.speechSynthesis?.cancel();
    setStudioModal(null);
    setStudioError("");
    setSlideDeckContent(null);
  }

  return (
    <div className="min-h-screen flex flex-col px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto w-full flex flex-col">
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, background: GRADIENTS.purpleSky }}>
            <Bot size={20} color={COLORS.white} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: COLORS.textDark }}>
              AI Study Assistant
            </h1>
            <p className="text-xs" style={{ color: COLORS.textLight }}>
              History, sources, chat, and study tools — all in one place
            </p>
          </div>
        </div>

        <div
          className={`grid grid-cols-1 rounded-2xl overflow-hidden ${historyCollapsed ? "lg:grid-cols-[56px_220px_1fr_280px]" : "lg:grid-cols-[224px_220px_1fr_280px]"}`}
          style={{ ...GLASS_CARD, height: "min(72vh, 680px)" }}
        >
          {/* ---------------- HISTORY (permanent, collapsible sidebar) ---------------- */}
          <div
            className="p-3 flex flex-col border-b lg:border-b-0 lg:border-r overflow-hidden"
            style={{ height: "100%", borderColor: COLORS.border, background: "rgba(255,255,255,0.35)" }}
          >
            <div className={`flex items-center gap-1.5 mb-2.5 ${historyCollapsed ? "flex-col" : ""}`}>
              <button
                type="button"
                onClick={handleNewChat}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold flex-1"
                style={{ padding: "10px", borderRadius: 12, color: COLORS.white, background: GRADIENTS.purplePink, cursor: "pointer" }}
              >
                <Plus size={13} />
                {!historyCollapsed && "New Chat"}
              </button>
              <button
                type="button"
                onClick={() => setHistoryCollapsed((v) => !v)}
                aria-label={historyCollapsed ? "Expand history" : "Collapse history"}
                className="flex items-center justify-center shrink-0"
                style={{ width: 28, height: 28, borderRadius: 9999, color: COLORS.textLight, background: COLORS.white, border: `1px solid ${COLORS.border}`, cursor: "pointer" }}
              >
                {historyCollapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
              </button>
            </div>

            {!historyCollapsed && (
              <div className="relative mb-3">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: COLORS.textLight }} />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search chats"
                  className="w-full text-[11px] pl-7 pr-2 py-2 rounded-lg outline-none"
                  style={{ border: `1px solid ${COLORS.border}`, background: COLORS.white, color: COLORS.textDark }}
                />
              </div>
            )}

            {!historyCollapsed && (
              <p className="text-[10px] font-bold uppercase tracking-wide mb-2 px-0.5" style={{ color: COLORS.textLight }}>
                Recent Chats
              </p>
            )}

            {!historyCollapsed && sessionsError && (
              <p className="text-[10px] mb-2" style={{ color: "#DC2626" }}>
                {sessionsError}
              </p>
            )}

            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-1">
              {historyCollapsed ? (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleOpenSession(s.id)}
                    title={s.title}
                    className="flex items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                    style={{ padding: "8px 0", background: s.id === activeSessionId ? COLORS.lavender : "transparent", color: COLORS.textDark, cursor: "pointer" }}
                  >
                    <MessageSquare size={13} />
                  </button>
                ))
              ) : filteredSessions.length === 0 ? (
                <p className="text-[10px] px-1" style={{ color: COLORS.textLight }}>
                  {sessions.length === 0 ? "Your past chats will appear here." : "No chats match your search."}
                </p>
              ) : (
                filteredSessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleOpenSession(s.id)}
                    className="flex items-center gap-2 text-left px-2 py-2 rounded-lg group transition-colors hover:bg-black/5"
                    style={{
                      background: s.id === activeSessionId ? COLORS.lavender : "transparent",
                      color: COLORS.textDark,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      className="flex items-center justify-center rounded-full shrink-0"
                      style={{ width: 24, height: 24, background: sessionColor(s.id) }}
                    >
                      <MessageSquare size={11} color="#fff" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium">{s.title}</span>
                      {typeof s.messageCount === "number" && (
                        <span className="block truncate text-[10px]" style={{ color: COLORS.textLight }}>
                          {s.messageCount} message{s.messageCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                    <span
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      style={{ color: COLORS.textLight }}
                      className="opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Trash2 size={11} />
                    </span>
                  </button>
                ))
              )}
            </div>

          </div>

          {/* ---------------- SOURCES ---------------- */}
          <div
            className="p-4 flex flex-col border-b lg:border-b-0 lg:border-r overflow-hidden"
            style={{ height: "100%", borderColor: COLORS.border }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold" style={{ color: COLORS.textDark }}>
                Sources
              </p>
              <label
                className="flex items-center gap-1 text-[11px] font-semibold shrink-0"
                style={{
                  padding: "5px 10px",
                  borderRadius: 9999,
                  color: COLORS.white,
                  background: GRADIENTS.purplePink,
                  cursor: uploading ? "default" : "pointer",
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                <Upload size={11} />
                {uploading ? "..." : "Add"}
                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" onChange={handleFileChosen} disabled={uploading} hidden />
              </label>
            </div>

            {sourceError && (
              <p className="text-[11px] mb-2" style={{ color: "#DC2626" }}>
                {sourceError}
              </p>
            )}

            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2">
              {sources.length === 0 ? (
                <p className="text-[11px]" style={{ color: COLORS.textLight }}>
                  No sources yet. Upload a PDF or notes file to power chat, Mind Map, Audio Overview, Slide Deck, and Flashcards.
                </p>
              ) : (
                sources.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-[11px] px-2.5 py-2 rounded-lg"
                    style={{ background: COLORS.white, border: `1px solid ${COLORS.border}` }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText size={11} color={COLORS.purple} className="shrink-0" />
                      <span className="truncate" style={{ color: COLORS.textDark }}>
                        {s.title}
                      </span>
                    </div>
                    <button type="button" onClick={() => handleDeleteSource(s.id)} style={{ color: COLORS.textLight, cursor: "pointer" }}>
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ---------------- CHAT ---------------- */}
          <div
            className="p-4 flex flex-col border-b lg:border-b-0 lg:border-r overflow-hidden"
            style={{ height: "100%", borderColor: COLORS.border }}
          >
            {messages.length === 0 && !loadingChat ? (
              <div className="flex items-start justify-between gap-3 mb-3 shrink-0">
                <div>
                  <p className="text-base font-bold" style={{ color: COLORS.textDark }}>
                    Hi{studentName ? ` ${studentName}` : ""}! 👋
                  </p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: COLORS.textDark }}>
                    How can I help with your studies today?
                  </p>
                  <p className="text-xs mt-1" style={{ color: COLORS.textLight }}>
                    I can explain concepts, solve problems, generate notes and more.
                  </p>
                </div>
                <ChatMascot />
              </div>
            ) : (
              <p className="text-xs font-semibold mb-3 shrink-0" style={{ color: COLORS.textDark }}>
                {activeSessionId ? sessions.find((s) => s.id === activeSessionId)?.title || "Chat" : "New Chat"}
              </p>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-3 px-1">
              {loadingChat ? (
                <p className="text-xs text-center m-auto" style={{ color: COLORS.textLight }}>
                  Loading...
                </p>
              ) : messages.length === 0 ? (
                <div className="m-auto text-center max-w-xs">
                  <Sparkles size={20} color={COLORS.purple} className="mx-auto mb-2" />
                  <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                    Ask me anything about your studies
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((m, i) => (
                    <ChatBubble key={m.ts ?? i} role={m.role} content={m.content} citedSources={m.citedSources} />
                  ))}
                </AnimatePresence>
              )}
              {sending && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 24, height: 24, background: GRADIENTS.purpleSky }}>
                    <Bot size={12} color={COLORS.white} />
                  </div>
                  <div className="flex gap-1 px-3 py-2.5 rounded-2xl" style={{ background: COLORS.white }}>
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
                        style={{ width: 5, height: 5, borderRadius: 9999, background: COLORS.textLight }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {chatError && (
              <p className="text-[11px] mt-2" style={{ color: "#DC2626" }}>
                {chatError}
              </p>
            )}

            {!sending && messages.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {activeSessionId && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleMindMapAction("chat")}
                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full"
                      style={{ color: COLORS.sky, background: COLORS.white, border: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                    >
                      <GitBranch size={11} /> Create a mind map
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateFlashcards("chat")}
                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full"
                      style={{ color: COLORS.sky, background: COLORS.white, border: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                    >
                      <Layers size={11} /> Flashcards
                    </button>
                  </>
                )}
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(s)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                    style={{ color: COLORS.sky, background: COLORS.lavender, border: `1px solid ${COLORS.border}` }}
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleRegenerate}
                  title="Regenerate"
                  aria-label="Regenerate"
                  className="flex items-center justify-center rounded-full shrink-0 ml-auto"
                  style={{ width: 24, height: 24, color: COLORS.textLight, background: COLORS.white, border: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="mt-3 shrink-0"
            >
              <div
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-full"
                style={{ border: `1px solid ${COLORS.border}`, background: COLORS.white }}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Attach a source"
                  aria-label="Attach a source"
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 32, height: 32, color: COLORS.textLight, cursor: uploading ? "default" : "pointer" }}
                >
                  <Upload size={15} />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  disabled={sending || loadingChat}
                  className="flex-1 text-sm px-1 py-1.5 outline-none bg-transparent"
                  style={{ color: COLORS.textDark }}
                />
                <button
                  type="submit"
                  disabled={sending || loadingChat || !input.trim()}
                  className="flex items-center justify-center rounded-full disabled:opacity-40 shrink-0"
                  style={{ width: 34, height: 34, background: GRADIENTS.purplePink, cursor: "pointer" }}
                >
                  <Send size={14} color={COLORS.white} />
                </button>
              </div>
              <p className="text-[10px] text-center mt-1.5" style={{ color: COLORS.textLight }}>
                LearnMatrix AI can make mistakes. Please verify important information.
              </p>
            </form>
          </div>

          {/* ---------------- STUDIO ---------------- */}
          <div className="p-4 flex flex-col gap-3 overflow-y-auto no-scrollbar" style={{ height: "100%" }}>
            <p className="text-xs font-semibold" style={{ color: COLORS.textDark }}>
              Studio
            </p>

            {studioError && (
              <p className="text-[11px]" style={{ color: "#DC2626" }}>
                {studioError}
              </p>
            )}

            {activeSessionId && studioArtifacts.length > 0 && (
              <div className="flex flex-col gap-1 pb-1" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {studioArtifacts.map((item) => (
                  <StudioArtifactRow key={item.id} item={item} onOpen={() => openStudioArtifact(item)} />
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <StudioActionGroup
                icon={PresentationIcon}
                label="Slide Deck"
                theme="amber"
                loading={pptLoading}
                onGenerate={handleDownloadPpt}
                extra={<FormatToggle value={pptFormat} onChange={setPptFormat} />}
                modes={[
                  { key: "sources", label: "Sources", disabled: sources.length === 0 },
                  { key: "chat", label: "Chat", disabled: !activeSessionId },
                  { key: "custom", label: "Type", disabled: false },
                ]}
              />
              <StudioActionGroup
                icon={Layers}
                label="Flashcards"
                theme="pink"
                onGenerate={handleGenerateFlashcards}
                modes={[
                  { key: "sources", label: "Sources", disabled: sources.length === 0 },
                  { key: "chat", label: "Chat", disabled: !activeSessionId },
                  { key: "custom", label: "Type", disabled: false },
                ]}
              />
              <StudioActionGroup
                icon={GitBranch}
                label="Mind Map"
                theme="blue"
                onGenerate={handleMindMapAction}
                modes={[
                  { key: "sources", label: "Sources", disabled: sources.length === 0 },
                  { key: "chat", label: "Chat", disabled: !activeSessionId },
                  { key: "custom", label: "Type", disabled: false },
                ]}
              />
              <StudioActionGroup
                icon={Volume2}
                label="Audio Overview"
                theme="purple"
                onGenerate={handleAudioAction}
                modes={[
                  { key: "sources", label: "Sources", disabled: sources.length === 0 },
                  { key: "chat", label: "Chat", disabled: !activeSessionId },
                  { key: "custom", label: "Type", disabled: false },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {studioModal && studioModal !== "audio" && (
          <StudioModal
            onClose={closeStudioModal}
            wide={(studioModal === "mindmap" || studioModal === "slidedeck-preview") && !studioLoading && !studioError}
            fullScreen={(studioModal === "mindmap" || studioModal === "slidedeck-preview") && !studioLoading && !studioError}
          >
            {studioModal === "custom-input" ? (
              <CustomInputBody
                target={customTarget}
                text={customText}
                onChange={setCustomText}
                onGenerate={handleGenerateFromCustomText}
                error={studioError}
                loading={customTarget === "slidedeck" ? pptLoading : studioLoading}
                pptFormat={pptFormat}
                onPptFormatChange={setPptFormat}
              />
            ) : studioLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={22} className="animate-spin" color={COLORS.purple} />
              </div>
            ) : studioError ? (
              <p className="text-sm text-center py-10" style={{ color: "#DC2626" }}>
                {studioError}
              </p>
            ) : studioModal === "flashcards" && flashSet ? (
              <FlashcardModalBody
                set={flashSet}
                index={flashIndex}
                flipped={flashFlipped}
                onFlip={() => setFlashFlipped((f) => !f)}
                onNext={() => {
                  setFlashFlipped(false);
                  setFlashIndex((i) => Math.min(i + 1, flashSet.cards.length - 1));
                }}
                onPrev={() => {
                  setFlashFlipped(false);
                  setFlashIndex((i) => Math.max(i - 1, 0));
                }}
              />
            ) : studioModal === "mindmap" && mindMapNotes ? (
              <MindMapView map={mindMapNotes} />
            ) : studioModal === "slidedeck-preview" && slideDeckContent ? (
              <SlideDeckPreview
                deck={slideDeckContent}
                format={pptFormat}
                onFormatChange={setPptFormat}
                downloading={pptLoading}
                onDownload={async () => {
                  setPptLoading(true);
                  setStudioError("");
                  try {
                    if (pptFormat === "pdf") await downloadDeckContentPdf(slideDeckContent);
                    else await downloadDeckContentPptx(slideDeckContent);
                  } catch (err) {
                    setStudioError(err.message || "Couldn't download the slide deck.");
                  } finally {
                    setPptLoading(false);
                  }
                }}
              />
            ) : null}
          </StudioModal>
        )}
      </AnimatePresence>

      {/* Audio Overview deliberately renders OUTSIDE the StudioModal system
       * as a bottom-docked player bar rather than a centered/full-screen
       * overlay — unlike Mind Map or Slide Deck, listening to an Audio
       * Overview is something a student naturally wants to do WHILE still
       * reading/using the chat behind it, so it shouldn't block the page
       * the way a dark backdrop modal does (see StudioModal's
       * `rgba(13,27,61,0.45)` backdrop above). */}
      <AnimatePresence>
        {studioModal === "audio" && (
          <AudioOverviewDock
            notes={audioNotes}
            loading={studioLoading}
            error={studioError}
            onClose={closeStudioModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Glassy color themes for the Studio cards — soft gradient fill,
 * a lighter glossy edge, and a saturated badge gradient behind the icon. */
const STUDIO_THEMES = {
  amber: {
    cardFrom: "#FFE9B8",
    cardTo: "#FCD98A",
    border: "rgba(184,134,11,0.28)",
    badgeFrom: "#FFD98A",
    badgeTo: "#E9A93B",
    iconColor: "#8A5A00",
    textColor: "#6B4A00",
  },
  pink: {
    cardFrom: "#FFD9E4",
    cardTo: "#FCB8CB",
    border: "rgba(194,43,84,0.26)",
    badgeFrom: "#FFC2D4",
    badgeTo: "#F17A9C",
    iconColor: "#8C0F3A",
    textColor: "#7A123B",
  },
  blue: {
    cardFrom: "#D3ECFC",
    cardTo: "#AEDCF8",
    border: "rgba(29,111,165,0.26)",
    badgeFrom: "#BFE2FA",
    badgeTo: "#5FA9DE",
    iconColor: "#0E4A73",
    textColor: "#0E4A73",
  },
  purple: {
    cardFrom: "#EBDFFB",
    cardTo: "#D6C0F3",
    border: "rgba(107,63,160,0.26)",
    badgeFrom: "#DFCBF8",
    badgeTo: "#A876E0",
    iconColor: "#502378",
    textColor: "#4A2270",
  },
};

/** StudioActionGroup — one full-width, glassy Studio card with a
 * gradient icon badge, and N small mode buttons revealed on expand
 * (e.g. Sources/Chat/Type). */
function StudioActionGroup({ icon: Icon, label, theme = "blue", onGenerate, loading, modes, extra }) {
  const [expanded, setExpanded] = useState(false);
  const t = STUDIO_THEMES[theme] || STUDIO_THEMES.blue;
  return (
    <div
      style={{
        borderRadius: 20,
        padding: 2,
        background: `linear-gradient(135deg, ${t.cardFrom}, ${t.cardTo})`,
        border: `1px solid ${t.border}`,
        boxShadow: "0 4px 14px rgba(20,20,40,0.06), inset 0 1px 0 rgba(255,255,255,0.7)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2.5 w-full text-left"
        style={{ cursor: "pointer", padding: "8px 12px 8px 8px" }}
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{
            width: 38,
            height: 38,
            background: `linear-gradient(150deg, ${t.badgeFrom}, ${t.badgeTo})`,
            boxShadow: "0 3px 8px rgba(20,20,40,0.14), inset 0 1px 2px rgba(255,255,255,0.85)",
          }}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" color={t.iconColor} />
          ) : (
            <Icon size={16} color={t.iconColor} strokeWidth={2.1} />
          )}
        </div>
        <p className="text-sm font-semibold flex-1 leading-tight" style={{ color: t.textColor }}>
          {label}
        </p>
        <ChevronDown
          size={16}
          color={t.textColor}
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s", opacity: 0.7 }}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0.5">
          {extra}
          <div className="flex gap-1.5 flex-wrap">
            {modes.map((m) => (
              <ModeChip key={m.key} label={m.label} disabled={m.disabled || loading} onClick={() => onGenerate(m.key)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const STUDIO_ARTIFACT_META = {
  mindmap: { icon: GitBranch, pastel: "#DCEEFB", iconColor: "#1D6FA5", label: "Mind Map" },
  slidedeck: { icon: PresentationIcon, pastel: "#FDECC8", iconColor: "#B8860B", label: "Slide Deck" },
  flashcards: { icon: Layers, pastel: "#FCE0EC", iconColor: "#C23B79", label: "Flashcards" },
  audio: { icon: Volume2, pastel: "#EAE1F9", iconColor: "#6D3FBF", label: "Audio Overview" },
};

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StudioArtifactRow({ item, onOpen }) {
  const meta = STUDIO_ARTIFACT_META[item.type] || STUDIO_ARTIFACT_META.mindmap;
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2.5 text-left rounded-lg px-2 py-2"
      style={{ cursor: "pointer" }}
    >
      <div
        className="flex items-center justify-center rounded-lg shrink-0"
        style={{ width: 32, height: 32, background: meta.pastel }}
      >
        <Icon size={14} color={meta.iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: COLORS.textDark }}>
          {item.title}
        </p>
        <p className="text-[10px]" style={{ color: COLORS.textLight }}>
          {meta.label} · {timeAgo(item.createdAt)}
        </p>
      </div>
      <MoreVertical size={14} color={COLORS.textLight} className="shrink-0" />
    </button>
  );
}

function FormatToggle({ value, onChange }) {
  return (
    <div className="flex gap-1.5 mb-2.5">
      {[
        { key: "pptx", label: "PPTX" },
        { key: "pdf", label: "PDF" },
      ].map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className="text-[10px] font-semibold rounded-full"
            style={{
              padding: "3px 10px",
              background: active ? GRADIENTS.purpleSky : COLORS.lavender,
              color: active ? COLORS.white : COLORS.textMid,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ModeChip({ label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-[10px] font-semibold flex-1 disabled:opacity-30 transition-colors hover:brightness-95"
      style={{
        padding: "7px 4px",
        borderRadius: 9999,
        color: COLORS.sky,
        background: COLORS.lavender,
        border: `1px solid rgba(212,160,23,0.25)`,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

function StudioModal({ children, onClose, wide, fullScreen }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 flex items-center justify-center z-50 ${fullScreen ? "" : "p-4"}`}
      style={{ background: "rgba(13,27,61,0.45)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full relative ${fullScreen ? "h-full rounded-none" : wide ? "rounded-2xl max-w-4xl p-4" : "rounded-2xl max-w-lg p-6"}`}
        style={{ background: COLORS.white, maxHeight: fullScreen ? "100vh" : "85vh", overflowY: wide || fullScreen ? "hidden" : "auto" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex items-center justify-center rounded-full"
          style={{ width: 30, height: 30, color: COLORS.white, background: "rgba(13,27,61,0.75)", cursor: "pointer" }}
        >
          <X size={16} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}

function CustomInputBody({ target, text, onChange, onGenerate, error, loading, pptFormat, onPptFormatChange }) {
  const titles = {
    mindmap: "Type a topic for your Mind Map",
    audio: "Type a topic for your Audio Overview",
    flashcards: "Type a topic for your Flashcards",
    slidedeck: "Type a topic for your Slide Deck",
  };
  return (
    <div>
      <p className="text-sm font-semibold mb-1 pr-6" style={{ color: COLORS.textDark }}>
        {titles[target] || "Type your topic"}
      </p>
      <p className="text-xs mb-4" style={{ color: COLORS.textLight }}>
        Paste notes, or just describe what you want covered.
      </p>
      {target === "slidedeck" && <FormatToggle value={pptFormat} onChange={onPptFormatChange} />}
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder="e.g. Explain how binary search works, with its time complexity..."
        disabled={loading}
        className="w-full text-sm p-3 rounded-xl outline-none resize-none"
        style={{ border: `1px solid ${COLORS.border}`, color: COLORS.textDark, background: COLORS.lavender }}
      />
      {error && (
        <p className="text-xs mt-2" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onGenerate}
        disabled={loading}
        className="flex items-center justify-center gap-2 text-sm font-semibold w-full mt-4 disabled:opacity-60"
        style={{ padding: "12px", borderRadius: 9999, color: COLORS.white, background: GRADIENTS.purplePink, cursor: loading ? "default" : "pointer" }}
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {loading ? "Generating..." : "Generate"}
      </button>
    </div>
  );
}

// Small hand-built waving robot for the chat greeting header — built from
// plain SVG shapes (no external image asset), same approach as
// RevisionMascot in components/profile/RevisionScheduleSection.jsx.
function ChatMascot() {
  return (
    <svg width="72" height="80" viewBox="0 0 72 80" className="shrink-0">
      <circle cx="36" cy="14" r="4" fill={COLORS.purple} />
      <line x1="36" y1="10" x2="36" y2="18" stroke={COLORS.purple} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="14" y="18" width="44" height="34" rx="14" fill={COLORS.sky} />
      <circle cx="27" cy="35" r="4" fill="#fff" />
      <circle cx="45" cy="35" r="4" fill={COLORS.purple} />
      <path d="M26 44 Q36 50 46 44" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="8" y="52" width="56" height="26" rx="13" fill={COLORS.purple} />
      <rect x="24" y="59" width="24" height="12" rx="5" fill="rgba(255,255,255,0.2)" />
      {/* waving arm */}
      <circle cx="66" cy="46" r="6" fill={COLORS.sky} />
      <line x1="62" y1="52" x2="66" y2="46" stroke={COLORS.sky} strokeWidth="4" strokeLinecap="round" />
      {/* still arm */}
      <circle cx="6" cy="64" r="6" fill={COLORS.sky} />
    </svg>
  );
}

// Very small, dependency-free markdown for assistant replies: turns
// **bold**, "- " bullet lines, and pipe-delimited tables (a header row +
// a |---|---| separator, the shape the Chat Agent's backend prompt asks
// for) into real elements instead of dumping literal "**"/"|" characters
// — everything else stays as plain text.
function renderAssistantContent(content) {
  const lines = content.split("\n");
  const blocks = [];
  let i = 0;

  function renderInline(text, key) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <span key={key}>
        {parts.map((part, idx) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={idx}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={idx}>{part}</span>
          )
        )}
      </span>
    );
  }

  while (i < lines.length) {
    const line = lines[i];
    const isTableRow = /^\s*\|.*\|\s*$/.test(line);
    const nextIsSeparator = i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*\|?\s*$/.test(lines[i + 1] || "");

    if (isTableRow && nextIsSeparator) {
      const header = line.split("|").map((c) => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""));
      const rows = [];
      let j = i + 2;
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
        rows.push(lines[j].split("|").map((c) => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === "")));
        j++;
      }
      blocks.push(
        <div key={i} className="overflow-x-auto my-1.5 rounded-lg" style={{ border: `1px solid ${COLORS.border}` }}>
          <table className="text-xs w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: COLORS.lavender }}>
                {header.map((h, ci) => (
                  <th key={ci} className="text-left px-2 py-1.5 font-semibold" style={{ color: COLORS.textDark, borderBottom: `1px solid ${COLORS.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2 py-1.5" style={{ color: COLORS.textMid, borderTop: `1px solid ${COLORS.border}` }}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = j;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const bulletLines = [];
      let j = i;
      while (j < lines.length && /^\s*[-*]\s+/.test(lines[j])) {
        bulletLines.push(lines[j].replace(/^\s*[-*]\s+/, ""));
        j++;
      }
      blocks.push(
        <ul key={i} className="list-disc pl-4 my-1 space-y-0.5">
          {bulletLines.map((b, bi) => (
            <li key={bi}>{renderInline(b, bi)}</li>
          ))}
        </ul>
      );
      i = j;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    blocks.push(<p key={i} className="whitespace-pre-wrap">{renderInline(line, i)}</p>);
    i++;
  }

  return blocks;
}

function ChatBubble({ role, content, citedSources }) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2"
      style={{ flexDirection: isUser ? "row-reverse" : "row" }}
    >
      <div
        className="flex items-center justify-center rounded-full shrink-0"
        style={{ width: 24, height: 24, background: isUser ? COLORS.lavender : COLORS.sky, border: isUser ? `1px solid ${COLORS.border}` : "none" }}
      >
        {isUser ? <UserIcon size={12} color={COLORS.sky} /> : <Bot size={12} color={COLORS.white} />}
      </div>
      <div style={{ maxWidth: "82%" }}>
        <div
          className="text-sm px-3.5 py-2.5"
          style={{
            color: isUser ? COLORS.white : COLORS.textDark,
            background: isUser ? COLORS.purple : COLORS.white,
            borderRadius: 18,
            borderBottomRightRadius: isUser ? 4 : 18,
            borderBottomLeftRadius: isUser ? 18 : 4,
          }}
        >
          {isUser ? <span className="whitespace-pre-wrap">{content}</span> : renderAssistantContent(content)}
        </div>
        {!isUser && citedSources?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {citedSources.map((title, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: COLORS.sky, background: COLORS.lavender }}>
                <FileText size={9} />
                {title}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function FlashcardModalBody({ set, index, flipped, onFlip, onNext, onPrev }) {
  const card = set.cards[index];
  const total = set.cards.length;
  const sourceCount = set.sourceCount ?? set.sources?.length ?? 0;

  // Local, in-session only: which cards were marked right/wrong, and
  // whether the "Explain" panel is open for the current card.
  const [grades, setGrades] = useState({}); // { [cardIndex]: "right" | "wrong" }
  const [showExplain, setShowExplain] = useState(false);

  const wrongCount = Object.values(grades).filter((g) => g === "wrong").length;
  const rightCount = Object.values(grades).filter((g) => g === "right").length;

  function grade(result) {
    setGrades((g) => ({ ...g, [index]: result }));
  }

  function goPrev() {
    setShowExplain(false);
    onPrev();
  }
  function goNext() {
    setShowExplain(false);
    onNext();
  }

  return (
    <div>
      {/* Header: title + share / expand / menu */}
      <div className="flex items-center justify-between mb-1 pr-6">
        <p className="text-base font-semibold" style={{ color: COLORS.textDark }}>
          AI Flashcards
        </p>
        <div className="flex items-center gap-3">
          <button type="button" style={{ cursor: "pointer" }} title="Share">
            <Share2 size={16} color={COLORS.textMid} />
          </button>
          <button type="button" style={{ cursor: "pointer" }} title="Expand">
            <Maximize2 size={15} color={COLORS.textMid} />
          </button>
          <button type="button" style={{ cursor: "pointer" }} title="More">
            <MoreVertical size={16} color={COLORS.textMid} />
          </button>
        </div>
      </div>

      {sourceCount > 0 && (
        <span
          className="inline-block text-xs font-medium mb-3 px-3 py-1 rounded-full"
          style={{ border: `1px solid ${COLORS.border}`, color: COLORS.textMid }}
        >
          View {sourceCount} source{sourceCount === 1 ? "" : "s"}
        </span>
      )}

      {/* Question/answer card — two distinct colors (navy for the
       * question, gold for the revealed answer) so it's visually obvious
       * at a glance which side you're looking at, rather than the same
       * dark card just swapping text. */}
      <div
        onClick={onFlip}
        className="rounded-3xl flex flex-col justify-between px-6 py-5"
        style={{
          background: flipped
            ? "linear-gradient(135deg, #E8B93D, #D4A017)"
            : "linear-gradient(135deg, #16234A, #0D1B3D)",
          minHeight: 220,
          cursor: "pointer",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: flipped ? "rgba(13,27,61,0.55)" : "rgba(255,255,255,0.45)" }}>
            {index + 1} / {total}
          </span>
          <MoreVertical size={16} color={flipped ? "rgba(13,27,61,0.55)" : "rgba(255,255,255,0.45)"} />
        </div>
        <p className="text-xl font-semibold leading-snug text-center px-2" style={{ color: flipped ? COLORS.textDark : COLORS.white }}>
          {flipped ? card.answer : card.question}
        </p>
        <p className="text-xs text-center font-medium" style={{ color: flipped ? "rgba(13,27,61,0.6)" : "rgba(255,255,255,0.45)" }}>
          {flipped ? "Tap to see question" : "See answer"}
        </p>
      </div>

      {/* Explain panel — only once the answer is showing. Given its own
       * lavender/gold-tinted card + left accent bar (rather than a plain
       * white bordered box) so it reads as a distinct "reason" callout,
       * not just more of the same card. */}
      {flipped && (
        <div className="mt-2.5">
          {showExplain ? (
            <div
              className="rounded-2xl pl-4 pr-5 py-4"
              style={{ background: COLORS.lavender, borderLeft: `4px solid ${COLORS.purple}` }}
            >
              <p className="text-sm leading-relaxed" style={{ color: COLORS.textDark }}>
                {card.explanation || card.answer}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowExplain(true);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ border: `1px solid ${COLORS.border}`, color: COLORS.textMid, cursor: "pointer" }}
            >
              <MessageSquare size={13} />
              Explain
            </button>
          )}
        </div>
      )}

      {/* Nav + right/wrong tally */}
      <div className="flex items-center justify-between mt-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          className="flex items-center justify-center rounded-full disabled:opacity-30 shrink-0"
          style={{ width: 34, height: 34, border: `1.5px solid ${COLORS.purple}`, cursor: index === 0 ? "default" : "pointer" }}
        >
          <ChevronLeft size={16} color={COLORS.purple} />
        </button>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => grade("wrong")}
            className="flex items-center gap-1 text-sm font-semibold"
            style={{ color: "#DC2626", cursor: "pointer" }}
          >
            <X size={16} /> {wrongCount}
          </button>
          <button
            type="button"
            onClick={() => grade("right")}
            className="flex items-center gap-1 text-sm font-semibold"
            style={{ color: "#16A34A", cursor: "pointer" }}
          >
            {rightCount} <Check size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={index === total - 1}
          className="flex items-center justify-center rounded-full disabled:opacity-30 shrink-0"
          style={{ width: 34, height: 34, border: `1.5px solid ${COLORS.purple}`, cursor: index === total - 1 ? "default" : "pointer" }}
        >
          <ChevronRight size={16} color={COLORS.purple} />
        </button>
      </div>
    </div>
  );
}

// ---------------- Mind Map: horizontal collapsible tree ----------------
// Layout constants (px). Node x = depth * (NODE_W + LEVEL_GAP).
const MM_NODE_W = 168;
const MM_NODE_H = 34;
const MM_ROW_GAP = 12;
const MM_LEVEL_GAP = 56;
const MM_ROOT_W = 148;
const MM_ROOT_H = 44;
const MM_PAD = 24;

// Normalizes legacy flat {branches:[{label,detail}]} responses into the
// nested {children:[{label,children:[]}]} shape the tree layout expects,
// so older saved/cached results still render.
function normalizeMindMapTree(map) {
  if (Array.isArray(map?.children)) return map;
  const branches = map?.branches || [];
  return {
    title: map?.title || "Mind Map",
    children: branches.map((b) => ({
      label: b.label,
      children: b.detail ? [{ label: b.detail, children: [] }] : [],
    })),
  };
}

// Recursively assigns {x, y, depth} to every node (post-order, so a
// parent's y is the vertical center of its (expanded) children), and
// collects the flat node list + parent->child link list for rendering.
function layoutMindMap(root, collapsed) {
  const nodes = [];
  const links = [];
  let cursorY = MM_PAD;
  let maxDepth = 0;

  function visit(node, depth, id) {
    maxDepth = Math.max(maxDepth, depth);
    const kids = node.children || [];
    const isOpen = kids.length > 0 && !collapsed.has(id);
    const h = depth === 0 ? MM_ROOT_H : MM_NODE_H;
    let y;

    if (!isOpen) {
      y = cursorY + h / 2;
      cursorY += h + MM_ROW_GAP;
    } else {
      const childYs = kids.map((child, i) => visit(child, depth + 1, `${id}-${i}`));
      y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    }

    const x = MM_PAD + depth * (MM_NODE_W + MM_LEVEL_GAP);
    nodes.push({ id, label: node.label, depth, x, y, w: depth === 0 ? MM_ROOT_W : MM_NODE_W, h, hasChildren: kids.length > 0, open: isOpen });
    if (isOpen) {
      kids.forEach((_, i) => {
        links.push({ from: id, to: `${id}-${i}`, parentDepth: depth });
      });
    }
    return y;
  }

  visit(root, 0, "r");
  const height = Math.max(cursorY, MM_ROOT_H + MM_PAD * 2);
  const width = MM_PAD * 2 + (maxDepth + 1) * MM_NODE_W + maxDepth * MM_LEVEL_GAP + (maxDepth > 0 ? 20 : 0);
  return { nodes, links, width, height };
}

// Walks the raw tree (ignoring any collapse state) assigning the same
// "r-0-1..." id scheme used by layoutMindMap, and returns the set of
// branch ids that should start collapsed — every node below the root
// that has children, so the map opens with just the root + its direct
// branches visible, and each deeper level only appears when the user
// clicks that node's toggle.
function collectDefaultCollapsed(node, depth, id, set) {
  const kids = node.children || [];
  if (depth >= 1 && kids.length > 0) set.add(id);
  kids.forEach((child, i) => collectDefaultCollapsed(child, depth + 1, `${id}-${i}`, set));
  return set;
}

function MindMapView({ map }) {
  const tree = normalizeMindMapTree(map);
  const [collapsed, setCollapsed] = useState(() => collectDefaultCollapsed(tree, 0, "r", new Set()));
  const [zoom, setZoom] = useState(1);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const svgRef = useRef(null);

  // A newly generated mind map re-uses this same modal/component — reset
  // to the collapsed starting view whenever a different map arrives.
  useEffect(() => {
    setCollapsed(collectDefaultCollapsed(tree, 0, "r", new Set()));
    setZoom(1);
  }, [map]);

  const { nodes, links, width, height } = layoutMindMap({ label: tree.title, children: tree.children }, collapsed);

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  function toggle(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function collapseAll() {
    setCollapsed(new Set(nodes.filter((n) => n.hasChildren).map((n) => n.id)));
  }
  function expandAll() {
    setCollapsed(new Set());
  }

  const NODE_COLORS = {
    root: { bg: COLORS.sky, text: COLORS.white },
    branch: { bg: COLORS.textMid, text: COLORS.white },
    leaf: { bg: COLORS.purple, text: COLORS.white },
  };

  function escapeXml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
  }

  // Builds a fully self-contained SVG (background + connector lines +
  // node rectangles + text) — the on-screen version splits nodes into
  // real HTML <div>s (for click-to-collapse), which a plain
  // XMLSerializer of the <svg> alone would NOT capture, so the export
  // has to redraw everything as SVG shapes from scratch.
  // Builds a self-contained SVG string from any layout result (either the
  // currently visible/collapsed nodes, or a fully-expanded layout) and
  // triggers the file download.
  function downloadLayoutAsSvg(layoutNodes, layoutLinks, layoutById, layoutWidth, layoutHeight, suffix) {
    const bg = "#151B2C";
    const linkMarkup = layoutLinks
      .map((link) => {
        const from = layoutById[link.from];
        const to = layoutById[link.to];
        if (!from || !to) return "";
        const x1 = from.x + from.w;
        const y1 = from.y;
        const x2 = to.x;
        const y2 = to.y;
        const midX = (x1 + x2) / 2;
        return `<path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" fill="none" stroke="rgba(232,185,61,0.5)" stroke-width="1.5" />`;
      })
      .join("\n");

    const nodeMarkup = layoutNodes
      .map((n) => {
        const palette = n.depth === 0 ? NODE_COLORS.root : n.hasChildren ? NODE_COLORS.branch : NODE_COLORS.leaf;
        const rx = n.x;
        const ry = n.y - n.h / 2;
        return `<g>
          <rect x="${rx}" y="${ry}" width="${n.w}" height="${n.h}" rx="8" fill="${palette.bg}" />
          <text x="${rx + n.w / 2}" y="${n.y}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="600" font-family="Arial, sans-serif" fill="${palette.text}">${escapeXml(n.label)}</text>
        </g>`;
      })
      .join("\n");

    const svgMarkup = `<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${layoutWidth}" height="${layoutHeight}" viewBox="0 0 ${layoutWidth} ${layoutHeight}">
  <rect x="0" y="0" width="${layoutWidth}" height="${layoutHeight}" fill="${bg}" />
  ${linkMarkup}
  ${nodeMarkup}
</svg>`;

    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(tree.title || "mindmap").replace(/\s+/g, "_")}${suffix}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Option 1: exactly what's on screen right now (respects collapsed branches).
  function handleDownloadCurrentView() {
    downloadLayoutAsSvg(nodes, links, byId, width, height, "_current_view");
    setShowDownloadMenu(false);
  }

  // Option 2: the whole tree, fully expanded, regardless of what's collapsed on screen.
  function handleDownloadFullMap() {
    const full = layoutMindMap({ label: tree.title, children: tree.children }, new Set());
    const fullById = Object.fromEntries(full.nodes.map((n) => [n.id, n]));
    downloadLayoutAsSvg(full.nodes, full.links, fullById, full.width, full.height, "_full");
    setShowDownloadMenu(false);
  }

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        <div>
          <p className="text-base font-semibold mb-1 pr-8" style={{ color: COLORS.textDark }}>
            Mind Map
          </p>
          <p className="text-xs" style={{ color: COLORS.textLight }}>
            {tree.title} · click a node's circle to expand that branch
          </p>
        </div>

        {/* zoom / view controls — a toolbar row, not overlaid on the canvas, so it never covers node content */}
        <div className="flex items-center gap-1 p-1 rounded-xl mr-8" style={{ background: COLORS.lavender }}>
          <button type="button" onClick={expandAll} title="Expand all" className="flex items-center justify-center rounded-lg" style={mmControlBtnStyleLight}>
            <ChevronsRight size={15} style={{ transform: "rotate(90deg)" }} />
          </button>
          <button type="button" onClick={collapseAll} title="Collapse all" className="flex items-center justify-center rounded-lg" style={mmControlBtnStyleLight}>
            <ChevronsLeft size={15} style={{ transform: "rotate(90deg)" }} />
          </button>
          <div style={{ width: 1, height: 18, background: COLORS.border, margin: "0 2px" }} />
          <button type="button" onClick={() => setZoom((z) => Math.min(z + 0.15, 2))} title="Zoom in" className="flex items-center justify-center rounded-lg" style={mmControlBtnStyleLight}>
            <Plus size={16} />
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))} title="Zoom out" className="flex items-center justify-center rounded-lg" style={mmControlBtnStyleLight}>
            <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 700 }}>–</span>
          </button>
          <div style={{ width: 1, height: 18, background: COLORS.border, margin: "0 2px" }} />
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDownloadMenu((v) => !v)}
              title="Download"
              className="flex items-center justify-center rounded-lg"
              style={mmControlBtnStyleLight}
            >
              <FileText size={15} />
            </button>
            {showDownloadMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDownloadMenu(false)} />
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-20"
                  style={{ background: COLORS.white, boxShadow: "0 8px 24px rgba(13,27,61,0.18)", border: `1px solid ${COLORS.border}`, minWidth: 190 }}
                >
                  <button
                    type="button"
                    onClick={handleDownloadCurrentView}
                    className="w-full text-left px-3 py-2.5 text-xs font-semibold"
                    style={{ color: COLORS.textDark, cursor: "pointer" }}
                  >
                    Current view
                    <span className="block text-[10px] font-normal mt-0.5" style={{ color: COLORS.textLight }}>
                      Only what's expanded now
                    </span>
                  </button>
                  <div style={{ height: 1, background: COLORS.border }} />
                  <button
                    type="button"
                    onClick={handleDownloadFullMap}
                    className="w-full text-left px-3 py-2.5 text-xs font-semibold"
                    style={{ color: COLORS.textDark, cursor: "pointer" }}
                  >
                    Full mind map
                    <span className="block text-[10px] font-normal mt-0.5" style={{ color: COLORS.textLight }}>
                      Every branch, fully expanded
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto" style={{ background: "#151B2C" }}>
        <div style={{ width: width * zoom, height: height * zoom, position: "relative" }}>
          <div style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "0 0", position: "absolute", top: 0, left: 0 }}>
            <svg ref={svgRef} width={width} height={height} className="absolute inset-0">
              {links.map((link, i) => {
                const from = byId[link.from];
                const to = byId[link.to];
                if (!from || !to) return null;
                const x1 = from.x + from.w;
                const y1 = from.y;
                const x2 = to.x;
                const y2 = to.y;
                const midX = (x1 + x2) / 2;
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="rgba(232,185,61,0.35)"
                    strokeWidth={1.5}
                  />
                );
              })}
            </svg>

            {nodes.map((n) => {
              const palette = n.depth === 0 ? NODE_COLORS.root : n.hasChildren ? NODE_COLORS.branch : NODE_COLORS.leaf;
              return (
                <div
                  key={n.id}
                  className="absolute flex items-center rounded-lg px-2.5 text-center"
                  style={{
                    left: n.x,
                    top: n.y - n.h / 2,
                    width: n.w,
                    height: n.h,
                    background: palette.bg,
                    boxShadow: "0 3px 10px rgba(0,0,0,0.35)",
                  }}
                >
                  <p className="text-[11px] font-semibold leading-tight w-full truncate" style={{ color: palette.text }} title={n.label}>
                    {n.label}
                  </p>
                  {n.hasChildren && (
                    <button
                      type="button"
                      onClick={() => toggle(n.id)}
                      className="absolute flex items-center justify-center rounded-full"
                      style={{
                        width: 16,
                        height: 16,
                        right: -8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "#151B2C",
                        border: `1.5px solid ${palette.bg}`,
                        color: COLORS.white,
                        cursor: "pointer",
                      }}
                    >
                      {n.open ? <ChevronLeft size={9} /> : <ChevronRight size={9} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Toolbar row sits on the (light) modal header, so controls need dark
// icons/text rather than white-on-dark styling.
// ---------------- Slide Deck: Gamma/NotebookLM-style in-app preview ----------------
// Flattens the AI-generated {title, summary, sections, keyTakeaways} deck into the
// same slide sequence services/ppt_service.py's build_deck_sections() produces on
// the backend, so the numbered thumbnails/preview here match the downloaded file
// slide-for-slide.
const SD_ACCENT_CYCLE = [COLORS.purple, COLORS.sky, COLORS.pink];

function buildSlidesFromDeck(deck) {
  const slides = [{ kind: "title", title: deck.title || "Study Summary", subtitle: "Study Summary" }];
  if (deck.summary) slides.push({ kind: "text", heading: "Summary", body: deck.summary });
  (deck.sections || []).forEach((s) => {
    const heading = s.heading || "Section";
    const layout = s.layout || "text";
    if (layout === "list" && Array.isArray(s.items) && s.items.length) {
      slides.push({ kind: "list", heading, items: s.items });
    } else if (layout === "process" && Array.isArray(s.steps) && s.steps.length) {
      slides.push({ kind: "process", heading, steps: s.steps });
    } else if (layout === "comparison" && s.left && s.right) {
      slides.push({ kind: "comparison", heading, left: s.left, right: s.right });
    } else if (s.content) {
      slides.push({ kind: "text", heading, body: s.content, image: s.image_url, subpoints: s.subpoints });
    }
  });
  if (deck.keyTakeaways?.length) slides.push({ kind: "bullets", heading: "Key Takeaways", items: deck.keyTakeaways });
  return slides;
}

// icon tag (see backend agents/slide_deck_agent.py's ICON_VOCAB) -> a real Lucide icon for
// the in-app preview — richer than the pptx/pdf builders can safely do with shapes/glyphs,
// since this only has to render in a browser, not survive round-tripping through PowerPoint.
const SD_ICON_MAP = {
  check: Check,
  star: Star,
  warning: AlertTriangle,
  gear: Settings,
  database: Database,
  network: Network,
  shield: Shield,
  zap: Zap,
  cloud: Cloud,
  book: BookOpen,
};

function SlideItemIcon({ icon, size = 13, color }) {
  const Icon = SD_ICON_MAP[icon] || Check;
  return <Icon size={size} color={color} />;
}

function SlideDeckPreview({ deck, format, onFormatChange, downloading, onDownload }) {
  const slides = buildSlidesFromDeck(deck);
  const [active, setActive] = useState(0);
  const current = slides[active];

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        <div>
          <p className="text-base font-semibold mb-1 pr-8" style={{ color: COLORS.textDark }}>
            Slide Deck
          </p>
          <p className="text-xs" style={{ color: COLORS.textLight }}>
            {deck.title} · {slides.length} slides
          </p>
        </div>

        <div className="flex items-center gap-2 mr-8">
          <FormatToggle value={format} onChange={onFormatChange} />
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs font-semibold rounded-full disabled:opacity-60"
            style={{ padding: "8px 16px", background: GRADIENTS.purplePink, color: COLORS.white, cursor: downloading ? "default" : "pointer" }}
          >
            {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {downloading ? "Preparing..." : `Download ${format.toUpperCase()}`}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* numbered thumbnail list */}
        <div className="flex flex-col gap-2 p-3 overflow-y-auto" style={{ width: 190, borderRight: `1px solid ${COLORS.border}`, background: COLORS.lavender }}>
          {slides.map((s, i) => {
            const isTitle = s.kind === "title";
            const accent = isTitle ? COLORS.sky : SD_ACCENT_CYCLE[(i - 1) % SD_ACCENT_CYCLE.length];
            const isActive = i === active;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className="text-left rounded-lg overflow-hidden shrink-0"
                style={{
                  outline: isActive ? `2px solid ${COLORS.purple}` : `1px solid ${COLORS.border}`,
                  outlineOffset: 1,
                  cursor: "pointer",
                }}
              >
                <div
                  className="flex flex-col justify-center px-2.5"
                  style={{ height: 68, background: isTitle ? COLORS.sky : COLORS.white }}
                >
                  <span className="text-[9px] font-bold mb-0.5" style={{ color: isTitle ? COLORS.pink : accent }}>
                    {i === 0 ? "TITLE" : String(i).padStart(2, "0")}
                  </span>
                  <span
                    className="text-[10px] font-semibold leading-tight line-clamp-2"
                    style={{ color: isTitle ? COLORS.white : COLORS.textDark }}
                  >
                    {isTitle ? s.title : s.heading}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* main slide canvas */}
        <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ background: "#F4F5F8" }}>
          <div className="w-full" style={{ maxWidth: 860, aspectRatio: "16 / 9" }}>
            <SlideCanvas slide={current} index={active} />
          </div>

          <div className="flex items-center gap-4 mt-4">
            <button
              type="button"
              onClick={() => setActive((i) => Math.max(0, i - 1))}
              disabled={active === 0}
              className="flex items-center justify-center rounded-full disabled:opacity-30"
              style={{ width: 32, height: 32, background: COLORS.white, border: `1px solid ${COLORS.border}`, cursor: active === 0 ? "default" : "pointer" }}
            >
              <ChevronLeft size={15} color={COLORS.textDark} />
            </button>
            <span className="text-xs font-semibold" style={{ color: COLORS.textMid }}>
              {active + 1} / {slides.length}
            </span>
            <button
              type="button"
              onClick={() => setActive((i) => Math.min(slides.length - 1, i + 1))}
              disabled={active === slides.length - 1}
              className="flex items-center justify-center rounded-full disabled:opacity-30"
              style={{ width: 32, height: 32, background: COLORS.white, border: `1px solid ${COLORS.border}`, cursor: active === slides.length - 1 ? "default" : "pointer" }}
            >
              <ChevronRight size={15} color={COLORS.textDark} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** SlideCanvas — renders one slide at full preview size, styled to match
 * the actual downloaded pptx/pdf design (see services/ppt_service.py /
 * services/pdf_service.py): navy title slide with decorative gold
 * circles, or a white content slide with a colored left accent bar,
 * numbered badge, heading rule, and body text or bullet markers. */
function SlideCanvas({ slide, index }) {
  if (slide.kind === "title") {
    return (
      <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ background: COLORS.sky }}>
        <div
          className="absolute rounded-full"
          style={{ width: "55%", aspectRatio: "1/1", right: "-15%", top: "-35%", background: COLORS.purple, opacity: 0.75 }}
        />
        <div
          className="absolute rounded-full"
          style={{ width: "26%", aspectRatio: "1/1", right: "4%", bottom: "-12%", background: COLORS.pink, opacity: 0.5 }}
        />
        <div className="relative h-full flex flex-col justify-center px-[6%]">
          <div className="mb-3" style={{ width: 40, height: 3, background: COLORS.purple }} />
          <p className="text-[11px] font-bold tracking-wide mb-2" style={{ color: COLORS.pink }}>
            LEARNMATRIX
          </p>
          <p className="text-2xl font-bold leading-tight mb-3" style={{ color: COLORS.white, maxWidth: "70%" }}>
            {slide.title}
          </p>
          <p className="text-sm" style={{ color: COLORS.lavender }}>
            {slide.subtitle}
          </p>
        </div>
      </div>
    );
  }

  const accent = SD_ACCENT_CYCLE[(index - 1) % SD_ACCENT_CYCLE.length];
  const badgeText = accent === COLORS.pink ? COLORS.sky : COLORS.white;

  if (slide.kind === "comparison") {
    const panels = [
      { data: slide.left, bg: COLORS.sky, text: COLORS.white },
      { data: slide.right, bg: COLORS.purple, text: COLORS.white },
    ];
    return (
      <div className="relative w-full h-full rounded-xl overflow-hidden flex flex-col" style={{ background: COLORS.white, border: `1px solid ${COLORS.border}` }}>
        <div className="px-[6%] pt-[5%] pb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 34, height: 34, background: COLORS.purple, color: COLORS.white }}>
              <span className="text-sm font-bold">{index}</span>
            </div>
            <p className="text-lg font-bold" style={{ color: COLORS.textDark }}>
              {slide.heading}
            </p>
          </div>
        </div>
        <div className="flex-1 flex gap-3 px-[6%] pb-[5%] min-h-0">
          {panels.map((p, pi) => (
            <div key={pi} className="flex-1 rounded-lg p-3 overflow-hidden" style={{ background: p.bg }}>
              <p className="text-xs font-bold text-center mb-2" style={{ color: p.text }}>
                {p.data?.label}
              </p>
              <div className="flex flex-col gap-1.5">
                {(p.data?.items || []).map((item, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <div className="rounded-full shrink-0 mt-1" style={{ width: 5, height: 5, background: p.text }} />
                    <p className="text-[11px] leading-snug" style={{ color: p.text }}>
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden flex" style={{ background: COLORS.white, border: `1px solid ${COLORS.border}` }}>
      <div style={{ width: 10, background: accent }} />
      <div className="flex-1 px-[6%] py-[5%] overflow-hidden">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 34, height: 34, background: accent, color: badgeText }}
          >
            <span className="text-sm font-bold">{index}</span>
          </div>
          <p className="text-lg font-bold" style={{ color: COLORS.textDark }}>
            {slide.heading}
          </p>
        </div>
        <div style={{ width: 44, height: 3, background: accent, marginLeft: 46, marginBottom: 16 }} />

        <div style={{ marginLeft: 46 }}>
          {slide.kind === "bullets" ? (
            <div className="flex flex-col gap-2.5">
              {slide.items.map((item, i) => {
                const text = typeof item === "object" ? item.text : item;
                const icon = typeof item === "object" ? item.icon : "check";
                return (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: COLORS.lavender }}>
                    <div
                      className="flex items-center justify-center rounded-full shrink-0"
                      style={{ width: 20, height: 20, background: accent, color: badgeText }}
                    >
                      <SlideItemIcon icon={icon} size={11} color={badgeText} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: COLORS.textDark }}>
                      {text}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : slide.kind === "list" ? (
            <div className="grid grid-cols-2 gap-2.5">
              {slide.items.map((item, i) => {
                const text = typeof item === "object" ? item.text : item;
                const icon = typeof item === "object" ? item.icon : "check";
                return (
                  <div key={i} className="rounded-lg px-3 py-2.5 flex items-start gap-2" style={{ background: COLORS.lavender, border: `1px solid ${accent}55` }}>
                    <div
                      className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
                      style={{ width: 18, height: 18, background: accent, color: badgeText }}
                    >
                      <SlideItemIcon icon={icon} size={10} color={badgeText} />
                    </div>
                    <p className="text-xs font-semibold leading-snug" style={{ color: COLORS.textDark }}>
                      {text}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : slide.kind === "process" ? (
            <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
              {slide.steps.map((step, i) => {
                const text = typeof step === "object" ? step.text : step;
                return (
                  <div key={i} className="flex items-center gap-1.5 shrink-0">
                    <div
                      className="rounded-lg px-3 py-3 flex flex-col items-center text-center gap-1.5"
                      style={{ background: accent, width: 108 }}
                    >
                      <div
                        className="flex items-center justify-center rounded-full shrink-0"
                        style={{ width: 22, height: 22, background: COLORS.white, border: `1.5px solid ${COLORS.textDark}` }}
                      >
                        <span className="text-[11px] font-bold" style={{ color: COLORS.textDark }}>
                          {i + 1}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold leading-tight" style={{ color: badgeText }}>
                        {text}
                      </p>
                    </div>
                    {i < slide.steps.length - 1 && <ChevronRight size={16} color={COLORS.textLight} className="shrink-0" />}
                  </div>
                );
              })}
            </div>
          ) : slide.image ? (
            <div className="flex gap-4">
              <p className="text-sm leading-relaxed flex-1" style={{ color: COLORS.textMid }}>
                {slide.body}
              </p>
              <div className="shrink-0 flex flex-col gap-2" style={{ width: 130 }}>
                <div className="rounded-lg p-1" style={{ width: 130, height: 130, background: accent }}>
                  <img src={slide.image} alt="" className="w-full h-full object-cover rounded-md" />
                </div>
                {slide.subpoints?.length ? <SlideKeyPoints subpoints={slide.subpoints} accent={accent} /> : null}
              </div>
            </div>
          ) : slide.subpoints?.length ? (
            <div className="flex gap-4">
              <p className="text-sm leading-relaxed flex-1" style={{ color: COLORS.textMid }}>
                {slide.body}
              </p>
              <div className="shrink-0" style={{ width: 130 }}>
                <SlideKeyPoints subpoints={slide.subpoints} accent={accent} />
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: COLORS.textMid }}>
              {slide.body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** SlideKeyPoints — the in-app preview's counterpart to
 * services/ppt_service.py's _add_key_points_panel / services/pdf_service.py's
 * _draw_key_points_panel: a compact "Key Points" list of short highlight
 * bullets (see backend agents/slide_deck_agent.py's "subpoints") stacked
 * in the text slide's sidebar, below the image when one is present. */
function SlideKeyPoints({ subpoints, accent }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[9px] font-bold tracking-wide" style={{ color: accent }}>
        KEY POINTS
      </p>
      {subpoints.slice(0, 5).map((sp, i) => {
        const text = typeof sp === "object" ? sp.text : sp;
        if (!text) return null;
        return (
          <div key={i} className="flex items-start gap-1.5">
            <div className="rounded-full shrink-0 mt-1" style={{ width: 5, height: 5, background: accent }} />
            <p className="text-[10px] leading-snug" style={{ color: COLORS.textMid }}>
              {text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

const mmControlBtnStyleLight = {
  width: 30,
  height: 30,
  background: "transparent",
  color: COLORS.textDark,
  border: "none",
  cursor: "pointer",
};

const AUDIO_RATE_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2];

function buildAudioScript(notes) {
  const parts = [`Here's your overview on ${notes.title}.`, notes.summary];
  for (const section of notes.sections || []) parts.push(`${section.heading}. ${section.content}`);
  if (notes.keyTakeaways?.length) parts.push("Key takeaways: " + notes.keyTakeaways.join(". "));
  return parts.filter(Boolean).join(" ");
}

function estimateAudioSeconds(wordCount) {
  return Math.max(20, Math.round((wordCount / 150) * 60));
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/** AudioOverviewDock — bottom-docked, non-blocking NotebookLM-style player
 * bar for Audio Overview (see the render call above for why this is
 * intentionally NOT run through StudioModal's dark-backdrop overlay).
 * Fixed to the bottom of the viewport with no backdrop, so the chat
 * underneath stays fully visible and interactive while audio plays —
 * closer to a podcast-app mini-player than a dialog.
 *
 * Fully self-contained: owns its own play/pause/seek/rate/transcript
 * state and talks to window.speechSynthesis directly, since none of
 * that needs to live in the parent screen. The Web Speech API has no
 * real seek/scrub or "current position" concept, so skip/seek here work
 * by re-speaking from an estimated word offset (elapsed/duration ×
 * word count) — smooth and good enough for a study aid, not
 * frame-accurate the way a real audio file's <audio> element would be. */
function AudioOverviewDock({ notes, loading, error, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [liked, setLiked] = useState(null); // null | "up" | "down"
  const [showTranscript, setShowTranscript] = useState(false);

  const words = useMemo(() => (notes ? buildAudioScript(notes).split(/\s+/).filter(Boolean) : []), [notes]);
  const duration = useMemo(() => estimateAudioSeconds(words.length), [words]);

  const timerRef = useRef(null);
  const skipCancelRef = useRef(false); // true while we intentionally cancel() mid-utterance, so onend ignores it

  useEffect(() => {
    // Reset the player whenever a different Audio Overview is opened.
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setElapsed(0);
    setShowTranscript(false);
    return () => {
      window.speechSynthesis?.cancel();
      clearInterval(timerRef.current);
    };
  }, [notes]);

  useEffect(() => {
    if (!isPlaying) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsed((e) => Math.min(duration, e + 0.25 * rate));
    }, 250);
    return () => clearInterval(timerRef.current);
  }, [isPlaying, rate, duration]);

  function speakFromWord(wordIndex, speed) {
    if (!window.speechSynthesis) return;
    skipCancelRef.current = true;
    window.speechSynthesis.cancel();
    const text = words.slice(wordIndex).join(" ");
    if (!text) {
      setIsPlaying(false);
      setIsPaused(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speed;
    utterance.onend = () => {
      if (skipCancelRef.current) {
        skipCancelRef.current = false;
        return;
      }
      setIsPlaying(false);
      setIsPaused(false);
      setElapsed(duration);
    };
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  }

  function handlePlayPause() {
    if (!notes || !window.speechSynthesis) return;
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
      return;
    }
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
      return;
    }
    speakFromWord(Math.round((elapsed / duration) * words.length) || 0, rate);
  }

  function seekTo(newElapsed) {
    const clamped = Math.max(0, Math.min(duration, newElapsed));
    setElapsed(clamped);
    const wordIndex = Math.min(words.length - 1, Math.round((clamped / duration) * words.length));
    speakFromWord(wordIndex, rate);
  }

  function handleSkip(deltaSeconds) {
    if (!notes) return;
    seekTo(elapsed + deltaSeconds);
  }

  function handleRateChange() {
    const idx = AUDIO_RATE_OPTIONS.indexOf(rate);
    const next = AUDIO_RATE_OPTIONS[(idx + 1) % AUDIO_RATE_OPTIONS.length];
    setRate(next);
    if (isPlaying) {
      const wordIndex = Math.min(words.length - 1, Math.round((elapsed / duration) * words.length));
      speakFromWord(wordIndex, next);
    }
  }

  const sectionCount = notes?.sections?.length || 0;
  const script = notes ? buildAudioScript(notes) : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className="fixed bottom-5 left-1/2 z-40 w-full px-4"
      style={{ transform: "translateX(-50%)", maxWidth: 420 }}
    >
      <div
        className="relative rounded-2xl px-4 py-3.5"
        style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, boxShadow: "0 12px 32px rgba(13,27,61,0.18)" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={20} className="animate-spin" color={COLORS.purple} />
          </div>
        ) : error ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="absolute -top-2.5 -right-2.5 flex items-center justify-center rounded-full"
              style={{ width: 26, height: 26, color: COLORS.white, background: "rgba(13,27,61,0.75)", cursor: "pointer" }}
            >
              <X size={13} />
            </button>
            <p className="text-xs text-center py-4" style={{ color: "#DC2626" }}>
              {error}
            </p>
          </>
        ) : notes ? (
          <>
            {/* Top row: title, thumbs, menu, close */}
            <div className="flex items-center gap-2 mb-2.5">
              <p className="text-xs font-semibold truncate flex-1" style={{ color: COLORS.textDark }}>
                {notes.title}
              </p>
              <button
                type="button"
                onClick={() => setLiked((v) => (v === "up" ? null : "up"))}
                style={{ cursor: "pointer", color: liked === "up" ? COLORS.purple : COLORS.textLight }}
                title="Good overview"
              >
                <ThumbsUp size={14} fill={liked === "up" ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                onClick={() => setLiked((v) => (v === "down" ? null : "down"))}
                style={{ cursor: "pointer", color: liked === "down" ? "#DC2626" : COLORS.textLight }}
                title="Not helpful"
              >
                <ThumbsDown size={14} fill={liked === "down" ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                style={{ cursor: "pointer", color: showTranscript ? COLORS.purple : COLORS.textLight }}
                title="Transcript"
              >
                <History size={15} />
              </button>
              <button type="button" style={{ cursor: "pointer", color: COLORS.textLight }} title="More">
                <MoreVertical size={15} />
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{ cursor: "pointer", color: COLORS.textLight }}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrub bar */}
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={elapsed}
              onChange={(e) => setElapsed(parseFloat(e.target.value))}
              onMouseUp={(e) => seekTo(parseFloat(e.target.value))}
              onTouchEnd={(e) => seekTo(parseFloat(e.target.value))}
              className="w-full"
              style={{ accentColor: COLORS.purple, cursor: "pointer" }}
            />
            <div className="flex items-center justify-between -mt-1 mb-2">
              <span className="text-[11px]" style={{ color: COLORS.textLight }}>
                {formatTime(elapsed)} / {formatTime(duration)}
              </span>
              <span className="text-[11px]" style={{ color: COLORS.textLight }}>
                Deep Dive{sectionCount > 0 ? ` · ${sectionCount} section${sectionCount === 1 ? "" : "s"}` : ""}
              </span>
            </div>

            {/* Transport row: speed, -10s, play/pause, +10s, transcript toggle */}
            <div className="flex items-center justify-between mt-1">
              <button
                type="button"
                onClick={handleRateChange}
                className="text-xs font-semibold"
                style={{ color: COLORS.purple, cursor: "pointer", minWidth: 34, textAlign: "left" }}
                title="Playback speed"
              >
                {rate}x
              </button>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleSkip(-10)}
                  className="relative flex items-center justify-center"
                  style={{ color: COLORS.purple, cursor: "pointer" }}
                  title="Back 10 seconds"
                >
                  <RotateCcw size={26} />
                  <span className="absolute text-[9px] font-bold" style={{ color: COLORS.purple }}>
                    10
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 42, height: 42, background: GRADIENTS.purplePink, color: COLORS.white, cursor: "pointer" }}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => handleSkip(10)}
                  className="relative flex items-center justify-center"
                  style={{ color: COLORS.purple, cursor: "pointer" }}
                  title="Forward 10 seconds"
                >
                  <RotateCw size={26} />
                  <span className="absolute text-[9px] font-bold" style={{ color: COLORS.purple }}>
                    10
                  </span>
                </button>
              </div>

              <div style={{ minWidth: 34 }} />
            </div>

            {showTranscript && (
              <div
                className="mt-3 rounded-xl px-3 py-2.5 overflow-y-auto text-xs leading-relaxed"
                style={{ maxHeight: 160, background: COLORS.lavender, color: COLORS.textMid }}
              >
                {script}
              </div>
            )}
          </>
        ) : null}
      </div>
    </motion.div>
  );
}
