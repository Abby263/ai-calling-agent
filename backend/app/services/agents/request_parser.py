from __future__ import annotations

import json
import re
from typing import Any
from uuid import uuid4

from app.core.config import Settings
from app.schemas import ParsedIntent, Question, SearchFilters, TaskPreviewRequest

SYSTEM_PROMPT = """You are RequestParserAgent for a voice concierge app.
Return only valid JSON. The app supports:
1. direct_calls: user provides phone numbers and asks the agent to call them for a general purpose.
2. nearby_search: user asks to find nearby businesses before calling.

Extract task_kind, direct_phone_numbers, call_objective, constraints, call questions,
summary criteria, and whether calls are required.

CRITICAL — required_questions for direct_calls:
- The questions are what the AI says to the callee, in the second person ("Are you …?",
  "What is your …?", "Could you share …?"). They must be specific to the user's actual request.
- Anchor every question on the user's request text. If the user asked about "their plans for the
  weekend", the first question is "What are your plans for the weekend?" — never a generic
  template like "What answer should I pass back?" or "Is any follow-up needed?".
- Generate the *minimum* number of questions needed (usually 1, sometimes 2 if a follow-up like
  "is there anything else we should know?" is genuinely useful). Do not pad.
- The questions must read naturally when spoken aloud. No numbered prefixes ("Question 1 of 3"
  is forbidden). No internal jargon. Phrase each like a friendly human would.

Other rules:
- Never invent private user details. If the user asked you to call about something but didn't
  give details (e.g., date, time, address, price), do NOT make them up — the AI on the call will
  say "I'll have <user> follow up with details" if asked.
- For confusing requests, set constraints.needs_clarification=true and include
  constraints.clarifying_questions with the missing information.
- For appointment or clinic requests, ask about availability and booking requirements only; do
  not ask for symptoms, diagnosis, insurance, health card numbers, or other medical details.
- Always return at least one required question when calls_required=true."""


