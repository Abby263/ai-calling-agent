"""Prompt registry.

Every LLM system prompt and canonical phone-call template string lives in this
package so the agent layer never embeds prose inline. Re-export the strings
each agent needs at the top level so callers do a single import.
"""

from app.prompts.conversation import (
    CALL_CLOSING_LINE,
    CALL_FAILURE_LINE,
    DISCLOSURE_LINE_GENERIC,
    OPENING_SYSTEM_PROMPT,
    RESPOND_SYSTEM_PROMPT,
    disclosure_line,
)
from app.prompts.request_parser import REQUEST_PARSER_SYSTEM_PROMPT
from app.prompts.summary import SUMMARY_SYSTEM_PROMPT
from app.prompts.transcript_extraction import TRANSCRIPT_EXTRACTION_SYSTEM_PROMPT

__all__ = [
    "CALL_CLOSING_LINE",
    "CALL_FAILURE_LINE",
    "DISCLOSURE_LINE_GENERIC",
    "OPENING_SYSTEM_PROMPT",
    "REQUEST_PARSER_SYSTEM_PROMPT",
    "RESPOND_SYSTEM_PROMPT",
    "SUMMARY_SYSTEM_PROMPT",
    "TRANSCRIPT_EXTRACTION_SYSTEM_PROMPT",
    "disclosure_line",
]
