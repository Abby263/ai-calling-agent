from __future__ import annotations

import json
import re
from typing import Any

from app.core.config import Settings
from app.schemas import CallExtraction, CallRecord, CallStatus

SYSTEM_PROMPT = """You are TranscriptExtractionAgent.
Convert a phone transcript into the requested JSON schema. The call may be a restaurant/business
availability call or a direct call to a user-provided contact. Use unknown when the transcript does
not clearly answer a field. Keep notes concise. Do not infer medical, private, payment, or other
sensitive personal information."""


class TranscriptExtractionAgent:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def extract(self, call: CallRecord) -> CallExtraction:
        if self.settings.openai_enabled and call.transcript:
            extraction = await self._extract_with_openai(call)
            if extraction:
                return extraction
        return self._fallback_extract(call)

    async def _extract_with_openai(self, call: CallRecord) -> CallExtraction | None:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=self.settings.openai_api_key)
            response = await client.responses.create(
                model=self.settings.openai_model,
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
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
            data.setdefault("restaurant_name", call.business_name)
            data.setdefault("contact_name", call.business_name)
            data.setdefault("phone_number", call.phone_number)
            data.setdefault("call_status", call.status)
            return CallExtraction(**data)
        except Exception:
            return None

    def _fallback_extract(self, call: CallRecord) -> CallExtraction:
        transcript = (call.transcript or "").lower()
        if call.business_name.lower().startswith("contact"):
            return self._fallback_direct_call_extract(call)
        if self._looks_like_clinic_call(call):
            return self._fallback_appointment_extract(call)

        happy = "unknown"
        if "happy hour" in transcript and any(
            word in transcript for word in ["yes", "runs", "from"]
        ):
            happy = "yes"
        if "no happy hour" in transcript:
            happy = "no"

        vegan = "unknown"
        if "vegan" in transcript and any(
            word in transcript for word in ["yes", "available", "dedicated"]
        ):
            vegan = "yes"
        if "no vegan" in transcript:
            vegan = "no"

        reservation = "unknown"
        if "not required" in transcript:
            reservation = "no"
        if "recommended" in transcript or "need a reservation" in transcript:
            reservation = "yes"

        time_match = re.search(
            r"(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)",
            call.transcript or "",
            flags=re.IGNORECASE,
        )
        confidence = 0.82 if happy != "unknown" or vegan != "unknown" else 0.45
        return CallExtraction(
            restaurant_name=call.business_name,
            contact_name=call.business_name,
            phone_number=call.phone_number,
            call_status=call.status,
            call_outcome="not_applicable",
            answer_summary=(
                self._sentence_after_speaker(call.transcript) or "Restaurant details captured."
            ),
            key_details={},
            follow_up_required=reservation,
            appointment_available="unknown",
            appointment_time=None,
            appointment_details=None,
            booking_requirements=None,
            happy_hour_available=happy,
            happy_hour_time=time_match.group(1) if time_match else None,
            happy_hour_details=self._sentence_with(call.transcript, ["special", "happy hour"]),
            vegan_options_available=vegan,
            vegan_options_details=self._sentence_with(call.transcript, ["vegan"]),
            reservation_required=reservation,
            confidence_score=confidence,
            notes=(
                "Extracted from call transcript."
                if call.transcript
                else "No transcript available."
            ),
            recommended_for_user=happy == "yes" and vegan == "yes",
        )

    def _fallback_direct_call_extract(self, call: CallRecord) -> CallExtraction:
        transcript = (call.transcript or "").lower()
        if not transcript:
            if call.status == CallStatus.NO_ANSWER:
                return self._terminal_direct_call_extract(
                    call,
                    "no_answer",
                    "No one answered the call.",
                )
            if call.status == CallStatus.VOICEMAIL:
                return self._terminal_direct_call_extract(
                    call,
                    "voicemail",
                    "The call reached voicemail.",
                )
            if call.status == CallStatus.FAILED:
                return self._terminal_direct_call_extract(
                    call,
                    "unknown",
                    "The call failed before an answer was captured.",
                )
            return self._terminal_direct_call_extract(
                call,
                "unknown",
                "The call completed, but no speech transcript was captured.",
            )
        outcome = "unknown"
        if any(
            phrase in transcript
            for phrase in ["would like to join", "yes", "works for me", "available"]
        ):
            outcome = "accepted"
        if any(phrase in transcript for phrase in ["not sure", "maybe", "can confirm", "text me"]):
            outcome = "maybe"
        if any(phrase in transcript for phrase in ["cannot make", "can't make", "decline", "no,"]):
            outcome = "declined"

        follow_up = "unknown"
        if any(
            phrase in transcript
            for phrase in ["follow up", "text me", "send the final details", "time changes"]
        ):
            follow_up = "yes"
        if any(
            phrase in transcript
            for phrase in [
                "no follow-up needed",
                "no follow up needed",
                "no follow-up is needed",
                "no follow up is needed",
            ]
        ):
            follow_up = "no"

        answer = self._sentence_after_speaker(call.transcript)
        return CallExtraction(
            restaurant_name=call.business_name,
            contact_name=call.business_name,
            phone_number=call.phone_number,
            call_status=call.status,
            call_outcome=outcome,
            answer_summary=answer,
            key_details={
                "response": outcome,
                "requires_user_follow_up": follow_up,
            },
            follow_up_required=follow_up,
            appointment_available="unknown",
            appointment_time=None,
            appointment_details=None,
            booking_requirements=None,
            confidence_score=0.84 if outcome != "unknown" else 0.5,
            notes=answer or "No clear response captured.",
            recommended_for_user=outcome == "accepted",
        )

    def _terminal_direct_call_extract(
        self,
        call: CallRecord,
        outcome: str,
        message: str,
    ) -> CallExtraction:
        return CallExtraction(
            restaurant_name=call.business_name,
            contact_name=call.business_name,
            phone_number=call.phone_number,
            call_status=call.status,
            call_outcome=outcome,
            answer_summary=message,
            key_details={
                "response": outcome,
                "requires_user_follow_up": "yes" if outcome == "unknown" else "no",
            },
            follow_up_required="yes" if outcome == "unknown" else "no",
            appointment_available="unknown",
            appointment_time=None,
            appointment_details=None,
            booking_requirements=None,
            confidence_score=0.35 if outcome == "unknown" else 0.7,
            notes=message,
            recommended_for_user=False,
        )

    def _fallback_appointment_extract(self, call: CallRecord) -> CallExtraction:
        transcript = (call.transcript or "").lower()
        available = "unknown"
        if any(
            phrase in transcript for phrase in ["available", "availability", "appointment here is"]
        ):
            available = "yes"
        if any(phrase in transcript for phrase in ["no appointments", "not accepting"]):
            available = "no"

        follow_up = "yes"
        if "no follow-up" in transcript:
            follow_up = "no"

        time_match = re.search(
            (
                r"((?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|"
                r"saturday|sunday)?\s*(?:at\s*)?\d{1,2}(?::\d{2})?\s*"
                r"(?:am|pm|a\.m\.|p\.m\.)|friday morning|next week|"
                r"thursday at \d{1,2}\s*pm)"
            ),
            call.transcript or "",
            flags=re.IGNORECASE,
        )
        answer = self._sentence_after_speaker(call.transcript)
        answer_text = self._speaker_response_text(call.transcript)
        requirements = self._sentences_with(
            answer_text,
            ["need", "required", "book", "health card", "online", "phone"],
        )
        correct_location = "unknown"
        if "harbour street location" in transcript or "near harbour street" in transcript:
            correct_location = "yes"
        if "not the harbour street branch" in transcript:
            correct_location = "no"

        return CallExtraction(
            restaurant_name=call.business_name,
            contact_name=call.business_name,
            phone_number=call.phone_number,
            call_status=call.status,
            call_outcome="accepted" if available == "yes" else "unknown",
            answer_summary=answer,
            key_details={
                "correct_location": correct_location,
                "safe_booking_note": "Do not share medical details through the assistant.",
            },
            follow_up_required=follow_up,
            appointment_available=available,
            appointment_time=time_match.group(1).strip() if time_match else None,
            appointment_details=answer,
            booking_requirements=requirements,
            confidence_score=0.86 if available != "unknown" else 0.55,
            notes=answer or "No clear appointment information captured.",
            recommended_for_user=available == "yes" and correct_location != "no",
        )

    def _sentence_with(self, transcript: str | None, needles: list[str]) -> str | None:
        if not transcript:
            return None
        for sentence in re.split(r"(?<=[.!?])\s+", transcript):
            lower = sentence.lower()
            if any(needle in lower for needle in needles):
                return sentence.strip()
        return None

    def _sentences_with(self, transcript: str | None, needles: list[str]) -> str | None:
        if not transcript:
            return None
        matches = []
        for sentence in re.split(r"(?<=[.!?])\s+", transcript):
            lower = sentence.lower()
            if any(needle in lower for needle in needles):
                matches.append(sentence.strip())
        return " ".join(matches) if matches else None

    def _sentence_after_speaker(self, transcript: str | None) -> str | None:
        response = self._speaker_response_text(transcript)
        if response:
            return response
        return None

    def _speaker_response_text(self, transcript: str | None) -> str | None:
        if not transcript:
            return None
        lines = [line.strip() for line in transcript.splitlines() if line.strip()]
        responses: list[str] = []
        for line in lines:
            if line.startswith("AI:"):
                continue
            if ":" in line:
                responses.append(line.split(":", 1)[1].strip())
            else:
                responses.append(line)
        return " ".join(response for response in responses if response).strip() or None

    def _looks_like_clinic_call(self, call: CallRecord) -> bool:
        name = call.business_name.lower()
        questions = " ".join(question.text for question in call.questions).lower()
        return any(
            word in name for word in ["clinic", "medical", "doctor", "practice", "appletree"]
        ) or any(
            word in questions
            for word in ["doctor", "appointment", "clinic", "health card"]
        )
