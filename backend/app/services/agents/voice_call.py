from __future__ import annotations

from datetime import UTC
from uuid import uuid4

from app.core.config import Settings
from app.db.store import utc_now
from app.schemas import BusinessCandidate, CallRecord, CallStatus, Question
from app.services.compliance import (
    approved_questions,
    build_call_script,
    build_disclosure_log,
    build_turn_prompt,
    local_business_hours_note,
)


class VoiceCallAgent:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def place_call(
        self,
        *,
        task_id: str,
        business: BusinessCandidate,
        questions: list[Question],
    ) -> CallRecord:
        call = CallRecord(
            id=str(uuid4()),
            task_id=task_id,
            business_id=business.id,
            business_name=business.name,
            phone_number=business.phone,
            status=CallStatus.PENDING,
            questions=questions,
            disclosure_log=[*build_disclosure_log(), local_business_hours_note()],
        )
        if self.settings.twilio_enabled:
            return await self._place_twilio_call(call)
        return self._simulate_call(call)

    async def _place_twilio_call(self, call: CallRecord) -> CallRecord:
        from twilio.rest import Client

        client = Client(self.settings.twilio_account_sid, self.settings.twilio_auth_token)
        voice_url = f"{self.settings.public_base_url}/api/webhooks/twilio/voice/{call.id}"
        status_url = f"{self.settings.public_base_url}/api/webhooks/twilio/status/{call.id}"
        twilio_call = client.calls.create(
            to=call.phone_number,
            from_=self.settings.twilio_from_number,
            url=voice_url,
            status_callback=status_url,
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            record=self.settings.allow_call_recording,
        )
        call.call_sid = twilio_call.sid
        call.status = CallStatus.CALLING
        call.started_at = utc_now()
        return call

    def _simulate_call(self, call: CallRecord) -> CallRecord:
        call.call_sid = f"demo_{uuid4().hex[:12]}"
        call.status = CallStatus.COMPLETED
        call.started_at = utc_now()
        call.ended_at = utc_now().astimezone(UTC)
        call.transcript = self._demo_transcript(call)
        return call

    def _demo_transcript(self, call: CallRecord) -> str:
        name = call.business_name
        lower = name.lower()
        if lower.startswith("contact"):
            return self._demo_direct_call_transcript(call)
        if "appletree" in lower or "clinic" in lower or "medical" in lower or "practice" in lower:
            return self._demo_clinic_transcript(call)
        if "north" in lower:
            return (
                f"AI: {build_call_script(call.questions)}\n"
                f"{name}: Yes, happy hour is 5 PM to 7 PM today with draft beer, wine, "
                "and shared plates. We have vegan fries and a vegan grain bowl, but the "
                "nachos need customization. Reservations are not required before 6 PM."
            )
        if "casa" in lower or "garden" in lower:
            return (
                f"AI: {build_call_script(call.questions)}\n"
                f"{name}: Yes, happy hour runs 4 PM to 6:30 PM with margaritas, tacos, "
                "and zero-proof specials. We have dedicated vegan menu items including "
                "mushroom tacos and black bean bowls. A reservation is recommended after 6."
            )
        if "juniper" in lower:
            return (
                f"AI: {build_call_script(call.questions)}\n"
                f"{name}: We have happy hour from 3:30 PM to 6 PM. Specials include wine, "
                "spritzes, hummus, olives, and flatbread. Vegan options are available; the "
                "flatbread needs no cheese. Reservations help but are not required."
            )
        return (
            f"AI: {build_call_script(call.questions)}\n"
            f"{name}: We are open today. Happy hour details are not confirmed over the phone. "
            "We can usually make vegetarian dishes, but vegan options depend on the kitchen."
        )

    def _demo_direct_call_transcript(self, call: CallRecord) -> str:
        name = call.business_name
        if name.endswith("1"):
            answers = [
                "Yes, I would like to join dinner.",
                "I am available tonight and looking forward to it.",
                "No follow-up is needed unless the time changes.",
            ]
        elif name.endswith("2"):
            answers = [
                "I am not sure yet.",
                "Please ask them to text me the time and place so I can confirm.",
                "I can confirm after I have the final details.",
            ]
        elif name.endswith("3"):
            answers = [
                "Thanks for inviting me, but I cannot make dinner this time.",
                "No follow-up needed.",
                "Nothing else.",
            ]
        else:
            answers = [
                "Yes, that works for me.",
                "Please have them send the final details.",
                "Nothing else.",
            ]
        return self._demo_turn_transcript(call, answers)

    def _demo_turn_transcript(self, call: CallRecord, answers: list[str]) -> str:
        questions = approved_questions(call.questions)
        if not questions:
            return f"AI: {build_call_script(call.questions)}\n{call.business_name}: {answers[0]}"
        lines: list[str] = []
        for index, _question in enumerate(questions):
            lines.append(f"AI: {build_turn_prompt(call.questions, index)}")
            if index < len(answers):
                lines.append(f"{call.business_name}: {answers[index]}")
        return "\n".join(lines)

    def _demo_clinic_transcript(self, call: CallRecord) -> str:
        name = call.business_name
        script = build_call_script(call.questions)
        lower = name.lower()
        if "harbourfront" in lower:
            answer = (
                "Yes, this is the Harbour Street location. We have doctor appointments available "
                "tomorrow at 10:30 AM and Thursday at 2 PM. The user can book by phone or online. "
                "We need their name, date of birth, contact number, and health card at booking. "
                "Please do not send medical details through an assistant."
            )
        elif "downtown" in lower:
            answer = (
                "We are Appletree downtown, but not the Harbour Street branch. The earliest doctor "
                "appointment here is Friday morning. The user should book online and bring "
                "health card details."
            )
        elif "family practice" in lower:
            answer = (
                "We are near Harbour Street and have limited appointments next week. New patients "
                "need to complete intake online before booking."
            )
        else:
            answer = (
                "We may have walk-in availability today, but doctor appointment booking depends on "
                "the user's registration details. Please ask them to call directly."
            )
        return f"AI: {script}\n{name}: {answer}"
