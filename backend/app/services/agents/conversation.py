"""ConversationAgent — drives natural, bounded outbound voice calls.

Given the call context (questions to ask, business / contact name, transcript so far)
the agent produces the next utterance the AI caller should speak. The agent is also
responsible for deciding when the call has reached its goal (or its hard limits) and
should be wrapped up.

The agent prefers an LLM (OpenAI) when configured. When OpenAI is unavailable it
falls back to a friendly scripted flow that still feels less robotic than asking
"Question 1 of 3 …".
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from app.core.config import Settings
from app.schemas import CallRecord, ParsedIntent, Question
from app.services.compliance import approved_questions

# Hard guard rails — the conversation cannot exceed these regardless of model output.
MAX_TURNS = 10
MAX_REPLY_WORDS = 35

DISCLOSURE_LINE = (
    "Hi, this is an AI assistant calling on behalf of a user. This is not a sales or "
    "marketing call."
)
CALL_CLOSING_LINE = "Thank you so much. That's all I needed. Have a great day."


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

    def opening(self, call: CallRecord, intent: ParsedIntent | None = None) -> ConversationTurn:
        """First thing the AI caller says when the line is picked up."""
        questions = approved_questions(call.questions)
        if not questions:
            return ConversationTurn(
                reply=f"{DISCLOSURE_LINE} Quick question and I'll let you go.",
                should_end=False,
            )

        if self._llm_enabled():
            llm_reply = self._llm_opening(call, intent, questions)
            if llm_reply:
                return ConversationTurn(reply=llm_reply, should_end=False)

        first = questions[0].text.strip().rstrip("?.")
        return ConversationTurn(
            reply=f"{DISCLOSURE_LINE} {first}?",
            should_end=False,
        )

    async def respond(
        self,
        *,
        call: CallRecord,
        last_utterance: str | None,
        turn_index: int,
        intent: ParsedIntent | None = None,
    ) -> ConversationTurn:
        """Decide what the caller should say next given the latest callee utterance."""
        questions = approved_questions(call.questions)
        history = _parse_transcript(call.transcript)

        # Hard cap turns regardless of what the LLM thinks.
        if turn_index >= MAX_TURNS:
            return ConversationTurn(reply=CALL_CLOSING_LINE, should_end=True)

        if self._llm_enabled():
            llm_turn = await self._llm_respond(
                call=call,
                intent=intent,
                questions=questions,
                history=history,
                last_utterance=last_utterance,
                turn_index=turn_index,
            )
            if llm_turn is not None:
                return _trim_turn(llm_turn)

        return _scripted_respond(
            questions=questions,
            history=history,
            last_utterance=last_utterance,
            turn_index=turn_index,
        )

    # ------------------------------------------------------------------
    # OpenAI-backed turns
    # ------------------------------------------------------------------

    def _llm_enabled(self) -> bool:
        return self.settings.openai_enabled

    def _llm_opening(
        self,
        call: CallRecord,
        intent: ParsedIntent | None,
        questions: list[Question],
    ) -> str | None:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=self.settings.openai_api_key)
            response = client.responses.create(
                model=self.settings.openai_model,
                input=[
                    {"role": "system", "content": _OPENING_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": json.dumps(
                            {
                                "callee_name": call.business_name,
                                "objective": intent.call_objective if intent else None,
                                "questions": [q.text for q in questions],
                            }
                        ),
                    },
                ],
            )
            text = (response.output_text or "").strip().strip('"').strip()
            if text and DISCLOSURE_LINE.split(".")[0].lower() in text.lower():
                return _truncate_words(text, MAX_REPLY_WORDS)
            if text:
                # Force the disclosure into the very first turn no matter what.
                return _truncate_words(f"{DISCLOSURE_LINE} {text}", MAX_REPLY_WORDS)
        except Exception:
            return None
        return None

    async def _llm_respond(
        self,
        *,
        call: CallRecord,
        intent: ParsedIntent | None,
        questions: list[Question],
        history: list[dict[str, str]],
        last_utterance: str | None,
        turn_index: int,
    ) -> ConversationTurn | None:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=self.settings.openai_api_key)
            payload = {
                "callee_name": call.business_name,
                "objective": intent.call_objective if intent else None,
                "questions": [
                    {"id": q.id, "text": q.text} for q in questions
                ],
                "transcript_so_far": history,
                "last_callee_utterance": last_utterance,
                "turn_index": turn_index,
                "max_turns": MAX_TURNS,
            }
            response = await client.responses.create(
                model=self.settings.openai_model,
                input=[
                    {"role": "system", "content": _RESPOND_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload)},
                ],
                text={"format": {"type": "json_object"}},
            )
            data = json.loads(response.output_text)
            reply = (data.get("reply") or "").strip()
            if not reply:
                return None
            should_end = bool(data.get("should_end"))
            answers = data.get("answers")
            if isinstance(answers, dict):
                answers = {str(k): str(v) for k, v in answers.items() if v}
            else:
                answers = None
            return ConversationTurn(reply=reply, should_end=should_end, answers=answers)
        except Exception:
            return None


# ---------------------------------------------------------------------------
# Scripted fallback (used when OpenAI is not configured or fails)
# ---------------------------------------------------------------------------


def _scripted_respond(
    *,
    questions: list[Question],
    history: list[dict[str, str]],
    last_utterance: str | None,
    turn_index: int,
) -> ConversationTurn:
    """Friendlier-than-the-old-flow scripted responder.

    Each turn moves to the next required question once the previous one has been
    answered. If the callee asked a question (utterance ends with a question mark)
    we acknowledge briefly before steering back to the goal.
    """
    if not questions:
        return ConversationTurn(reply=CALL_CLOSING_LINE, should_end=True)

    # One AI turn per question already counted in history (skip the opening turn).
    asked_count = sum(1 for entry in history if entry["speaker"] == "AI")
    if asked_count >= len(questions):
        return ConversationTurn(reply=CALL_CLOSING_LINE, should_end=True)

    next_question = questions[asked_count].text.strip().rstrip("?.")
    prefix = ""
    if last_utterance and last_utterance.strip().endswith("?"):
        prefix = (
            "I'm just calling on behalf of a user, so I can't answer that — but "
        )
    elif last_utterance and asked_count > 0:
        prefix = "Got it — "

    reply = f"{prefix}{next_question}?".strip()
    if reply and reply[0].islower():
        reply = reply[0].upper() + reply[1:]
    return ConversationTurn(
        reply=_truncate_words(reply, MAX_REPLY_WORDS),
        should_end=False,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_transcript(transcript: str | None) -> list[dict[str, str]]:
    """Convert a transcript string of 'Speaker: text' lines into a list of turns."""
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


def _trim_turn(turn: ConversationTurn) -> ConversationTurn:
    return ConversationTurn(
        reply=_truncate_words(turn.reply, MAX_REPLY_WORDS),
        should_end=turn.should_end,
        answers=turn.answers,
    )


def _truncate_words(text: str, max_words: int) -> str:
    words = re.findall(r"\S+", text)
    if len(words) <= max_words:
        return text.strip()
    truncated = " ".join(words[:max_words]).rstrip(",;:")
    if not truncated.endswith((".", "!", "?")):
        truncated += "."
    return truncated


_OPENING_SYSTEM_PROMPT = """You are an AI phone caller making a brief, polite call on behalf of a user.

