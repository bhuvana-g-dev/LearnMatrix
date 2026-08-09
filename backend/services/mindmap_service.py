"""
services/mindmap_service.py

Stateless — no Firestore involved (unlike Flashcards/PPT, a mind map
isn't saved). Routes call this directly with whatever text the
frontend has already assembled (source content, a chat transcript, or
a student-typed topic).
"""

from agents.mindmap_agent import MindMapAgent, MindMapAgentError

MindMapServiceError = MindMapAgentError


def generate_mindmap(text: str, label: str = "this material") -> dict:
    agent = MindMapAgent()
    return agent.run(text=text, label=label)
