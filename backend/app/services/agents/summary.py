from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from app.core.config import Settings
from app.db.store import utc_now
from app.schemas import BusinessCandidate, CallRecord, CallStatus, SummaryRecord, TaskDetail


SYSTEM_PROMPT = """You are SummaryAgent for a voice concierge app.
Create a concise user-facing summary. The task may be a direct call tracker or a nearby business
comparison. Mention how many targets were found, how many were called, who answered, the key answer
for each target, recommended next action, no-answer targets, and uncertainty."""


class SummaryAgent:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def summarize(self, detail: TaskDetail) -> SummaryRecord:
        if self.settings.openai_enabled:
            summary = await self._summarize_with_openai(detail)
            if summary:
                return summary
        return self._fallback_summary(detail)

    async def _summarize_with_openai(self, detail: TaskDetail) -> SummaryRecord | None:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=self.settings.openai_api_key)
            response = await client.responses.create(
                model=self.settings.openai_model,
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": json.dumps(detail.model_dump(mode="json")),
                    },
                ],
                text={"format": {"type": "json_object"}},
            )
            data: dict[str, Any] = json.loads(response.output_text)
            return SummaryRecord(
                id=str(uuid4()),
                task_id=detail.task.id,
                final_summary=str(data.get("final_summary") or ""),
                recommendation_json=data.get("recommendation_json") or data,
                created_at=utc_now(),
            )
        except Exception:
            return None

    def _fallback_summary(self, detail: TaskDetail) -> SummaryRecord:
        if detail.task.parsed_intent_json.task_kind == "direct_calls":
            return self._fallback_direct_call_summary(detail)
        if self._is_appointment_task(detail):
            return self._fallback_appointment_summary(detail)

        answered = [
            call
            for call in detail.calls
            if call.status == CallStatus.COMPLETED and call.extraction_json is not None
        ]
        not_answered = [
            call.business_name
            for call in detail.calls
            if call.status in {CallStatus.NO_ANSWER, CallStatus.VOICEMAIL, CallStatus.FAILED}
        ]
        business_by_id = {business.id: business for business in detail.businesses}
        best_overall = self._best_overall(answered, business_by_id)
        best_happy = self._best_happy(answered)
        best_vegan = self._best_vegan(answered)
        closest = min(
            detail.businesses,
            key=lambda business: business.distance_meters if business.distance_meters is not None else 10**9,
            default=None,
        )

        if best_overall:
            extraction = best_overall.extraction_json
            final_summary = (
                f"I found {len(detail.businesses)} nearby options and called {len(detail.calls)}. "
                f"{len(answered)} answered. Best overall is {best_overall.business_name}"
            )
            if extraction and extraction.happy_hour_time:
                final_summary += f" with happy hour {extraction.happy_hour_time}"
            if extraction and extraction.vegan_options_available == "yes":
                final_summary += " and confirmed vegan options"
            final_summary += "."
        else:
            final_summary = (
                f"I found {len(detail.businesses)} nearby options and called {len(detail.calls)}. "
                "I do not yet have enough confirmed phone answers for a strong recommendation."
            )

        recommendation_json = {
            "best_overall": best_overall.business_name if best_overall else None,
            "best_happy_hour": best_happy.business_name if best_happy else None,
            "best_vegan_friendly": best_vegan.business_name if best_vegan else None,
            "closest": closest.name if closest else None,
            "did_not_answer": not_answered,
            "uncertainty": [
                call.business_name
                for call in answered
                if call.extraction_json and call.extraction_json.confidence_score < 0.7
            ],
            "results": [
                {
                    "restaurant": call.business_name,
                    "distance_meters": business_by_id.get(call.business_id).distance_meters
                    if business_by_id.get(call.business_id)
                    else None,
                    "happy_hour": call.extraction_json.happy_hour_available
                    if call.extraction_json
                    else "unknown",
                    "vegan_options": call.extraction_json.vegan_options_available
                    if call.extraction_json
                    else "unknown",
                    "notes": call.extraction_json.notes if call.extraction_json else "",
                    "recommended": call.extraction_json.recommended_for_user
                    if call.extraction_json
                    else False,
                }
                for call in detail.calls
            ],
        }
        return SummaryRecord(
            id=str(uuid4()),
            task_id=detail.task.id,
            final_summary=final_summary,
            recommendation_json=recommendation_json,
            created_at=utc_now(),
        )

    def _fallback_appointment_summary(self, detail: TaskDetail) -> SummaryRecord:
        answered = [
            call
            for call in detail.calls
            if call.status == CallStatus.COMPLETED and call.extraction_json is not None
        ]
        not_answered = [
            call.business_name
            for call in detail.calls
            if call.status in {CallStatus.NO_ANSWER, CallStatus.VOICEMAIL, CallStatus.FAILED}
        ]
        available = [
            call
            for call in answered
            if call.extraction_json and call.extraction_json.appointment_available == "yes"
        ]
        best = next(
            (
                call
                for call in available
                if call.extraction_json and call.extraction_json.key_details.get("correct_location") == "yes"
            ),
            available[0] if available else None,
        )

        if best and best.extraction_json:
            final_summary = (
                f"I called {len(detail.calls)} clinic option{'s' if len(detail.calls) != 1 else ''}. "
                f"Best option is {best.business_name}"
            )
            if best.extraction_json.appointment_time:
                final_summary += f" with availability around {best.extraction_json.appointment_time}"
            final_summary += ". The user should complete booking directly and avoid sharing medical details through the assistant."
        else:
            final_summary = (
                f"I called {len(detail.calls)} clinic option{'s' if len(detail.calls) != 1 else ''}. "
                "No confirmed appointment slot was captured yet."
            )

        recommendation_json = {
            "task_kind": "nearby_search",
            "use_case": "appointment_booking",
            "best_overall": best.business_name if best else None,
            "appointment_available": [call.business_name for call in available],
            "did_not_answer": not_answered,
            "uncertainty": [
                call.business_name
                for call in answered
                if call.extraction_json and call.extraction_json.confidence_score < 0.7
            ],
            "results": [
                {
                    "restaurant": call.business_name,
                    "target": call.business_name,
                    "phone_number": call.phone_number,
                    "call_status": call.status,
                    "appointment_available": call.extraction_json.appointment_available
                    if call.extraction_json
                    else "unknown",
                    "appointment_time": call.extraction_json.appointment_time
                    if call.extraction_json
                    else None,
                    "appointment_details": call.extraction_json.appointment_details
                    if call.extraction_json
                    else None,
                    "booking_requirements": call.extraction_json.booking_requirements
                    if call.extraction_json
                    else None,
                    "follow_up_required": call.extraction_json.follow_up_required
                    if call.extraction_json
                    else "unknown",
                    "notes": call.extraction_json.notes if call.extraction_json else "",
                    "recommended": call.extraction_json.recommended_for_user
                    if call.extraction_json
                    else False,
                    "happy_hour": "unknown",
                    "vegan_options": "unknown",
                }
                for call in detail.calls
            ],
        }
        return SummaryRecord(
            id=str(uuid4()),
            task_id=detail.task.id,
            final_summary=final_summary,
            recommendation_json=recommendation_json,
            created_at=utc_now(),
        )

    def _fallback_direct_call_summary(self, detail: TaskDetail) -> SummaryRecord:
        answered = [
            call
            for call in detail.calls
            if call.status == CallStatus.COMPLETED and call.extraction_json is not None
        ]
        accepted = [
            call.business_name
            for call in answered
            if call.extraction_json and call.extraction_json.call_outcome == "accepted"
        ]
        declined = [
            call.business_name
            for call in answered
            if call.extraction_json and call.extraction_json.call_outcome == "declined"
        ]
        maybe = [
            call.business_name
            for call in answered
            if call.extraction_json and call.extraction_json.call_outcome == "maybe"
        ]
        not_answered = [
            call.business_name
            for call in detail.calls
            if call.status in {CallStatus.NO_ANSWER, CallStatus.VOICEMAIL, CallStatus.FAILED}
        ]

        parts = [
            f"I called {len(detail.calls)} contact{'s' if len(detail.calls) != 1 else ''}.",
            f"{len(accepted)} accepted",
            f"{len(maybe)} need follow-up",
            f"{len(declined)} declined",
        ]
        if not_answered:
            parts.append(f"{len(not_answered)} did not answer")
        final_summary = " ".join(parts) + "."
        if maybe:
            final_summary += f" Follow up with {', '.join(maybe)} to confirm details."

        recommendation_json = {
            "task_kind": "direct_calls",
            "best_overall": accepted[0] if accepted else None,
            "accepted": accepted,
            "declined": declined,
            "maybe": maybe,
            "did_not_answer": not_answered,
            "uncertainty": [
                call.business_name
                for call in answered
                if call.extraction_json and call.extraction_json.confidence_score < 0.7
            ],
            "results": [
                {
                    "target": call.business_name,
                    "restaurant": call.business_name,
                    "phone_number": call.phone_number,
                    "call_status": call.status,
                    "outcome": call.extraction_json.call_outcome if call.extraction_json else "unknown",
                    "answer_summary": call.extraction_json.answer_summary if call.extraction_json else None,
                    "follow_up_required": call.extraction_json.follow_up_required
                    if call.extraction_json
                    else "unknown",
                    "happy_hour": "unknown",
                    "vegan_options": "unknown",
                    "notes": call.extraction_json.notes if call.extraction_json else "",
                    "recommended": call.extraction_json.recommended_for_user
                    if call.extraction_json
                    else False,
                }
                for call in detail.calls
            ],
        }
        return SummaryRecord(
            id=str(uuid4()),
            task_id=detail.task.id,
            final_summary=final_summary,
            recommendation_json=recommendation_json,
            created_at=utc_now(),
        )

    def _best_overall(
        self,
        calls: list[CallRecord],
        business_by_id: dict[str, BusinessCandidate],
    ) -> CallRecord | None:
        def score(call: CallRecord) -> float:
            extraction = call.extraction_json
            business = business_by_id.get(call.business_id)
            value = 0.0
            if extraction:
                value += 35 if extraction.happy_hour_available == "yes" else 0
                value += 35 if extraction.vegan_options_available == "yes" else 0
                value += extraction.confidence_score * 10
            if business:
                value += business.rating or 0
                if business.distance_meters is not None:
                    value += max(0, 10 - business.distance_meters / 500)
            return value

        return max(calls, key=score, default=None)

    def _best_happy(self, calls: list[CallRecord]) -> CallRecord | None:
        return next(
            (
                call
                for call in calls
                if call.extraction_json and call.extraction_json.happy_hour_available == "yes"
            ),
            None,
        )

    def _best_vegan(self, calls: list[CallRecord]) -> CallRecord | None:
        return next(
            (
                call
                for call in calls
                if call.extraction_json and call.extraction_json.vegan_options_available == "yes"
            ),
            None,
        )

    def _is_appointment_task(self, detail: TaskDetail) -> bool:
        intent = detail.task.parsed_intent_json
        return (
            intent.business_type == "clinic"
            or intent.output_format == "appointment_availability_tracker"
            or "appointment" in intent.call_objective.lower()
        )
