"""
agents/audio_overview_agent.py

Audio Overview Agent — NotebookLM-style "two hosts discussing your
material" podcast script generator. Same BaseAgent + generate_json() +
retry pattern as every other agent (see agents/mindmap_agent.py).

WHY A SCRIPT AGENT SEPARATE FROM THE TTS CALL: turning raw source text
into an actual back-and-forth CONVERSATION (one host explaining, the
other asking follow-ups, reacting, summarizing) is a text-generation
problem — an LLM does this well. Turning that script into audio is a
completely different concern (utils/gemini_client.py's
generate_speech_audio, a speech model, not a text model). Keeping them
as two separate steps means either can fail/retry/be swapped
independently, same separation-of-concerns reasoning as every other
two-stage agent+service pair in this codebase.

This REPLACES the old client-side approach (AIStudyAssistantScreen.jsx's
buildAudioScript()), which just concatenated notes into one flat
paragraph for a single browser voice to read verbatim — no actual
conversation, no second voice, nothing "podcast" about it beyond the
name.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from utils.gemini_client import generate_json, GeminiClientError

REQUIRED_FIELDS = ["title", "script"]
HOST_A = "Host A"
HOST_B = "Host B"
MIN_TURNS = 8
MAX_TURNS = 26


class AudioOverviewAgentError(AgentError):
    pass


class AudioOverviewAgent(BaseAgent):
    name = "AudioOverviewAgent"

    def run(self, text: str, label: str = "this material") -> dict:
        if not text or not text.strip():
            raise AudioOverviewAgentError("text must be non-empty.")

        prompt = self._build_prompt(text, label)

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(prompt, temperature=0.7)
                self._validate(raw)
                return raw
            except (GeminiClientError, AudioOverviewAgentError) as exc:
                last_error = exc
                if attempt != settings.AI_GENERATION_MAX_RETRIES:
                    time.sleep(2)
                continue

        raise AudioOverviewAgentError(
            f"Audio Overview script generation failed after "
            f"{settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    def _build_prompt(self, text: str, label: str) -> str:
        # Truncated defensively, same reasoning/limit as mindmap_agent.py
        # — a long source dump doesn't need to be sent in full for two
        # hosts to have a well-grounded conversation about it.
        trimmed = text[:12000]

        return f"""You are writing the script for a short, engaging
two-host educational podcast episode that gives a listener an "audio
overview" of {label}, in the style of Google NotebookLM's Audio
Overview feature.

--- MATERIAL START ---
{trimmed}
--- MATERIAL END ---

Write a natural, energetic CONVERSATION between two hosts, "{HOST_A}"
and "{HOST_B}" — not a lecture read by one voice. Requirements:
- {HOST_A} generally leads/explains; {HOST_B} asks genuine follow-up
  questions, reacts, adds a relatable example or analogy, and
  occasionally challenges or double-checks a point — like two curious
  people actually discussing the material, not reciting facts at each
  other.
- Open with a short, casual hook (what this material is about and why
  it's worth knowing), cover the 3-5 most important ideas with real
  back-and-forth, and close with a brief recap of the key takeaway(s).
- Keep every line conversational and spoken-out-loud natural — short
  sentences, contractions, no bullet points, no markdown, no stage
  directions, no headings. Alternate speakers frequently (don't let
  one host monologue for more than 2-3 sentences at a time).
- {MIN_TURNS}-{MAX_TURNS} total lines, each line 1-3 sentences.
- Do not invent facts that aren't supported by the material above.

Respond with ONLY a JSON object, no prose, no markdown fences, in this
exact shape:
{{
  "title": "<short, catchy episode title, 3-8 words>",
  "script": [
    {{"speaker": "{HOST_A}", "line": "<what they say>"}},
    {{"speaker": "{HOST_B}", "line": "<what they say>"}}
  ]
}}"""

    def _validate(self, raw: dict) -> None:
        if not isinstance(raw, dict):
            raise AudioOverviewAgentError("Model response was not a JSON object.")
        missing = [f for f in REQUIRED_FIELDS if f not in raw]
        if missing:
            raise AudioOverviewAgentError(f"Response missing required field(s): {missing}")
        script = raw["script"]
        if not isinstance(script, list) or len(script) < 4:
            raise AudioOverviewAgentError("'script' must be a list of at least 4 turns.")
        speakers = set()
        for i, turn in enumerate(script):
            if not isinstance(turn, dict) or "speaker" not in turn or "line" not in turn:
                raise AudioOverviewAgentError(f"Turn {i + 1} missing 'speaker' or 'line'.")
            if not str(turn["line"]).strip():
                raise AudioOverviewAgentError(f"Turn {i + 1} has an empty 'line'.")
            speakers.add(turn["speaker"])
        if len(speakers) > 2:
            raise AudioOverviewAgentError(f"'script' must use at most 2 distinct speakers, got {len(speakers)}.")
