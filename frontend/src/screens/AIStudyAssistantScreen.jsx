import { useEffect, useRef, useState } from "react";
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
  downloadCustomTextPptx,
} from "../services/pptService";
import { generateMindMap } from "../services/mindmapService";
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
export default function AIStudyAssistantScreen({ uid }) {
  // --- history sidebar ---
  const [historyCollapsed, setHistoryCollapsed] = useState(false);

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

  const [flashSet, setFlashSet] = useState(null);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);

  const [mindMapNotes, setMindMapNotes] = useState(null);
  const [audioNotes, setAudioNotes] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

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
        await downloadChatSummaryPptx(uid, activeSessionId);
      } else {
        await downloadSourcesSummaryPptx(uid);
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
      return generateMindMap(text, label);
    }, setMindMapNotes);
  }

  function handleAudioAction(mode) {
    if (mode === "custom") {
      setCustomTarget("audio");
      setCustomText("");
      setStudioError("");
      setStudioModal("custom-input");
      return;
    }
    runStudioBuild("audio", () => buildAudioNotesForMode(mode), setAudioNotes);
  }

  async function runStudioBuild(modalKey, buildFn, setNotes) {
    setStudioError("");
    setStudioLoading(true);
    setStudioModal(modalKey);
    try {
      setNotes(await buildFn());
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
        setMindMapNotes(await generateMindMap(text, "the student's own notes"));
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
      setPptLoading(true);
      try {
        await downloadCustomTextPptx(text);
        setStudioModal(null);
      } catch (err) {
        setStudioError(err.message || "Couldn't generate the slide deck.");
      } finally {
        setPptLoading(false);
      }
    }
  }

  function closeStudioModal() {
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setStudioModal(null);
    setStudioError("");
  }

  function buildAudioScript(notes) {
    const parts = [`Here's your overview on ${notes.title}.`, notes.summary];
    for (const section of notes.sections || []) parts.push(`${section.heading}. ${section.content}`);
    if (notes.keyTakeaways?.length) parts.push("Key takeaways: " + notes.keyTakeaways.join(". "));
    return parts.filter(Boolean).join(" ");
  }

  function handlePlayAudio() {
    if (!audioNotes || !window.speechSynthesis) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(buildAudioScript(audioNotes));
    utterance.rate = 0.98;
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  }

  function handlePauseAudio() {
    window.speechSynthesis?.pause();
    setIsPaused(true);
    setIsPlaying(false);
  }

  function handleStopAudio() {
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }

  return (
    <div className="px-4 sm:px-6 py-8 pb-20">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-5">
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
          className={`grid grid-cols-1 rounded-2xl overflow-hidden ${historyCollapsed ? "lg:grid-cols-[56px_220px_1fr_280px]" : "lg:grid-cols-[190px_220px_1fr_280px]"}`}
          style={{ ...GLASS_CARD }}
        >
          {/* ---------------- HISTORY (permanent, collapsible sidebar) ---------------- */}
          <div
            className="p-3 flex flex-col border-b lg:border-b-0 lg:border-r"
            style={{ height: 600, borderColor: COLORS.border }}
          >
            <div className={`flex items-center gap-1.5 mb-3 ${historyCollapsed ? "flex-col" : ""}`}>
              <button
                type="button"
                onClick={handleNewChat}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold flex-1"
                style={{ padding: "9px", borderRadius: 12, color: COLORS.white, background: GRADIENTS.purplePink, cursor: "pointer" }}
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

            {!historyCollapsed && sessionsError && (
              <p className="text-[10px] mb-2" style={{ color: "#DC2626" }}>
                {sessionsError}
              </p>
            )}

            <div className="flex-1 overflow-y-auto flex flex-col gap-1">
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
              ) : sessions.length === 0 ? (
                <p className="text-[10px] px-1" style={{ color: COLORS.textLight }}>
                  Your past chats will appear here.
                </p>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleOpenSession(s.id)}
                    className="flex items-center justify-between text-left text-[11px] px-2 py-2 rounded-lg group transition-colors hover:bg-black/5"
                    style={{
                      background: s.id === activeSessionId ? COLORS.lavender : "transparent",
                      color: COLORS.textDark,
                      cursor: "pointer",
                    }}
                  >
                    <span className="truncate flex-1 flex items-center gap-1.5">
                      <MessageSquare size={11} className="shrink-0" />
                      {s.title}
                    </span>
                    <span
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      style={{ color: COLORS.textLight }}
                      className="opacity-0 group-hover:opacity-100 shrink-0 ml-1"
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
            className="p-4 flex flex-col border-b lg:border-b-0 lg:border-r"
            style={{ height: 600, borderColor: COLORS.border }}
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

            <div className="flex-1 overflow-y-auto flex flex-col gap-2">
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
            className="p-4 flex flex-col border-b lg:border-b-0 lg:border-r"
            style={{ height: 600, borderColor: COLORS.border }}
          >
            <p className="text-xs font-semibold mb-3" style={{ color: COLORS.textDark }}>
              {activeSessionId ? sessions.find((s) => s.id === activeSessionId)?.title || "Chat" : "New Chat"}
            </p>

            <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-3 px-1">
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

            {suggestions.length > 0 && !sending && (
              <div className="flex flex-wrap gap-1.5 mt-2">
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
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 mt-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={sending || loadingChat}
                className="flex-1 text-sm px-3.5 py-2.5 rounded-full outline-none"
                style={{ border: `1px solid ${COLORS.border}`, color: COLORS.textDark, background: COLORS.white }}
              />
              <button
                type="submit"
                disabled={sending || loadingChat || !input.trim()}
                className="flex items-center justify-center rounded-full disabled:opacity-40 shrink-0"
                style={{ width: 38, height: 38, background: GRADIENTS.purplePink, cursor: "pointer" }}
              >
                <Send size={15} color={COLORS.white} />
              </button>
            </form>
          </div>

          {/* ---------------- STUDIO ---------------- */}
          <div className="p-4 flex flex-col gap-3" style={{ height: 600, overflowY: "auto" }}>
            <p className="text-xs font-semibold" style={{ color: COLORS.textDark }}>
              Studio
            </p>

            {studioError && (
              <p className="text-[11px]" style={{ color: "#DC2626" }}>
                {studioError}
              </p>
            )}

            <StudioActionGroup
              icon={PresentationIcon}
              label="Slide Deck"
              loading={pptLoading}
              onGenerate={handleDownloadPpt}
              modes={[
                { key: "sources", label: "Sources", disabled: sources.length === 0 },
                { key: "chat", label: "Chat", disabled: !activeSessionId },
                { key: "custom", label: "Type", disabled: false },
              ]}
            />
            <StudioActionGroup
              icon={Layers}
              label="Flashcards"
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

      <AnimatePresence>
        {studioModal && (
          <StudioModal onClose={closeStudioModal} wide={studioModal === "mindmap" && !studioLoading && !studioError}>
            {studioModal === "custom-input" ? (
              <CustomInputBody
                target={customTarget}
                text={customText}
                onChange={setCustomText}
                onGenerate={handleGenerateFromCustomText}
                error={studioError}
                loading={customTarget === "slidedeck" ? pptLoading : studioLoading}
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
            ) : studioModal === "audio" && audioNotes ? (
              <AudioOverviewBody
                notes={audioNotes}
                isPlaying={isPlaying}
                isPaused={isPaused}
                onPlay={handlePlayAudio}
                onPause={handlePauseAudio}
                onStop={handleStopAudio}
              />
            ) : null}
          </StudioModal>
        )}
      </AnimatePresence>
    </div>
  );
}

