from datetime import datetime
from zoneinfo import ZoneInfo

from app.schemas import BusinessCandidate, ParsedIntent, Question


BLOCKED_BUSINESS_TYPES = {
    "emergency",
    "emergency services",
    "police",
    "fire department",
    "hospital emergency",
    "crisis hotline",
}


DISCLOSURE_LINE = (
    "Hi, this is an AI assistant calling on behalf of a user. This is not a sales or "
    "marketing call. I have a quick message and a few short questions."
)


def ensure_allowed_intent(intent: ParsedIntent) -> None:
    normalized = intent.business_type.strip().lower()
    if normalized in BLOCKED_BUSINESS_TYPES:
        raise ValueError("This business category is not eligible for automated calls.")


def should_call_business(business: BusinessCandidate) -> tuple[bool, str | None]:
    if business.do_not_call:
        return False, "Business was marked do not call."
    if not business.phone:
        return False, "Business has no phone number."
    if business.business_status and business.business_status.upper() not in {"OPERATIONAL", "OPEN", "CALLABLE"}:
        return False, "Business is not operational."
    if business.open_now is False:
        return False, "Business appears closed right now."
    return True, None


def build_call_script(questions: list[Question]) -> str:
    question_lines = " ".join(question.text for question in questions if question.required)
    return (
        f"{DISCLOSURE_LINE} {question_lines} Thank you so much. That's all I needed. "
        "Have a great day."
    )


def build_disclosure_log() -> list[str]:
    return [
        "AI assistant disclosed at call start.",
        "Assistant stated it was calling on behalf of a user.",
        "Call purpose limited to the user-approved questions.",
    ]


def local_business_hours_note(timezone_name: str = "America/Toronto") -> str:
    now = datetime.now(ZoneInfo(timezone_name))
    return f"Call attempted at local time {now.strftime('%Y-%m-%d %H:%M %Z')}."