class RequestParserAgent:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def parse(self, payload: TaskPreviewRequest) -> ParsedIntent:
        if self.settings.openai_enabled:
            parsed = await self._parse_with_openai(payload)
            if parsed:
                return parsed
        return self._fallback_parse(payload.original_request, payload.filters)

    async def _parse_with_openai(self, payload: TaskPreviewRequest) -> ParsedIntent | None:
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
            data["direct_phone_numbers"] = self._extract_phone_numbers(
                payload.original_request,
                data.get("direct_phone_numbers", []),
            )
            data["required_questions"] = [
                self._question_from_any(item) for item in data.get("required_questions", [])
            ]
            if data["direct_phone_numbers"]:
                data["task_kind"] = "direct_calls"
            elif self._looks_like_direct_call_request(payload.original_request):
                data["task_kind"] = "direct_calls"
                data["business_type"] = "contact"
                data["search_target"] = "user-provided phone numbers"
                data.setdefault("constraints", {})
                data["constraints"]["needs_clarification"] = True
                data["constraints"]["clarifying_questions"] = [
                    "Add the phone number or contact list the agent should call."
                ]
                data["calls_required"] = True
                data["online_search_enough"] = False
            if data.get("calls_required", True) and not any(
                question.text.strip() for question in data["required_questions"]
            ):
                data["required_questions"] = self._questions_for_request(
                    payload.original_request,
                    payload.filters,
                    task_kind=str(data.get("task_kind") or ""),
                )
            return ParsedIntent(**data)
        except Exception:
            return None

    def _fallback_parse(self, request_text: str, filters: SearchFilters) -> ParsedIntent:
        text = request_text.lower()
        phone_numbers = self._extract_phone_numbers(request_text)
        if phone_numbers:
            return self._fallback_direct_call_parse(request_text, filters, phone_numbers)
        if self._looks_like_direct_call_request(request_text):
            return ParsedIntent(
                task_kind="direct_calls",
                business_type="contact",
                search_target="user-provided phone numbers",
                call_objective=self._direct_call_objective(request_text),
                direct_phone_numbers=[],
                radius_meters=filters.radius_meters,
                required_questions=self._direct_call_questions(request_text),
                constraints={
                    "needs_clarification": True,
                    "clarifying_questions": [
                        "Add the phone number or contact list the agent should call."
                    ],
                    "max_calls": filters.max_calls,
                    "preferred_call_time": filters.preferred_call_time,
                    "provided_phone_number_count": 0,
                },
                calls_required=True,
                online_search_enough=False,
                summary_criteria=[
                    "Who accepted",
                    "Who declined",
                    "Who is unsure",
                    "Who did not answer",
                    "Follow-up needed",
                ],
                output_format="call_outcome_tracker",
            )

        business_type = "restaurant"
        search_target = "nearby restaurants and bars"

        if any(word in text for word in ["cafe", "coffee"]):
            business_type = "cafe"
            search_target = "nearby cafes"
        elif "salon" in text:
            business_type = "salon"
            search_target = "nearby salons"
        elif any(word in text for word in ["clinic", "doctor", "physician", "medical"]):
            business_type = "clinic"
            search_target = self._clinic_search_target(request_text)
        elif any(word in text for word in ["store", "shop"]):
            business_type = "store"
            search_target = "nearby stores"

        radius = filters.radius_meters
        radius_match = re.search(
            r"(\d+(?:\.\d+)?)\s*(km|kilometer|kilometers|mi|mile|miles|m)\b",
            text,
        )
        if radius_match:
            value = float(radius_match.group(1))
            unit = radius_match.group(2)
            if unit.startswith("mi"):
                radius = int(value * 1609.34)
            elif unit == "m":
                radius = int(value)
            else:
                radius = int(value * 1000)

        dietary = filters.dietary_preference
        for option in ["vegan", "vegetarian", "gluten-free", "halal", "kosher"]:
            if option in text:
                dietary = option
                break

        questions = self._default_questions(text, dietary)
        constraints = {
            "cuisine": filters.cuisine,
            "price_level": filters.price_level,
            "minimum_rating": filters.min_rating,
            "open_now": filters.open_now,
            "max_calls": filters.max_calls,
            "preferred_call_time": filters.preferred_call_time,
            "dietary_preference": dietary,
            "named_provider": "Apple Tree" if "apple tree" in text else None,
            "street_or_area": "Harbour Street" if "harbour" in text or "harbor" in text else None,
        }
        call_objective = "Find out which nearby business best matches the user's request."
        summary_criteria = [
            "Best overall recommendation",
            "Best happy hour",
            f"Best {dietary or 'dietary'}-friendly option",
            "Closest option",
        ]
        output_format = "comparison_table_with_recommendations"
        if business_type == "clinic" or "appointment" in text:
            call_objective = (
                "Ask about doctor appointment availability and booking requirements without "
                "sharing medical details."
            )
            summary_criteria = [
                "Earliest appointment availability",
                "Correct clinic location",
                "Booking requirements",
                "Whether user follow-up is required",
                "No-answer clinics",
            ]
            output_format = "appointment_availability_tracker"
        return ParsedIntent(
            task_kind="nearby_search",
            business_type=business_type,
            search_target=search_target,
            call_objective=call_objective,
            direct_phone_numbers=[],
            location_text=None,
            radius_meters=radius,
            required_questions=questions,
            constraints=constraints,
            calls_required=any(
                phrase in text
                for phrase in ["call", "ask", "find out", "book", "appointment", "invite"]
            ),
            online_search_enough=False,
            summary_criteria=summary_criteria,
            output_format=output_format,
        )

    def _fallback_direct_call_parse(
        self,
        request_text: str,
        filters: SearchFilters,
        phone_numbers: list[str],
    ) -> ParsedIntent:
        objective = self._direct_call_objective(request_text)
        questions = self._direct_call_questions(request_text)
        return ParsedIntent(
            task_kind="direct_calls",
            business_type="contact",
            search_target="user-provided phone numbers",
            call_objective=objective,
            direct_phone_numbers=phone_numbers,
            radius_meters=filters.radius_meters,
            required_questions=questions,
            constraints={
                "max_calls": min(filters.max_calls, len(phone_numbers)),
                "preferred_call_time": filters.preferred_call_time,
                "provided_phone_number_count": len(phone_numbers),
            },
            calls_required=True,
            online_search_enough=False,
            summary_criteria=[
                "Who accepted",
                "Who declined",
                "Who is unsure",
                "Who did not answer",
                "Follow-up needed",
            ],
            output_format="call_outcome_tracker",
        )

    def _default_questions(self, text: str, dietary: str | None) -> list[Question]:
        if any(
            word in text for word in ["doctor", "clinic", "physician", "medical", "appointment"]
        ):
            return self._appointment_questions(text)

        questions = [
            "Do you have happy hour today?",
            "What time does happy hour run?",
            "What food or drink specials are included?",
        ]
        if dietary:
            questions.extend(
                [
                    f"Do you offer {dietary} meal options?",
                    (
                        f"Are the {dietary} options dedicated menu items, "
                        "or do they require customization?"
                    ),
                ]
            )
        questions.append("Do guests usually need a reservation today?")

        if "happy hour" not in text:
            questions = [
                "Are you open and accepting customers today?",
                "What options best match the customer's request?",
                "Do guests need a reservation or appointment?",
            ]
        return [Question(id=f"q_{uuid4().hex[:8]}", text=question) for question in questions]

    def _questions_for_request(
        self,
        request_text: str,
        filters: SearchFilters,
        *,
        task_kind: str,
    ) -> list[Question]:
        text = request_text.lower()
        if task_kind == "direct_calls" or self._looks_like_direct_call_request(request_text):
            return self._direct_call_questions(request_text)
        dietary = filters.dietary_preference
        for option in ["vegan", "vegetarian", "gluten-free", "halal", "kosher"]:
            if option in text:
                dietary = option
                break
        return self._default_questions(text, dietary)

    def _looks_like_direct_call_request(self, request_text: str) -> bool:
        text = request_text.lower()
        direct_call_phrases = [
            "call the below",
            "call below",
            "call these",
            "call them",
            "call the following",
            "invite them",
            "track response",
            "track responses",
            "who says yes",
            "who said yes",
        ]
        return any(phrase in text for phrase in direct_call_phrases)

    def _appointment_questions(self, text: str) -> list[Question]:
        clinic_hint = " at Apple Tree near Harbour Street" if "apple tree" in text else ""
        questions = [
            (
                "I am calling on behalf of a user who wants to book a doctor's "
                f"appointment{clinic_hint}. "
                "Do you have doctor appointment availability?"
            ),
            "What is the earliest available appointment time or next booking window?",
            (
                "Can the user book by phone or online, and what non-medical information "
                "is required to complete booking?"
            ),
            (
                "Is this the correct location near Harbour Street, or is there another "
                "nearby branch they should contact?"
            ),
        ]
        return [Question(id=f"q_{uuid4().hex[:8]}", text=question) for question in questions]

    def _clinic_search_target(self, request_text: str) -> str:
        text = request_text.lower()
        parts = []
        if "apple tree" in text:
            parts.append("Apple Tree Medical")
        else:
            parts.append("doctor clinic")
        if "harbour" in text:
            parts.append("Harbour Street")
        elif "harbor" in text:
            parts.append("Harbor Street")
        if "near me" in text:
            parts.append("near me")
        return " ".join(parts)

    def _direct_call_questions(self, request_text: str) -> list[Question]:
        """Non-LLM fallback for direct calls.

        The OpenAI parser is the primary path and produces specific,
        request-anchored questions for any quick request. This fallback only
        runs when OpenAI isn't configured or the call failed. We deliberately
        do NOT try to template-match the user's intent here (no "is this a
        dinner invite?" / "did they say 'ask if'?" pattern matching) — instead
        we relay the user's request verbatim and let the conversation agent
        handle the rest. That keeps this generic for any quick request.
        """
        question_text = self._build_relay_question(request_text)
        return [
            Question(id=f"q_{uuid4().hex[:8]}", text=question_text),
        ]

    def _direct_call_objective(self, request_text: str) -> str:
        """Non-LLM fallback objective. Relays the user's request verbatim."""
        cleaned = request_text.strip().rstrip(".?! ")
        if not cleaned:
            return "Relay the user's request and capture the response."
        return f"Relay the user's request to the contact and capture the response. Request: \"{cleaned}\"."

    def _build_relay_question(self, request_text: str) -> str:
        cleaned = request_text.strip().rstrip(".?! ")
        if not cleaned:
            return "Could you share a quick answer the user can act on?"
        return (
            f"The user's request is: \"{cleaned}\". "
            "Could you share your answer so I can pass it back?"
        )

    def _extract_phone_numbers(
        self,
        request_text: str,
        extra_numbers: list[str] | None = None,
    ) -> list[str]:
        candidates = list(extra_numbers or [])
        candidates.extend(
            match.group(0)
            for match in re.finditer(
                r"(?<!\w)(?:\+?\d[\d\s().-]{6,}\d)(?!\w)",
                request_text,
            )
        )
        normalized: list[str] = []
        for candidate in candidates:
            phone = self._normalize_phone_number(str(candidate))
            if phone and phone not in normalized:
                normalized.append(phone)
        return normalized

    def _normalize_phone_number(self, value: str) -> str | None:
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

    def _question_from_any(self, item: Any) -> Question:
        if isinstance(item, dict):
            return Question(
                id=str(item.get("id") or f"q_{uuid4().hex[:8]}"),
                text=str(item.get("text") or item.get("question") or ""),
                required=bool(item.get("required", True)),
            )
        return Question(id=f"q_{uuid4().hex[:8]}", text=str(item), required=True)
