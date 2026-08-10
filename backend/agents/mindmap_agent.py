"""
agents/mindmap_agent.py

Turns any block of text — combined source content, a chat transcript,
or a student-typed topic — into a proper NESTED mind map: one root
title plus a tree of child nodes, up to 3 levels deep (main branches ->
sub-branches -> leaf details), matching a real mind-mapping tool's
output instead of a flat one-ring diagram.

Same BaseAgent contract + generate_json() + retry pattern as every
other agent.
"""

import time

from agents.base_agent import BaseAgent, AgentError
from config.settings import settings
from utils.gemini_client import generate_json, GeminiClientError

REQUIRED_FIELDS = ["title", "children"]
MIN_BRANCHES = 3
MAX_BRANCHES = 8
MAX_DEPTH = 3  # root (0) -> branch (1) -> sub-branch (2) -> leaf (3)


class MindMapAgentError(AgentError):
    pass


class MindMapAgent(BaseAgent):
    name = "MindMapAgent"

    def run(self, text: str, label: str = "this material") -> dict:
        if not text or not text.strip():
            raise MindMapAgentError("text must be non-empty.")

        prompt = self._build_prompt(text, label)

        last_error: Exception | None = None
        for attempt in range(settings.AI_GENERATION_MAX_RETRIES + 1):
            try:
                raw = generate_json(prompt, temperature=0.5)
                self._validate(raw)
                return raw
            except (GeminiClientError, MindMapAgentError) as exc:
                last_error = exc
                if attempt != settings.AI_GENERATION_MAX_RETRIES:
                    time.sleep(2)
                continue

        raise MindMapAgentError(
            f"Mind map generation failed after {settings.AI_GENERATION_MAX_RETRIES + 1} attempt(s): {last_error}"
        )

    def _build_prompt(self, text: str, label: str) -> str:
        # Truncated defensively — a long source dump or chat transcript
        # doesn't need to be sent in full to extract the structure.
        trimmed = text[:12000]

        return f"""You are building a mind map from {label} for a
computer science student, in the style of a proper mind-mapping tool
(like XMind or MindMeister) — a TREE, not a flat list.

--- MATERIAL START ---
{trimmed}
--- MATERIAL END ---

Identify the CORE topic (this becomes the root). Break it into 3-6 main
branches (key concepts/categories). For EACH main branch, add 2-5
sub-branches that break that concept down further. Where it genuinely
helps (e.g. a sub-branch that is itself a short list — steps, examples,
properties), give that sub-branch 2-4 leaf children too — but don't
force a third level everywhere; only add it where the material actually
has that much depth.

Every node (branch, sub-branch, leaf) needs a short label (2-6 words,
like a diagram node — no full sentences). Do not restate the parent's
label or the root title in a child.

Respond with ONLY a JSON object, no prose, no markdown fences, in this
exact recursive shape:
{{
  "title": "<short overall topic title, 2-6 words>",
  "children": [
    {{
      "label": "<main branch label>",
      "children": [
        {{
          "label": "<sub-branch label>",
          "children": [
            {{"label": "<leaf label>", "children": []}}
          ]
        }}
      ]
    }}
  ]
}}

"children" is always an array (use [] for a leaf with no further
breakdown). Keep the tree to at most 3 levels deep below the root."""

    def _validate(self, raw: dict) -> None:
        if not isinstance(raw, dict):
            raise MindMapAgentError("Model response was not a JSON object.")
        missing = [f for f in REQUIRED_FIELDS if f not in raw]
        if missing:
            raise MindMapAgentError(f"Response missing required field(s): {missing}")
        children = raw["children"]
        if not isinstance(children, list) or not (MIN_BRANCHES <= len(children) <= MAX_BRANCHES + 2):
            raise MindMapAgentError(f"'children' must be a list of roughly {MIN_BRANCHES}-{MAX_BRANCHES} items.")
        self._validate_children(children, depth=1)

    def _validate_children(self, children, depth: int) -> None:
        if depth > MAX_DEPTH:
            return
        for i, node in enumerate(children):
            if not isinstance(node, dict) or "label" not in node:
                raise MindMapAgentError(f"Node at depth {depth}, index {i} is missing 'label'.")
            sub = node.get("children", [])
            if sub is None:
                sub = []
                node["children"] = sub
            if not isinstance(sub, list):
                raise MindMapAgentError(f"Node at depth {depth}, index {i} has non-list 'children'.")
            self._validate_children(sub, depth=depth + 1)