/** StudioActionGroup — one Studio card with N small mode buttons
 * (e.g. Topic/Chat/Sources for Slide Deck & Flashcards, or
 * Sources/Chat/Type for Mind Map & Audio Overview). */
function StudioActionGroup({ icon: Icon, label, onGenerate, loading, modes }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 16,
        background: COLORS.white,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 2px 10px rgba(13,27,61,0.06)",
      }}
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className="flex items-center justify-center rounded-xl shrink-0"
          style={{ width: 30, height: 30, background: GRADIENTS.purpleSky, boxShadow: "0 3px 8px rgba(13,27,61,0.15)" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" color={COLORS.white} /> : <Icon size={14} color={COLORS.white} />}
        </div>
        <p className="text-xs font-semibold" style={{ color: COLORS.textDark }}>
          {label}
        </p>
      </div>
      <div className="flex gap-1.5">
        {modes.map((m) => (
          <ModeChip key={m.key} label={m.label} disabled={m.disabled || loading} onClick={() => onGenerate(m.key)} />
        ))}
      </div>
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

function StudioModal({ children, onClose, wide }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: "rgba(13,27,61,0.45)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-2xl w-full relative ${wide ? "max-w-4xl p-4" : "max-w-lg p-6"}`}
        style={{ background: COLORS.white, maxHeight: "85vh", overflowY: wide ? "hidden" : "auto" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex items-center justify-center rounded-full"
          style={{ width: 26, height: 26, color: COLORS.white, background: "rgba(13,27,61,0.6)", cursor: "pointer" }}
        >
          <X size={15} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}

function CustomInputBody({ target, text, onChange, onGenerate, error, loading }) {
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
        style={{ width: 24, height: 24, background: isUser ? COLORS.lavender : GRADIENTS.purpleSky, border: isUser ? `1px solid ${COLORS.border}` : "none" }}
      >
        {isUser ? <UserIcon size={12} color={COLORS.sky} /> : <Bot size={12} color={COLORS.white} />}
      </div>
      <div style={{ maxWidth: "82%" }}>
        <div
          className="text-sm px-3.5 py-2.5 rounded-2xl whitespace-pre-wrap"
          style={{ color: isUser ? COLORS.white : COLORS.textDark, background: isUser ? GRADIENTS.purpleSky : COLORS.white }}
        >
          {content}
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
  return (
    <div>
      <p className="text-sm font-semibold mb-3 pr-6" style={{ color: COLORS.textDark }}>
        {set.title}
      </p>
      <div onClick={onFlip} className="rounded-2xl flex items-center justify-center text-center px-6" style={{ background: COLORS.lavender, minHeight: 200, cursor: "pointer" }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.textLight }}>
            {flipped ? "Answer" : "Question"} · Tap to flip
          </p>
          <p className="text-sm font-medium" style={{ color: COLORS.textDark }}>
            {flipped ? card.answer : card.question}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4">
        <button type="button" onClick={onPrev} disabled={index === 0} className="flex items-center gap-1 text-xs font-semibold disabled:opacity-30" style={{ color: COLORS.textDark, cursor: index === 0 ? "default" : "pointer" }}>
          <ChevronLeft size={14} />
          Prev
        </button>
        <span className="text-xs" style={{ color: COLORS.textLight }}>
          {index + 1} / {set.cards.length}
        </span>
        <button type="button" onClick={onNext} disabled={index === set.cards.length - 1} className="flex items-center gap-1 text-xs font-semibold disabled:opacity-30" style={{ color: COLORS.textDark, cursor: index === set.cards.length - 1 ? "default" : "pointer" }}>
          Next
          <ChevronRight size={14} />
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

function MindMapView({ map }) {
  const tree = normalizeMindMapTree(map);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef(null);

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

  function handleDownload() {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([`<?xml version="1.0" standalone="no"?>\r\n${source}`], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(tree.title || "mindmap").replace(/\s+/g, "_")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const NODE_COLORS = {
    root: { bg: COLORS.sky, text: COLORS.white },
    branch: { bg: COLORS.textMid, text: COLORS.white },
    leaf: { bg: COLORS.purple, text: COLORS.white },
  };

  return (
    <div>
      <p className="text-sm font-semibold mb-1 pr-6" style={{ color: COLORS.textDark }}>
        Mind Map
      </p>
      <p className="text-xs mb-3" style={{ color: COLORS.textLight }}>
        {tree.title} · tap a node's circle to expand or collapse
      </p>

      <div
        className="relative rounded-xl overflow-auto"
        style={{ height: 460, background: "#151B2C" }}
      >
        {/* zoom / view controls */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
          <button type="button" onClick={expandAll} title="Expand all" className="flex items-center justify-center rounded-full" style={mmControlBtnStyle}>
            <ChevronsRight size={13} style={{ transform: "rotate(90deg)" }} />
          </button>
          <button type="button" onClick={collapseAll} title="Collapse all" className="flex items-center justify-center rounded-full" style={mmControlBtnStyle}>
            <ChevronsLeft size={13} style={{ transform: "rotate(90deg)" }} />
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.min(z + 0.15, 2))} title="Zoom in" className="flex items-center justify-center rounded-full" style={mmControlBtnStyle}>
            <Plus size={13} />
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))} title="Zoom out" className="flex items-center justify-center rounded-full" style={mmControlBtnStyle}>
            <span style={{ fontSize: 15, lineHeight: 1, fontWeight: 700 }}>–</span>
          </button>
          <button type="button" onClick={handleDownload} title="Download as SVG" className="flex items-center justify-center rounded-full" style={mmControlBtnStyle}>
            <FileText size={12} />
          </button>
        </div>

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

const mmControlBtnStyle = {
  width: 26,
  height: 26,
  background: "rgba(255,255,255,0.1)",
  color: COLORS.white,
  border: "1px solid rgba(255,255,255,0.15)",
  cursor: "pointer",
};

function AudioOverviewBody({ notes, isPlaying, isPaused, onPlay, onPause, onStop }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-1 pr-6" style={{ color: COLORS.textDark }}>
        Audio Overview
      </p>
      <p className="text-xs mb-6" style={{ color: COLORS.textLight }}>
        {notes.title}
      </p>

      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          type="button"
          onClick={isPlaying ? onPause : onPlay}
          className="flex items-center justify-center rounded-full"
          style={{ width: 56, height: 56, background: GRADIENTS.purplePink, color: COLORS.white, cursor: "pointer" }}
        >
          {isPlaying ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!isPlaying && !isPaused}
          className="flex items-center justify-center rounded-full disabled:opacity-30"
          style={{ width: 44, height: 44, background: COLORS.lavender, color: COLORS.sky, cursor: "pointer" }}
        >
          <Square size={16} />
        </button>
      </div>

      <p className="text-xs text-center" style={{ color: COLORS.textLight }}>
        {isPlaying ? "Playing..." : isPaused ? "Paused" : "Tap play to listen to a summary of this content."}
      </p>
    </div>
  );
}