Write the OPENING utterance only. Constraints:
- Open with the AI disclosure: "Hi, this is an AI assistant calling on behalf of a user. This is not a sales or marketing call."
- Then ask the FIRST question naturally — phrased like a human, not numbered ("Question 1 of 3" is forbidden).
- Total length: under 25 words.
- Output ONLY the spoken text. No quotes, no JSON, no preamble.
"""

_RESPOND_SYSTEM_PROMPT = """You are an AI phone caller. You're mid-call and need to decide the next thing to say.

You will be given JSON with:
- callee_name: who you are calling
- objective: what the user asked you to find out
- questions: the list of questions the user approved (id + text)
- transcript_so_far: prior turns ([{speaker, text}])
- last_callee_utterance: what the callee just said
- turn_index: which AI turn this is (0 = first reply after the opening, etc.)
- max_turns: hard cap; you must wrap up before reaching it

Your job:
1. Keep replies natural, human-sounding, and short (1–2 sentences, ≤ 25 words).
2. Never repeat the AI disclosure — it was said in the opening.
3. If the callee asked a question, answer briefly, then steer back to the goal.
4. If their answer was unclear or partial, ask a quick clarifying follow-up.
5. Once every approved question has a clear answer (or the callee declined), wrap up warmly and set should_end=true.
6. If turn_index is close to max_turns and questions remain, ask the most important one and wrap up gracefully.
7. Do NOT invent facts about the user. If the callee asks for details you don't have, say you'll have the user follow up.

Return ONLY a JSON object with this exact shape:
{
  "reply": "<the next thing the AI should say, plain text, ≤25 words>",
  "answers": { "<question_id>": "<one-line summary of the callee's answer, if you got one this turn>" },
  "should_end": <true | false>
}

`answers` may be empty if no question was answered this turn. Do not include keys you didn't capture.
"""
