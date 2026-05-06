from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import httpx
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (
    Agent,
    AgentSession,
    ConversationItemAddedEvent,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.plugins import openai

load_dotenv()

AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "voice-concierge-caller")
AGENT_VOICE = os.getenv("LIVEKIT_AGENT_VOICE", "marin")
OPENAI_REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime")
WEBHOOK_SECRET = os.getenv("LIVEKIT_WEBHOOK_SECRET")


async def entrypoint(ctx: JobContext) -> None:
    metadata = _metadata(ctx)
    transcript: list[str] = []
    await ctx.connect()

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model=OPENAI_REALTIME_MODEL,
            voice=AGENT_VOICE,
        )
    )

    @session.on("conversation_item_added")
    def on_conversation_item_added(event: ConversationItemAddedEvent) -> None:
        role = getattr(event.item, "role", "unknown")
        text = getattr(event.item, "text_content", "") or ""
        if text.strip():
            transcript.append(f"{role}: {text.strip()}")

    @session.on("close")
    def on_close(event: object) -> None:
        error = getattr(event, "error", None)
        status = "failed" if error else "completed"
        notes = str(error) if error else None
        asyncio.create_task(_post_update(metadata, transcript, status=status, notes=notes))

    await session.start(
        room=ctx.room,
        agent=Agent(instructions=_instructions(metadata)),
    )
    await session.generate_reply(
        instructions=(
            "Start the call now. Disclose that you are an AI assistant calling on behalf of "
            "the user, ask the approved questions one at a time, listen to the answer after "
            "each question, then end politely."
        )
    )


def _metadata(ctx: JobContext) -> dict[str, Any]:
    raw = getattr(ctx.job, "metadata", "") or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _instructions(metadata: dict[str, Any]) -> str:
    questions = [
        str(item.get("text", "")).strip()
        for item in metadata.get("questions", [])
        if isinstance(item, dict) and str(item.get("text", "")).strip()
    ]
    question_block = "\n".join(f"{index}. {question}" for index, question in enumerate(questions, 1))
    target_name = metadata.get("business_name") or "the call recipient"
    return f"""You are Voice Concierge, a transparent AI caller.

You are calling {target_name} on behalf of a user.

Rules:
- Always disclose that you are an AI assistant.
- Say you are calling on behalf of the user.
- Do not sell, market, pressure, or ask for private personal information.
- Ask only the approved questions.
- Ask one question at a time and wait for the answer.
- Keep the call concise and polite.
- If the recipient asks not to continue, apologize and end the call.

Approved questions:
{question_block or "Ask what answer should be passed back to the user."}

End by thanking the recipient and saying goodbye."""


async def _post_update(
    metadata: dict[str, Any],
    transcript: list[str],
    *,
    status: str,
    notes: str | None = None,
) -> None:
    callback_url = metadata.get("callback_url")
    if not isinstance(callback_url, str) or not callback_url:
        return
    headers = {}
    if WEBHOOK_SECRET:
        headers["x-livekit-webhook-secret"] = WEBHOOK_SECRET
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(
            callback_url,
            headers=headers,
            json={
                "status": status,
                "transcript": "\n".join(transcript),
                "notes": notes,
                "ended": True,
            },
        )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name=AGENT_NAME))
