"""Domain errors raised by the agent layer.

These errors surface configuration / availability problems to the API and
ultimately to the user-facing UI rather than being silently swallowed by a
hardcoded fallback path. The agent is intentionally LLM-dependent — when the
LLM can't be reached or isn't configured, the user sees the reason instead of
getting a degraded response.
"""

from __future__ import annotations


class AgentError(RuntimeError):
    """Base class for any failure in the agent layer that should be visible."""


class ConfigurationError(AgentError):
    """The runtime is missing the configuration the agent needs (e.g., the
    OPENAI_API_KEY isn't set, or an inconsistent demo / production mix).

    Surfaced as HTTP 503 with the message text so the user sees what's
    missing.
    """


class LLMUnavailableError(AgentError):
    """The LLM call failed for a reason we can't recover from cleanly: API
    error, malformed JSON, or schema validation failure.

    Surfaced as HTTP 503. The original cause is chained via __cause__.
    """


__all__ = [
    "AgentError",
    "ConfigurationError",
    "LLMUnavailableError",
]
