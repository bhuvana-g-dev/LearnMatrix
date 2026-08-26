import apiClient from "../api/axiosClient";
import { ENDPOINTS } from "../api/endpoints";

// LLM script-writing + TTS rendering, back-to-back — give it real room
// (same reasoning as MINDMAP_TIMEOUT_MS, extended since this is two AI
// calls chained rather than one). Kept comfortably above the backend's
// own TTS timeout (utils/gemini_client.py's _gemini_tts_http_options,
// 100s) so a slow-but-succeeding render isn't cut off client-side first.
const AUDIO_OVERVIEW_TIMEOUT_MS = 150000;
const AUDIO_SYNTHESIZE_TIMEOUT_MS = 120000;

/**
 * generateAudioOverview — the real (server-rendered) NotebookLM-style
 * Audio Overview: turns raw text into a two-host podcast SCRIPT
 * (backend's AudioOverviewAgent) and then into one actual playable WAV
 * file (Gemini multi-speaker TTS) — not the old browser-only
 * window.speechSynthesis single-voice readout.
 *
 * Passing uid/sessionId (generated from inside an open chat) also
 * saves the SCRIPT (not the audio — see backend module docstring) as a
 * studio artifact for that session, same as Mind Map/Slide Deck.
 *
 * @param {string} text - raw combined text (sources, chat transcript, or a typed topic)
 * @param {string} [label] - what the text represents
 * @param {string} [uid]
 * @param {string} [sessionId]
 * @returns {Promise<{title: string, script: {speaker: string, line: string}[], audioDataUri: string, durationSeconds: number}>}
 */
export async function generateAudioOverview(text, label, uid, sessionId) {
  const { data } = await apiClient.post(
    ENDPOINTS.AUDIO_OVERVIEW.GENERATE,
    { text, label, uid, sessionId },
    { timeout: AUDIO_OVERVIEW_TIMEOUT_MS }
  );
  if (!data.success) throw new Error(data.error || data.message || "Couldn't generate the Audio Overview.");
  return data.data;
}

/**
 * synthesizeAudioForScript — re-renders audio for an ALREADY-WRITTEN
 * script (used when reopening a saved Audio Overview from Studio
 * history, which only stored {title, script} — see
 * services/studioService.js's getStudioArtifact). Costs one TTS call,
 * no script-writing LLM call.
 * @param {{speaker: string, line: string}[]} script
 * @returns {Promise<string>} audioDataUri
 */
export async function synthesizeAudioForScript(script) {
  const { data } = await apiClient.post(
    ENDPOINTS.AUDIO_OVERVIEW.SYNTHESIZE,
    { script },
    { timeout: AUDIO_SYNTHESIZE_TIMEOUT_MS }
  );
  if (!data.success) throw new Error(data.error || data.message || "Couldn't generate the podcast audio.");
  return data.data.audioDataUri;
}
