from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Form, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.db.store import utc_now
from app.prompts import CALL_CLOSING_LINE, CALL_FAILURE_LINE
from app.schemas import (
    ApproveCallsRequest,
    CallExtraction,
    CallStatus,
    TaskDetail,
    TaskListItem,
    TaskPreviewRequest,
)
from app.services.agents.conversation import ConversationAgent
from app.services.agents.transcript_extraction import TranscriptExtractionAgent
from app.services.auth import AuthenticatedUser, ClerkAuthService
from app.services.compliance import approved_questions, build_call_script
from app.services.errors import AgentError, ConfigurationError, LLMUnavailableError

router = APIRouter(prefix="/api")


class LiveKitCallUpdate(BaseModel):
    status: CallStatus = CallStatus.COMPLETED
    transcript: str | None = None
    recording_url: str | None = None
    extraction_json: CallExtraction | None = None
    notes: str | None = None
    ended: bool = Field(default=True)


def orchestrator(request: Request):
    return request.app.state.orchestrator


def store(request: Request):
    return request.app.state.store


def auth(request: Request) -> ClerkAuthService:
    return ClerkAuthService(request.app.state.settings)


def task_user(request: Request) -> AuthenticatedUser | None:
    return auth(request).require_user(request)


@router.get("/auth/session")
async def auth_session(request: Request) -> dict[str, object]:
    return auth(request).session_payload(request)


@router.post("/tasks/preview", response_model=TaskDetail)
async def preview_task(payload: TaskPreviewRequest, request: Request) -> TaskDetail:
    user = task_user(request)
    _enforce_request_quota(request, user)
    try:
        detail = await orchestrator(request).preview(
            payload,
            user_id=user.user_id if user else None,
        )
        _consume_request_quota(request, user)
        return detail
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (ConfigurationError, LLMUnavailableError) as exc:
        # The user explicitly opted into LLM-driven behaviour. When the LLM
        # can't help, we surface the reason rather than producing a templated
        # response.
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/tasks", response_model=list[TaskListItem])
async def list_tasks(request: Request) -> list[TaskListItem]:
    user = task_user(request)
    return store(request).list_tasks(user_id=user.user_id if user else None)


@router.get("/tasks/{task_id}", response_model=TaskDetail)
async def get_task(task_id: str, request: Request) -> TaskDetail:
    user = task_user(request)
    detail = store(request).get_task(task_id, user_id=user.user_id if user else None)
    if not detail:
        raise HTTPException(status_code=404, detail="Task not found")
    return detail


@router.post("/tasks/{task_id}/approve-calls", response_model=TaskDetail)
async def approve_calls(
    task_id: str,
    payload: ApproveCallsRequest,
    request: Request,
) -> TaskDetail:
    user = task_user(request)
    try:
        return await orchestrator(request).approve_calls(
            task_id,
            payload,
            user_id=user.user_id if user else None,
        )
    except (ConfigurationError, LLMUnavailableError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/tasks/{task_id}/summarize", response_model=TaskDetail)
async def summarize_task(task_id: str, request: Request) -> TaskDetail:
    user = task_user(request)
    try:
        return await orchestrator(request).regenerate_summary(
            task_id,
            user_id=user.user_id if user else None,
        )
    except (ConfigurationError, LLMUnavailableError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/tasks/{task_id}/cancel", response_model=TaskDetail)
async def cancel_task(task_id: str, request: Request) -> TaskDetail:
    user = task_user(request)
    detail = store(request).cancel_task(task_id, user_id=user.user_id if user else None)
    if not detail:
        raise HTTPException(status_code=404, detail="Task not found")
    return detail


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str, request: Request) -> Response:
    user = task_user(request)
    deleted = store(request).delete_task(task_id, user_id=user.user_id if user else None)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=204)


