"""RequestParserAgent — LLM-only.

Turns a free-text user request into a structured ParsedIntent. The agent owns
no domain knowledge of its own: every interpretation of the user's wording
(what to ask, what task kind, what objective) comes from the LLM. There is
no regex / keyword fallback — when the LLM can't be reached we raise so the
UI can surface the reason instead of producing a low-quality scripted output.

The two utilities that remain are pure data plumbing:
  * E.164-normalised phone number extraction (deterministic, not inference)
  * Pydantic deserialisation of the LLM JSON response into ParsedIntent
"""

from __future__ import annotations

import json
import re
from typing import Any
from uuid import uuid4

from app.core.config import Settings
from app.prompts import REQUEST_PARSER_SYSTEM_PROMPT
from app.schemas import ParsedIntent, Question, TaskPreviewRequest
from app.services.errors import ConfigurationError, LLMUnavailableError


class RequestParserAgent:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def parse(self, payload: TaskPreviewRequest) -> ParsedIntent:
        if not self.settings.openai_enabled:
            raise ConfigurationError(
                "Request parsing requires OpenAI. Set OPENAI_API_KEY (and run with "
                "DEMO_MODE=false) so the agent can interpret your request."
            )
        return await self._parse_with_openai(payload)

    async def _parse_with_openai(self, payload: TaskPreviewRequest) -> ParsedIntent:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=self.settings.openai_api_key)
            response = await client.responses.create(
                model=self.settings.openai_model,
                input=[
                    {"role": "system", "content": REQUEST_PARSER_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": json.dumps(
                            {
                                "request": payload.original_request,
                                "location": payload.location.model_dump(),
                                "filters": payload.filters.model_dump(),
                            }
                        ),
                    },
                ],
                text={"format": {"type": "json_object"}},
            )
            content = response.output_text
            data: dict[str, Any] = json.loads(content)
        except json.JSONDecodeError as exc:
            raise LLMUnavailableError(
                "The request parser returned a response that wasn't valid JSON."
            ) from exc
        except Exception as exc:  # network error, auth error, rate limit, …
            raise LLMUnavailableError(
                f"The request parser could not reach the language model ({exc.__class__.__name__})."
            ) from exc

        # Deterministic phone-number extraction is a data utility, not intent
        # inference: read whatever digit groups the user typed and unify with
        # whatever the LLM may have returned.
        data["direct_phone_numbers"] = _extract_phone_numbers(
            payload.original_request,
            data.get("direct_phone_numbers", []),
        )
        data["required_questions"] = [
            _question_from_any(item) for item in data.get("required_questions", [])
        ]

        if data.get("calls_required", True) and not any(
            question.text.strip() for question in data["required_questions"]
        ):
            raise LLMUnavailableError(
                "The request parser did not produce any questions for the call. "
                "Please refine your request and try again."
            )

        try:
            return ParsedIntent(**data)
        except Exception as exc:
            raise LLMUnavailableError(
                f"The request parser returned a response that didn't match the schema "
                f"({exc.__class__.__name__})."
            ) from exc


# ---------------------------------------------------------------------------
# Pure data utilities — no intent inference.
# ---------------------------------------------------------------------------


def _extract_phone_numbers(
    request_text: str,
    extra_numbers: list[str] | None = None,
) -> list[str]:
    """Find phone-number-shaped digit runs in the user's request and any extras
    the LLM included. Output is E.164-normalised and deduplicated.
    """
    candidates: list[str] = list(extra_numbers or [])
    candidates.extend(
        match.group(0)
        for match in re.finditer(
            r"(?<!\w)(?:\+?\d[\d\s().-]{6,}\d)(?!\w)",
            request_text,
        )
    )
    normalized: list[str] = []
    for candidate in candidates:
        phone = _normalize_phone_number(str(candidate))
        if phone and phone not in normalized:
            normalized.append(phone)
    return normalized


def _normalize_phone_number(value: str) -> str | None:
    value = value.strip()
    has_plus = value.startswith("+")
    digits = re.sub(r"\D", "", value)
    if len(digits) < 7 or len(digits) > 15:
        return None
    if has_plus:
        return f"+{digits}"
    if len(digits) == 10:
        return f"+1{digits}"
    return f"+{digits}" if len(digits) > 10 else digits


def _question_from_any(item: Any) -> Question:
    """Coerce whatever shape the LLM emitted (dict, str) into a Question."""
    if isinstance(item, dict):
        return Question(
            id=str(item.get("id") or f"q_{uuid4().hex[:8]}"),
            text=str(item.get("text") or item.get("question") or ""),
            required=bool(item.get("required", True)),
        )
    return Question(id=f"q_{uuid4().hex[:8]}", text=str(item), required=True)


__all__ = ["RequestParserAgent"]
