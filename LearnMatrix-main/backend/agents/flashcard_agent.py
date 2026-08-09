"""
agents/flashcard_agent.py

Generates study flashcards (question/answer pairs) from ONE of two
source types — same "mode" idea as chat_agent's grounded-vs-ungrounded
split:
  - "topic": from an already-generated learning_notes entry
  - "chat":  from a saved AI Chat conversation

Same BaseAgent contract + generate_json() + retry pattern as every
other agent in this folder.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from utils.gemini_client import generate_json, GeminiClientError

REQUIRED_FIELDS = ["flashcards"]


class FlashcardAgentError(AgentError):
    pass


class FlashcardAgent(BaseAgent):
    name = "FlashcardAgent"

    def run(self, source_text: str, source_label: str, count: int = 10) -> dict:
        if not source_text or not source_text.strip():
            raise FlashcardAgentError("source_text must be non-empty.")

        prompt = self._build_prompt(source_text, source_label, count)

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(prompt, temperature=0.5)
                self._validate(raw)
                return raw
            except (GeminiClientError, FlashcardAgentError) as exc:
                last_error = exc
                if attempt != settings.AI_GENERATION_MAX_RETRIES:
                    time.sleep(2)
                continue

        raise FlashcardAgentError(
            f"Flashcard generation failed after {settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    def _build_prompt(self, source_text: str, source_label: str, count: int) -> str:
        # source_text is truncated defensively — a long chat transcript or
        # a big notes dump doesn't need to be sent in full for a good
        # flashcard set; the model only needs enough to write ~count cards.
        trimmed = source_text[:12000]

        return f"""You are generating study flashcards for a computer
science student, based on the following material ({source_label}):

--- MATERIAL START ---
{trimmed}
--- MATERIAL END ---

Create {count} flashcards that test understanding of the KEY concepts
in this material — not trivial or overly narrow details. Each
flashcard is one question and one concise answer.

Respond with ONLY a JSON object, no prose, no markdown fences, in this
exact shape:
{{
  "flashcards": [
    {{"question": "<question text>", "answer": "<answer text>"}},
    ...
  ]
}}"""

    def _validate(self, raw: dict) -> None:
        if not isinstance(raw, dict):
            raise FlashcardAgentError("Model response was not a JSON object.")
        missing = [f for f in REQUIRED_FIELDS if f not in raw]
        if missing:
            raise FlashcardAgentError(f"Response missing required field(s): {missing}")
        cards = raw["flashcards"]
        if not isinstance(cards, list) or not cards:
            raise FlashcardAgentError("'flashcards' must be a non-empty list.")
        for i, card in enumerate(cards):
            if not isinstance(card, dict) or "question" not in card or "answer" not in card:
                raise FlashcardAgentError(f"Flashcard at index {i} is missing 'question' or 'answer'.")