@router.delete("/tasks", status_code=204)
async def delete_tasks(request: Request) -> Response:
    user = task_user(request)
    store(request).delete_tasks(user_id=user.user_id if user else None)
    return Response(status_code=204)


@router.post("/webhooks/twilio/voice/{call_id}")
async def twilio_voice(call_id: str, request: Request) -> Response:
    """Initial TwiML when Twilio picks up the line.

    Drives a natural opening utterance (AI disclosure + first question) and asks
    Twilio to gather speech for the next turn.
    """
    found = store(request).find_call(call_id)
    if not found:
        raise HTTPException(status_code=404, detail="Call not found")
    detail, call = found
    settings = request.app.state.settings

    if settings.allow_call_recording:
        # Recording mode (opt-in via ALLOW_CALL_RECORDING) plays the approved
        # script once and records the callee's response. It uses
        # `build_call_script` to compose a one-shot read of the approved
        # questions; this is intentionally NOT the conversational LLM path.
        voice = settings.voice_tts_voice
        script = build_call_script(call.questions)
        transcribe_callback = (
            f"{settings.public_base_url}/api/webhooks/twilio/transcript/{call.id}"
        )
        record_attrs = (
            'maxLength="120" playBeep="false" transcribe="true" '
            f'transcribeCallback="{transcribe_callback}"'
        )
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="{voice}">{_xml_escape(script)}</Say>
  <Pause length="1"/>
  <Record {record_attrs}/>
  <Say voice="{voice}">{_xml_escape(CALL_CLOSING_LINE)}</Say>
