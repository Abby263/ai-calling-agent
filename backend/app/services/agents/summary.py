"""SummaryAgent — LLM-only.

Produces the final user-facing summary plus the structured `recommendation_json`
block used by the dashboard's results table. There is no fallback: if OpenAI
isn't reachable we raise so the API surfaces the limitation. The exact JSON
shape required for each task kind is described in the system prompt
(`prompts/summary.py`).
"""

from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from app.core.config import Settings
from app.db.store import utc_now
from app.prompts import SUMMARY_SYSTEM_PROMPT
from app.schemas import SummaryRecord, TaskDetail
from app.services.errors import ConfigurationError, LLMUnavailableError


class SummaryAgent:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def summarize(self, detail: TaskDetail) -> SummaryRecord:
        if not self.settings.openai_enabled:
            raise ConfigurationError(
                "The summary agent requires OpenAI. Set OPENAI_API_KEY (and run "
                "with DEMO_MODE=false) so the final summary can be generated."
            )

        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=self.settings.openai_api_key)
            response = await client.responses.create(
                model=self.settings.openai_model,
                input=[
                    {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": json.dumps(detail.model_dump(mode="json")),
                    },
                ],
                text={"format": {"type": "json_object"}},
            )
            data: dict[str, Any] = json.loads(response.output_text)
        except json.JSONDecodeError as exc:
            raise LLMUnavailableError(
                "The summary agent returned a response that wasn't valid JSON."
            ) from exc
        except Exception as exc:
            raise LLMUnavailableError(
                f"The summary agent could not reach the language model "
                f"({exc.__class__.__name__})."
            ) from exc

        final_summary = str(data.get("final_summary") or "").strip()
        recommendation_json = data.get("recommendation_json") or data
        if not final_summary:
            raise LLMUnavailableError(
                "The summary agent returned an empty final summary."
            )

        return SummaryRecord(
            id=str(uuid4()),
            task_id=detail.task.id,
            final_summary=final_summary,
            recommendation_json=recommendation_json,
            created_at=utc_now(),
        )


__all__ = ["SummaryAgent"]
