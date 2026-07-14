"""
agents/base_agent.py

Every agent in the AI Agent architecture (Assessment Planner, Question
Generation, Quality Validation, Assessment Builder, Evaluation, Learning
Recommendation, Practice Test, Progress Analysis, Roadmap) implements this
same contract:

    agent = SomeAgent()
    result = agent.run(**inputs)

Keeping this contract tiny and uniform is what makes "each agent
independently reusable" (per the architecture doc) actually true in code —
any orchestrating service can call any agent the same way, and a new agent
only has to implement run().

This is intentionally NOT a framework (no registry, no message bus). For a
final-year project scope, direct Python calls between services are the
right amount of infrastructure — a message bus would be solving a scaling
problem this project doesn't have yet. See ARCHITECTURE.md "Why not
LangChain/CrewAI for agent orchestration" for the fuller reasoning.
"""

from abc import ABC, abstractmethod


class AgentError(Exception):
    """Base class for agent-specific errors. Agents may subclass this."""


class BaseAgent(ABC):
    name: str = "BaseAgent"

    @abstractmethod
    def run(self, *args, **kwargs):
        """Execute the agent's single responsibility and return its output."""
        raise NotImplementedError
