from __future__ import annotations

from datetime import datetime, timezone

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
from app.services.compliance import build_call_script

router = APIRouter(prefix="/api")


def orchestrator(request: Request):
    return request.app.state.orchestrator


def store(request: Request):
    return request.app.state.store


@router.post("/tasks/preview", response_model=TaskDetail)
async def preview_task(payload: TaskPreviewRequest, request: Request) -> TaskDetail:
    try:
        return await orchestrator(request).preview(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/tasks", response_model=list[TaskListItem])
async def list_tasks(request: Request) -> list[TaskListItem]:
    return store(request).list_tasks()


@router.get("/tasks/{task_id}", response_model=TaskDetail)
async def get_task(task_id: str, request: Request) -> TaskDetail:
    detail = store(request).get_task(task_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Task not found")
    return detail


@router.post("/tasks/{task_id}/approve-calls", response_model=TaskDetail)
async def approve_calls(
    task_id: str,
    payload: ApproveCallsRequest,
    request: Request,
) -> TaskDetail:
    return await orchestrator(request).approve_calls(task_id, payload)


@router.post("/tasks/{task_id}/summarize", response_model=TaskDetail)
async def summarize_task(task_id: str, request: Request) -> TaskDetail:
    return await orchestrator(request).regenerate_summary(task_id)


@router.post("/tasks/{task_id}/cancel", response_model=TaskDetail)
async def cancel_task(task_id: str, request: Request) -> TaskDetail:
    detail = store(request).cancel_task(task_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Task not found")
    return detail


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str, request: Request) -> Response:
    deleted = store(request).delete_task(task_id)
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
    recording_attrs = (
        f' transcribe="true" transcribeCallback="{transcribe_callback}"'
        if request.app.state.settings.allow_call_recording
        else ""
    )
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">{_xml_escape(script)}</Say>
  <Pause length="1"/>
  <Record maxLength="120" playBeep="false"{recording_attrs}/>
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
    store(request).update_call(detail.task.id, call)
    return {"ok": "true"}


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
    call.ended_at = datetime.now(timezone.utc)
    call.extraction_json = await TranscriptExtractionAgent(request.app.state.settings).extract(call)
    updated = store(request).update_call(detail.task.id, call)
    if updated and all(existing.status == CallStatus.COMPLETED for existing in updated.calls):
        await orchestrator(request).regenerate_summary(updated.task.id)
    return {"ok": "true"}


CallStatusEnum = CallStatus


def _map_twilio_status(status: str | None, answered_by: str | None) -> CallStatus:
    normalized = (status or "").lower()
    if answered_by == "machine":
        return CallStatus.VOICEMAIL
    if normalized in {"queued", "initiated", "ringing", "in-progress"}:
        return CallStatus.CALLING
    if normalized in {"busy", "no-answer", "canceled"}:
        return CallStatus.NO_ANSWER
    if normalized == "failed":
        return CallStatus.FAILED
    if normalized == "completed":
        return CallStatus.COMPLETED
    return CallStatus.PENDING


def _xml_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )

