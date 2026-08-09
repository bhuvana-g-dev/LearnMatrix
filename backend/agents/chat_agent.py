"""
agents/chat_agent.py

Chat Agent — powers the "AI Study Assistant > AI Chat" screen. Same
design pattern as every other agent in this folder (BaseAgent contract,
generate_json() for the actual model call, a required-field validation
pass before returning) — the only real difference is the input shape:
a running conversation instead of a single (skill, topic, focusBand)
tuple.

Still asks for JSON back (not free-form text) so this reuses
utils/gemini_client.generate_json() unchanged — no new "text mode"
needed in that module. The JSON envelope is just {"reply": "..."} plus
an optional "suggestions" list of quick follow-up prompts, which the
frontend can render as tappable chips.

History is passed in already-trimmed (services/ai_chat_service.py slices
it to settings.AI_CHAT_MAX_HISTORY_MESSAGES before calling this) — this
agent has no opinion on how much context is "enough", same separation
as focus_band guidance living in the caller for notes generation.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from utils.gemini_client import generate_json, GeminiClientError

REQUIRED_FIELDS = ["reply"]

SYSTEM_FRAME = """You are the AI Study Assistant inside LearnMatrix, an
adaptive learning platform for computer science students preparing for
tech roles (e.g. Frontend Developer, Backend Developer, Data Analyst).

Be encouraging but concise and concrete — this is a study helper, not a
generic chatbot. Prefer short explanations, worked examples, and
analogies over long lectures. If the student asks something completely
unrelated to learning/CS/career prep, answer briefly and gently steer
back to how you can help them study."""

GROUNDED_INSTRUCTIONS = """The student has uploaded/linked study sources
below. Answer using ONLY the information in these sources whenever the
question is about their content — do not use outside knowledge to fill
gaps. If the sources don't contain the answer, say so plainly instead
of guessing, and suggest the student ask a general question instead or
upload a source that covers it. When you do use a source, mention which
one by its title so the student knows where the answer came from."""


class ChatAgentError(AgentError):
    pass


class ChatAgent(BaseAgent):
    name = "ChatAgent"

    def run(
        self,
        message: str,
        history: list[dict],
        context: dict | None = None,
        sources: list[dict] | None = None,
    ) -> dict:
        if not message or not message.strip():
            raise ChatAgentError("message must be a non-empty string.")

        prompt = self._build_prompt(message, history, context or {}, sources or [])

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(prompt, temperature=0.6, gemini_api_key=settings.GEMINI_API_KEY_CHAT)
                self._validate(raw)
                return raw
            except (GeminiClientError, ChatAgentError) as exc:
                last_error = exc
                is_last_attempt = attempt == settings.AI_GENERATION_MAX_RETRIES
                if not is_last_attempt:
                    time.sleep(2)
                continue

        raise ChatAgentError(
            f"Chat reply generation failed after "
            f"{settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    def _build_prompt(
        self, message: str, history: list[dict], context: dict, sources: list[dict]
    ) -> str:
        transcript = ""
        if history:
            lines = []
            for turn in history:
                role = "Student" if turn.get("role") == "user" else "Assistant"
                lines.append(f"{role}: {turn.get('content', '')}")
            transcript = "\n\nConversation so far:\n" + "\n".join(lines)

        context_line = ""
        skill = context.get("skill")
        topic = context.get("topic")
        if skill or topic:
            where = " / ".join(p for p in [skill, topic] if p)
            context_line = f"\n\nThe student is currently studying: {where}."

        sources_block = ""
        if sources:
            excerpts = []
            for s in sources:
                excerpts.append(f'[Source: "{s["sourceTitle"]}"]\n{s["text"]}')
            sources_block = (
                "\n\n"
                + GROUNDED_INSTRUCTIONS
                + "\n\n--- Retrieved source excerpts ---\n"
                + "\n\n".join(excerpts)
                + "\n--- End of source excerpts ---"
            )

        return f"""{SYSTEM_FRAME}
{context_line}
{sources_block}
{transcript}

New message from the student: "{message}"

Respond with ONLY a JSON object, no prose, no markdown fences, in this
exact shape:
{{
  "reply": "<your response to the student, plain text, no markdown>",
  "suggestions": ["<short optional follow-up question the student could tap>", "..."],
  "citedSources": ["<title of each source you actually used, if any>"]
}}

"suggestions" should have 0-3 items — omit it (empty list) if there's no
obvious natural follow-up. "citedSources" should be an empty list if no
source excerpts were provided above or none were actually used."""

    def _validate(self, raw: dict) -> None:
        if not isinstance(raw, dict):
            raise ChatAgentError("Model response was not a JSON object.")
        missing = [f for f in REQUIRED_FIELDS if f not in raw]
        if missing:
            raise ChatAgentError(f"Response missing required field(s): {missing}")
        if not isinstance(raw["reply"], str) or not raw["reply"].strip():
            raise ChatAgentError("'reply' must be a non-empty string.")
        if "suggestions" in raw and not isinstance(raw["suggestions"], list):
            raise ChatAgentError("'suggestions' must be a list when present.")