</Response>"""
        return Response(content=twiml, media_type="application/xml")

    intent = detail.task.parsed_intent_json if detail else None
    caller_name = detail.task.caller_display_name if detail else None
    try:
        opening = ConversationAgent(settings).opening(
            call,
            intent=intent,
            caller_display_name=caller_name,
        )
    except AgentError as exc:
        return await _abort_call_with_failure(request, detail, call, reason=str(exc))

    call.transcript = _append_turn(call.transcript, "AI", opening.reply)
    store(request).update_call(detail.task.id, call)

    next_url = (
        f"{settings.public_base_url}/api/webhooks/twilio/speech/{call.id}/1"
    )
    twiml = _speech_gather_twiml(
        settings=settings, action_url=next_url, prompt=opening.reply
    )
    return Response(content=twiml, media_type="application/xml")


@router.post("/webhooks/twilio/status/{call_id}")
async def twilio_status(
    call_id: str,
    request: Request,
    CallSid: str | None = Form(default=None),
    CallStatus: str | None = Form(default=None),
    AnsweredBy: str | None = Form(default=None),
) -> dict[str, str]:
    found = store(request).find_call(call_id)
    if not found:
        raise HTTPException(status_code=404, detail="Call not found")
    detail, call = found
    call.call_sid = call.call_sid or CallSid
    call.status = _map_twilio_status(CallStatus, AnsweredBy)
    if call.status in {CallStatusEnum.COMPLETED, CallStatusEnum.FAILED, CallStatusEnum.NO_ANSWER}:
        call.ended_at = utc_now()
    elif not call.started_at:
        call.started_at = utc_now()
    updated = store(request).update_call(detail.task.id, call)
    if updated and call.status in {
        CallStatusEnum.COMPLETED,
        CallStatusEnum.FAILED,
        CallStatusEnum.NO_ANSWER,
        CallStatusEnum.VOICEMAIL,
    }:
        await orchestrator(request).finalize_if_ready(updated.task.id)
    return {"ok": "true"}


@router.post("/webhooks/twilio/speech/{call_id}/{turn_index}")
async def twilio_speech(
    call_id: str,
    turn_index: int,
    request: Request,
    SpeechResult: str | None = Form(default=None),
    Confidence: str | None = Form(default=None),
) -> Response:
    """One conversational turn.

    The path's `turn_index` is 1-based and counts how many AI turns have already
    been spoken (the opening utterance is turn 0). On each call we record what
    the callee said, ask the ConversationAgent for the next reply, and either
    keep gathering or wrap up.
    """
    found = store(request).find_call(call_id)
    if not found:
        raise HTTPException(status_code=404, detail="Call not found")
    detail, call = found
    settings = request.app.state.settings

    callee_text = (SpeechResult or "").strip()
    if callee_text:
        suffix = f" (confidence {Confidence})" if Confidence else ""
        call.transcript = _append_turn(
            call.transcript,
            "Callee",
            f"{callee_text}{suffix}",
        )

    elapsed = _elapsed_seconds(call)
    over_time = elapsed >= settings.voice_max_call_seconds
    over_turns = turn_index > settings.voice_max_turns

    if over_time or over_turns:
        return await _end_call(request, detail, call, reply=CALL_CLOSING_LINE)

    intent = detail.task.parsed_intent_json if detail else None
    caller_name = detail.task.caller_display_name if detail else None
    try:
        turn = await ConversationAgent(settings).respond(
            call=call,
            last_utterance=callee_text or None,
            turn_index=turn_index,
            intent=intent,
            caller_display_name=caller_name,
        )
    except AgentError as exc:
        return await _abort_call_with_failure(request, detail, call, reason=str(exc))

    call.transcript = _append_turn(call.transcript, "AI", turn.reply)
    call.status = CallStatus.CALLING
    store(request).update_call(detail.task.id, call)

    if turn.should_end:
        return await _end_call(request, detail, call, reply=turn.reply, already_appended=True)

    next_url = (
        f"{settings.public_base_url}/api/webhooks/twilio/speech/{call.id}/{turn_index + 1}"
    )
    return Response(
        content=_speech_gather_twiml(
            settings=settings, action_url=next_url, prompt=turn.reply
        ),
        media_type="application/xml",
    )


@router.post("/webhooks/twilio/transcript/{call_id}")
async def twilio_transcript(
    call_id: str,
    request: Request,
    TranscriptionText: str | None = Form(default=None),
    RecordingUrl: str | None = Form(default=None),
) -> dict[str, str]:
    found = store(request).find_call(call_id)
    if not found:
        raise HTTPException(status_code=404, detail="Call not found")
    detail, call = found
    call.transcript = TranscriptionText
    call.recording_url = RecordingUrl
    call.status = CallStatus.COMPLETED
    call.ended_at = datetime.now(UTC)
    call.extraction_json = await TranscriptExtractionAgent(request.app.state.settings).extract(call)
    updated = store(request).update_call(detail.task.id, call)
    if updated:
        await orchestrator(request).finalize_if_ready(updated.task.id)
    return {"ok": "true"}


@router.post("/webhooks/livekit/calls/{call_id}")
async def livekit_call_update(
    call_id: str,
    payload: LiveKitCallUpdate,
    request: Request,
) -> dict[str, str]:
    _verify_livekit_webhook(request)
    found = store(request).find_call(call_id)
    if not found:
        raise HTTPException(status_code=404, detail="Call not found")
    detail, call = found
    call.status = payload.status
    call.transcript = payload.transcript or call.transcript
    call.recording_url = payload.recording_url or call.recording_url
    call.extraction_json = payload.extraction_json or call.extraction_json
    if payload.notes:
        note = f"LiveKit worker: {payload.notes}"
        call.transcript = f"{call.transcript}\n{note}".strip() if call.transcript else note
    if payload.ended or payload.status in {
        CallStatus.COMPLETED,
        CallStatus.FAILED,
        CallStatus.NO_ANSWER,
        CallStatus.VOICEMAIL,
    }:
        call.ended_at = call.ended_at or utc_now()
    if call.status in {
        CallStatus.COMPLETED,
        CallStatus.FAILED,
        CallStatus.NO_ANSWER,
        CallStatus.VOICEMAIL,
    } and call.extraction_json is None:
        extractor = TranscriptExtractionAgent(request.app.state.settings)
        call.extraction_json = await extractor.extract(call)
    updated = store(request).update_call(detail.task.id, call)
    if updated and call.status in {
        CallStatus.COMPLETED,
        CallStatus.FAILED,
        CallStatus.NO_ANSWER,
        CallStatus.VOICEMAIL,
    }:
        await orchestrator(request).finalize_if_ready(updated.task.id)
    return {"ok": "true"}


CallStatusEnum = CallStatus


def _map_twilio_status(status: str | None, answered_by: str | None) -> CallStatus:
    normalized = (status or "").lower()
    if answered_by == "machine":
        return CallStatus.VOICEMAIL
    if normalized in {"queued", "initiated", "ringing", "answered", "in-progress"}:
        return CallStatus.CALLING
    if normalized in {"busy", "no-answer", "canceled"}:
        return CallStatus.NO_ANSWER
    if normalized == "failed":
        return CallStatus.FAILED
    if normalized == "completed":
        return CallStatus.COMPLETED
    return CallStatus.PENDING


def _append_speech_turn(
    *,
    transcript: str | None,
    questions,
    question_index: int,
    speech_result: str | None,
    confidence: str | None = None,
) -> str:
    """Legacy helper kept for the test suite — single AI question, single answer."""
    filtered = approved_questions(questions)
    question_text = (
        filtered[question_index].text.strip()
        if 0 <= question_index < len(filtered)
        else "Approved question"
    )
    answer = speech_result.strip() if speech_result else "No answer captured."
    suffix = f" Speech confidence: {confidence}." if confidence else ""
    current = transcript.strip() if transcript else ""
    turn = f"AI: {question_text}\nCallee: {answer}{suffix}"
    return f"{current}\n{turn}".strip() if current else turn


def _append_turn(transcript: str | None, speaker: str, text: str) -> str:
    text = text.strip()
    if not text:
        return transcript or ""
    line = f"{speaker}: {text}"
    if not transcript:
        return line
    return f"{transcript.strip()}\n{line}"


def _elapsed_seconds(call) -> float:
    if not call.started_at:
        return 0.0
    now = datetime.now(UTC)
    delta = now - call.started_at
    return max(delta.total_seconds(), 0.0)


async def _end_call(request, detail, call, *, reply: str, already_appended: bool = False) -> Response:
    """Speak the closing reply, hang up, and finalize the call before returning.

    NOTE: finalization (extraction + summary) runs synchronously here. The
    earlier fire-and-forget `asyncio.create_task` was unreliable on Vercel
    serverless — the lambda is killed once the response returns, so the
    background extraction silently dropped, leaving the UI without a decision
    or summary. Inline finalization costs Twilio an extra second on the
    closing turn but guarantees the decision is in the store by the time the
    user polls.
    """
    settings = request.app.state.settings
    if not already_appended:
        call.transcript = _append_turn(call.transcript, "AI", reply)
    call.status = CallStatus.COMPLETED
    call.ended_at = utc_now()
    store(request).update_call(detail.task.id, call)

    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<Response>\n"
        f"  <Say voice=\"{settings.voice_tts_voice}\">{_xml_escape(reply)}</Say>\n"
        "  <Hangup/>\n"
        "</Response>"
    )

    try:
        if call.extraction_json is None:
            call.extraction_json = await TranscriptExtractionAgent(settings).extract(call)
            store(request).update_call(detail.task.id, call)
        await orchestrator(request).finalize_if_ready(detail.task.id)
    except AgentError as exc:
        # Persist the failure reason on the transcript so the dashboard shows
        # the user *why* extraction/summary couldn't complete instead of going
        # silent. The Twilio status callback will retry finalize when it reports
        # the call as completed.
        call.transcript = _append_turn(
            call.transcript,
            "System",
            f"Finalization failed: {exc}",
        )
        store(request).update_call(detail.task.id, call)
    return Response(content=twiml, media_type="application/xml")


async def _abort_call_with_failure(request, detail, call, *, reason: str) -> Response:
    """Mid-call agent failure: hang up gracefully, persist the reason, finalize.

    Called when the LLM is unreachable while a Twilio call is live. We say a
    short apology (`CALL_FAILURE_LINE`) and hang up — the dashboard surfaces
    `reason` on the call's transcript so the user sees what happened.
    """
    settings = request.app.state.settings
    call.transcript = _append_turn(
        call.transcript,
        "System",
        f"AI agent unavailable: {reason}",
    )
    call.transcript = _append_turn(call.transcript, "AI", CALL_FAILURE_LINE)
    call.status = CallStatus.FAILED
    call.ended_at = utc_now()
    store(request).update_call(detail.task.id, call)

    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<Response>\n"
        f"  <Say voice=\"{settings.voice_tts_voice}\">"
        f"{_xml_escape(CALL_FAILURE_LINE)}</Say>\n"
        "  <Hangup/>\n"
        "</Response>"
    )
    try:
        await orchestrator(request).finalize_if_ready(detail.task.id)
    except AgentError:
        pass  # already recorded the failure on the transcript
    return Response(content=twiml, media_type="application/xml")


def _speech_gather_twiml(*, settings, action_url: str, prompt: str) -> str:
    """TwiML that speaks the prompt and gathers a natural speech response.

    Tuning is config-driven (see Settings.voice_*):
      - `timeout`: initial silence before we treat it as no answer.
      - `speechTimeout="auto"`: Twilio detects end-of-utterance dynamically.
      - `speechModel`: configurable; defaults to "phone_call" which works on
        every Twilio account.
      - `actionOnEmptyResult="true"`: hand control back to the next webhook
        even if the callee was silent, so the agent can prompt again instead
        of the line dying.
    """
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<Response>\n"
        f'  <Gather input="speech" action="{action_url}" method="POST" '
        f'timeout="{settings.voice_gather_initial_silence_seconds}" '
        'speechTimeout="auto" '
        f'speechModel="{settings.voice_speech_model}" '
        'actionOnEmptyResult="true">\n'
        f"    <Say voice=\"{settings.voice_tts_voice}\">{_xml_escape(prompt)}</Say>\n"
        "  </Gather>\n"
        f"  <Say voice=\"{settings.voice_tts_voice}\">{_xml_escape(CALL_CLOSING_LINE)}</Say>\n"
        "  <Hangup/>\n"
        "</Response>"
    )


def _xml_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _verify_livekit_webhook(request: Request) -> None:
    expected_secret = request.app.state.settings.livekit_webhook_secret
    if not expected_secret:
        return
    supplied_secret = request.headers.get("x-livekit-webhook-secret")
    if supplied_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Invalid LiveKit webhook secret.")


def _enforce_request_quota(request: Request, user: AuthenticatedUser | None) -> None:
    if not user or _has_unlimited_requests(request, user):
        return
    free_limit = request.app.state.settings.free_request_limit
    used = store(request).get_request_count(user.user_id)
    if used >= free_limit:
        raise HTTPException(
            status_code=402,
            detail=(
                f"The free plan includes {free_limit} concierge request"
                f"{'' if free_limit == 1 else 's'}. Upgrade to run more tasks."
            ),
        )


def _consume_request_quota(request: Request, user: AuthenticatedUser | None) -> None:
    if not user or _has_unlimited_requests(request, user):
        return
    store(request).increment_request_count(user.user_id)


def _has_unlimited_requests(request: Request, user: AuthenticatedUser) -> bool:
    settings = request.app.state.settings
    email = user.email.lower() if user.email else None
    return (
        user.subject in settings.admin_clerk_subjects
        or (email is not None and email in settings.admin_emails)
        or (email is not None and email in settings.paid_user_emails)
    )
