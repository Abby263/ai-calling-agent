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
    "marketing call."
)

CALL_CLOSING_LINE = "Thank you so much. That's all I needed. Have a great day."


def ensure_allowed_intent(intent: ParsedIntent) -> None:
    normalized = intent.business_type.strip().lower()
    if normalized in BLOCKED_BUSINESS_TYPES:
        raise ValueError("This business category is not eligible for automated calls.")


def should_call_business(business: BusinessCandidate) -> tuple[bool, str | None]:
    if business.do_not_call:
        return False, "Business was marked do not call."
    if not business.phone:
        return False, "Business has no phone number."
    if business.business_status and business.business_status.upper() not in {
        "OPERATIONAL",
        "OPEN",
        "CALLABLE",
    }:
        return False, "Business is not operational."
    if business.open_now is False:
        return False, "Business appears closed right now."
    return True, None


def build_call_script(questions: list[Question]) -> str:
    question_lines = " ".join(
        build_numbered_question_prompt(question, index, len(approved_questions(questions)))
        for index, question in enumerate(approved_questions(questions))
    )
    return f"{DISCLOSURE_LINE} I have a few short questions. {question_lines} {CALL_CLOSING_LINE}"


def approved_questions(questions: list[Question]) -> list[Question]:
    return [question for question in questions if question.required and question.text.strip()]


def build_numbered_question_prompt(question: Question, index: int, total: int) -> str:
    if total <= 1:
        return question.text.strip()
    return f"Question {index + 1} of {total}: {question.text.strip()}"


def build_turn_prompt(questions: list[Question], question_index: int) -> str:
    filtered = approved_questions(questions)
    if not filtered:
        return f"{DISCLOSURE_LINE} I have one quick question. Please share the answer."
    question = filtered[min(question_index, len(filtered) - 1)]
    question_line = build_numbered_question_prompt(question, question_index, len(filtered))
    intro = (
        f"{DISCLOSURE_LINE} I have {len(filtered)} short question"
        f"{'s' if len(filtered) != 1 else ''}."
        if question_index == 0
        else "Thank you. Next question."
    )
    return f"{intro} {question_line}"


def build_disclosure_log() -> list[str]:
    return [
        "AI assistant disclosed at call start.",
        "Assistant stated it was calling on behalf of a user.",
        "Call purpose limited to the user-approved questions.",
    ]


def local_business_hours_note(timezone_name: str = "America/Toronto") -> str:
    now = datetime.now(ZoneInfo(timezone_name))
    return f"Call attempted at local time {now.strftime('%Y-%m-%d %H:%M %Z')}."
