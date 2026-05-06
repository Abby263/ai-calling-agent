from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Form, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.db.store import utc_now
from app.schemas import (
    ApproveCallsRequest,
    CallExtraction,
    CallStatus,
    TaskDetail,
    TaskListItem,
    TaskPreviewRequest,
)
from app.services.agents.transcript_extraction import TranscriptExtractionAgent
from app.services.auth import AuthenticatedUser, ClerkAuthService
from app.services.compliance import (
    CALL_CLOSING_LINE,
    approved_questions,
    build_call_script,
    build_turn_prompt,
)

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
    return await orchestrator(request).approve_calls(
        task_id,
        payload,
        user_id=user.user_id if user else None,
    )


@router.post("/tasks/{task_id}/summarize", response_model=TaskDetail)
async def summarize_task(task_id: str, request: Request) -> TaskDetail:
    user = task_user(request)
    return await orchestrator(request).regenerate_summary(
        task_id,
        user_id=user.user_id if user else None,
    )


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
    found = store(request).find_call(call_id)
    if not found:
        raise HTTPException(status_code=404, detail="Call not found")
    _, call = found
    script = build_call_script(call.questions)
    transcribe_callback = (
        f"{request.app.state.settings.public_base_url}/api/webhooks/twilio/transcript/{call.id}"
    )
    speech_callback = (
        f"{request.app.state.settings.public_base_url}/api/webhooks/twilio/speech/{call.id}/0"
    )
    if request.app.state.settings.allow_call_recording:
        record_attrs = (
            'maxLength="120" playBeep="false" transcribe="true" '
            f'transcribeCallback="{transcribe_callback}"'
        )
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">{_xml_escape(script)}</Say>
  <Pause length="1"/>
  <Record {record_attrs}/>
  <Say voice="alice">Thank you. Goodbye.</Say>
</Response>"""
    else:
        twiml = _speech_gather_twiml(
            action_url=speech_callback,
            prompt=build_turn_prompt(call.questions, 0),
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


@router.post("/webhooks/twilio/speech/{call_id}/{question_index}")
async def twilio_speech(
    call_id: str,
    question_index: int,
    request: Request,
    SpeechResult: str | None = Form(default=None),
    Confidence: str | None = Form(default=None),
) -> Response:
    found = store(request).find_call(call_id)
    if not found:
        raise HTTPException(status_code=404, detail="Call not found")
    detail, call = found
    call.transcript = _append_speech_turn(
        transcript=call.transcript,
        questions=call.questions,
        question_index=question_index,
        speech_result=SpeechResult,
        confidence=Confidence,
    )
    questions = approved_questions(call.questions)
    next_index = question_index + 1
    if next_index < len(questions):
        call.status = CallStatus.CALLING
        store(request).update_call(detail.task.id, call)
        next_callback = (
            f"{request.app.state.settings.public_base_url}"
            f"/api/webhooks/twilio/speech/{call.id}/{next_index}"
        )
        return Response(
            content=_speech_gather_twiml(
                action_url=next_callback,
                prompt=build_turn_prompt(call.questions, next_index),
            ),
            media_type="application/xml",
        )

    call.status = CallStatus.COMPLETED
    call.ended_at = utc_now()
    call.extraction_json = await TranscriptExtractionAgent(request.app.state.settings).extract(call)
    updated = store(request).update_call(detail.task.id, call)
    if updated:
        await orchestrator(request).finalize_if_ready(updated.task.id)
    twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you. That is all I needed. Goodbye.</Say>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


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


def _speech_gather_twiml(*, action_url: str, prompt: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<Response>\n"
        f'  <Gather input="speech" action="{action_url}" method="POST" '
        'timeout="8" speechTimeout="auto" actionOnEmptyResult="true">\n'
        f"    <Say voice=\"alice\">{_xml_escape(prompt)}</Say>\n"
        "  </Gather>\n"
        f"  <Say voice=\"alice\">{_xml_escape(CALL_CLOSING_LINE)}</Say>\n"
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
