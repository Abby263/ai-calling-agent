"""TranscriptExtractionAgent — LLM-only.

Converts a raw call transcript into the structured CallExtraction schema.
There is no regex / keyword fallback: when OpenAI isn't reachable we raise
`LLMUnavailableError` so the API surfaces the problem rather than producing
a low-confidence guess.
"""

from __future__ import annotations

import json
from typing import Any

from app.core.config import Settings
from app.prompts import TRANSCRIPT_EXTRACTION_SYSTEM_PROMPT
from app.schemas import CallExtraction, CallRecord
from app.services.errors import ConfigurationError, LLMUnavailableError


class TranscriptExtractionAgent:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def extract(self, call: CallRecord) -> CallExtraction:
        if not self.settings.openai_enabled:
            raise ConfigurationError(
                "Transcript extraction requires OpenAI. Set OPENAI_API_KEY (and "
                "run with DEMO_MODE=false) so call outcomes can be summarised."
            )

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=self.settings.openai_api_key)
            response = await client.responses.create(
                model=self.settings.openai_model,
                input=[
                    {"role": "system", "content": TRANSCRIPT_EXTRACTION_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": json.dumps(
                            {
                                "restaurant_name": call.business_name,
                                "contact_name": call.business_name,
                                "phone_number": call.phone_number,
                                "call_status": call.status,
                                "questions": [
                                    question.model_dump(mode="json") for question in call.questions
                                ],
                                "transcript": call.transcript,
                            }
                        ),
                    },
                ],
                text={"format": {"type": "json_object"}},
            )
            data: dict[str, Any] = json.loads(response.output_text)
        except json.JSONDecodeError as exc:
            raise LLMUnavailableError(
                "The transcript extraction agent returned a response that wasn't valid JSON."
            ) from exc
        except Exception as exc:
            raise LLMUnavailableError(
                f"The transcript extraction agent could not reach the language model "
                f"({exc.__class__.__name__})."
            ) from exc

        # The schema requires a few key fields — fill in the ones that are
        # deterministic data from the call record itself, without inferring
        # anything new.
        data.setdefault("restaurant_name", call.business_name)
        data.setdefault("contact_name", call.business_name)
        data.setdefault("phone_number", call.phone_number)
        data.setdefault("call_status", call.status)

        try:
            return CallExtraction(**data)
        except Exception as exc:
            raise LLMUnavailableError(
                f"The transcript extraction agent returned a response that didn't match "
                f"the schema ({exc.__class__.__name__})."
            ) from exc


__all__ = ["TranscriptExtractionAgent"]
