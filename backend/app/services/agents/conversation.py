"""ConversationAgent — drives natural, bounded outbound voice calls.

The agent is **LLM-only**. Every utterance the AI caller speaks comes from an
OpenAI request: the opening utterance from `opening()` and each subsequent
turn from `respond()`. There are no template / regex fallbacks; if the LLM
isn't reachable we raise an `LLMUnavailableError` so the user sees the reason
on the UI instead of getting a degraded scripted response.

Hard guard rails (max turns, max wall-clock seconds, max reply word count)
are config-driven via `Settings.voice_max_*`.

The single non-LLM helper is `disclosure_line()`, which composes the legally
required opening sentence ("Hi, this is an AI assistant…"). It does not
make decisions; it just constructs the prefix the LLM is told to repeat.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from app.core.config import Settings
from app.prompts import (
    CALL_CLOSING_LINE,
    OPENING_SYSTEM_PROMPT,
    RESPOND_SYSTEM_PROMPT,
    disclosure_line,
)
from app.schemas import CallRecord, ParsedIntent, Question
from app.services.compliance import approved_questions
from app.services.errors import ConfigurationError, LLMUnavailableError


@dataclass
class ConversationTurn:
    """One step the AI caller should take next."""

    reply: str
    should_end: bool = False
    answers: dict[str, str] | None = None  # optional question_id -> short answer


class ConversationAgent:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def opening(
        self,
        call: CallRecord,
        intent: ParsedIntent | None = None,
        caller_display_name: str | None = None,
    ) -> ConversationTurn:
        """First thing the AI caller says when the line is picked up."""
        self._require_llm()

        questions = approved_questions(call.questions)
        personal = _is_personal_call(intent)
        disclosure = disclosure_line(caller_display_name, personal=personal)

        try:
            from openai import OpenAI

            client = OpenAI(api_key=self.settings.openai_api_key)
            response = client.responses.create(
                model=self.settings.openai_model,
                input=[
                    {"role": "system", "content": OPENING_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": json.dumps(
                            {
                                "callee_name": call.business_name,
                                "objective": intent.call_objective if intent else None,
                                "questions": [q.text for q in questions],
                                "caller_display_name": (
                                    caller_display_name if personal else None
                                ),
                                "is_personal_call": personal,
                                "required_disclosure": disclosure,
                            }
                        ),
                    },
                ],
            )
            text = (response.output_text or "").strip().strip('"').strip()
        except Exception as exc:  # network / auth / rate limit / …
            raise LLMUnavailableError(
                f"The conversation agent could not generate an opening "
                f"({exc.__class__.__name__})."
            ) from exc

        if not text:
            raise LLMUnavailableError(
                "The conversation agent returned an empty opening utterance."
            )

        # Defensive: enforce the disclosure even if the model dropped it.
        if "ai assistant" not in text.lower():
            text = f"{disclosure} {text}".strip()

        return ConversationTurn(
            reply=_truncate_words(text, self.settings.voice_max_reply_words),
            should_end=False,
        )

    async def respond(
        self,
        *,
        call: CallRecord,
        last_utterance: str | None,
        turn_index: int,
        intent: ParsedIntent | None = None,
        caller_display_name: str | None = None,
    ) -> ConversationTurn:
        """Decide what the caller should say next given the latest callee
        utterance.
        """
        self._require_llm()

        questions = approved_questions(call.questions)
        history = _parse_transcript(call.transcript)
        personal = _is_personal_call(intent)
        max_turns = self.settings.voice_max_turns

        # Hard cap turns — every other guard rail trusts this to fire.
        if turn_index >= max_turns:
            return ConversationTurn(reply=CALL_CLOSING_LINE, should_end=True)

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=self.settings.openai_api_key)
            payload = {
                "callee_name": call.business_name,
                "objective": intent.call_objective if intent else None,
                "questions": [{"id": q.id, "text": q.text} for q in questions],
                "transcript_so_far": history,
                "last_callee_utterance": last_utterance,
                "turn_index": turn_index,
                "max_turns": max_turns,
                "caller_display_name": caller_display_name if personal else None,
                "is_personal_call": personal,
            }
            response = await client.responses.create(
                model=self.settings.openai_model,
                input=[
                    {"role": "system", "content": RESPOND_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload)},
                ],
                text={"format": {"type": "json_object"}},
            )
            data = json.loads(response.output_text)
        except json.JSONDecodeError as exc:
            raise LLMUnavailableError(
                "The conversation agent returned a response that wasn't valid JSON."
            ) from exc
        except Exception as exc:
            raise LLMUnavailableError(
                f"The conversation agent could not generate a turn "
                f"({exc.__class__.__name__})."
            ) from exc

        reply = (data.get("reply") or "").strip()
        if not reply:
            raise LLMUnavailableError(
                "The conversation agent returned an empty reply for the next turn."
            )

        should_end = bool(data.get("should_end"))
        answers_field = data.get("answers")
        answers: dict[str, str] | None
        if isinstance(answers_field, dict):
            answers = {str(k): str(v) for k, v in answers_field.items() if v}
        else:
            answers = None

        return ConversationTurn(
            reply=_truncate_words(reply, self.settings.voice_max_reply_words),
            should_end=should_end,
            answers=answers,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _require_llm(self) -> None:
        if not self.settings.openai_enabled:
            raise ConfigurationError(
                "The conversation agent requires OpenAI. Set OPENAI_API_KEY (and "
                "run with DEMO_MODE=false) so the agent can speak on the call."
            )


# ---------------------------------------------------------------------------
# Pure data utilities (no intent inference)
# ---------------------------------------------------------------------------


def _is_personal_call(intent: ParsedIntent | None) -> bool:
    """Personal calls are direct calls to a user-provided contact (friends,
    family). Business calls (clinics, restaurants, salons, …) stay anonymous.
    """
    if intent is None:
        return False
    return intent.task_kind == "direct_calls"


def _parse_transcript(transcript: str | None) -> list[dict[str, str]]:
    """Convert a transcript string of `Speaker: text` lines into a list of
    turns. Schema-only — no intent inference.
    """
    if not transcript:
        return []
    turns: list[dict[str, str]] = []
    for raw_line in transcript.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if ":" in line:
            speaker, text = line.split(":", 1)
            speaker = speaker.strip()
            text = text.strip()
            if not text:
                continue
            normalized = "AI" if speaker.upper() == "AI" else "Callee"
            turns.append({"speaker": normalized, "text": text})
        else:
            turns.append({"speaker": "Callee", "text": line})
    return turns


def _truncate_words(text: str, max_words: int) -> str:
    words = re.findall(r"\S+", text)
    if len(words) <= max_words:
        return text.strip()
    truncated = " ".join(words[:max_words]).rstrip(",;:")
    if not truncated.endswith((".", "!", "?")):
        truncated += "."
    return truncated


__all__ = ["ConversationAgent", "ConversationTurn"]
