from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Form, HTTPException, Request, Response

from app.db.store import utc_now
from app.schemas import (
    ApproveCallsRequest,
    CallStatus,
    TaskDetail,
    TaskListItem,
    TaskPreviewRequest,
)
from app.services.agents.transcript_extraction import TranscriptExtractionAgent
from app.services.auth import AuthenticatedUser, ClerkAuthService
from app.services.compliance import build_call_script

router = APIRouter(prefix="/api")


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
    try:
        return await orchestrator(request).preview(payload, user_id=user.user_id if user else None)
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
        f"{request.app.state.settings.public_base_url}/api/webhooks/twilio/speech/{call.id}"
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
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="{speech_callback}" method="POST" timeout="8" speechTimeout="auto">
    <Say voice="alice">{_xml_escape(script)}</Say>
  </Gather>
  <Say voice="alice">Thank you. Goodbye.</Say>
</Response>"""
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


@router.post("/webhooks/twilio/speech/{call_id}")
async def twilio_speech(
    call_id: str,
    request: Request,
    SpeechResult: str | None = Form(default=None),
    Confidence: str | None = Form(default=None),
) -> Response:
    found = store(request).find_call(call_id)
    if not found:
        raise HTTPException(status_code=404, detail="Call not found")
    detail, call = found
    if SpeechResult:
        call.transcript = _build_speech_transcript(call, SpeechResult, Confidence)
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


def _build_speech_transcript(
    call,
    speech_result: str,
    confidence: str | None = None,
) -> str:
    suffix = f" (speech confidence {confidence})" if confidence else ""
    return (
        f"AI: {build_call_script(call.questions)}\n"
        f"{call.business_name}: {speech_result.strip()}{suffix}"
    )


def _xml_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
