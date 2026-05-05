from __future__ import annotations

from fastapi import HTTPException

from app.core.config import Settings
from app.db.store import InMemoryTaskStore
from app.schemas import (
    ApproveCallsRequest,
    CallStatus,
    TaskDetail,
    TaskPreviewRequest,
    TaskStatus,
)
from app.services.agents.call_planner import CallPlannerAgent
from app.services.agents.ranking import RankingAgent
from app.services.agents.request_parser import RequestParserAgent
from app.services.agents.search import SearchAgent
from app.services.agents.summary import SummaryAgent
from app.services.agents.transcript_extraction import TranscriptExtractionAgent
from app.services.agents.voice_call import VoiceCallAgent
from app.services.compliance import ensure_allowed_intent


class TaskOrchestrator:
    def __init__(self, settings: Settings, store: InMemoryTaskStore) -> None:
        self.settings = settings
        self.store = store
        self.parser = RequestParserAgent(settings)
        self.search = SearchAgent(settings)
        self.ranking = RankingAgent()
        self.call_planner = CallPlannerAgent(settings)
        self.voice = VoiceCallAgent(settings)
        self.extractor = TranscriptExtractionAgent(settings)
        self.summary = SummaryAgent(settings)

    async def preview(self, payload: TaskPreviewRequest) -> TaskDetail:
        intent = await self.parser.parse(payload)
        ensure_allowed_intent(intent)
        radius = payload.filters.radius_meters or intent.radius_meters
        payload.filters.radius_meters = radius
        businesses = await self.search.search(
            intent=intent,
            location=payload.location,
            filters=payload.filters,
        )
        ranked = self.ranking.rank(businesses, payload.filters)
        return self.store.create_preview(
            original_request=payload.original_request,
            parsed_intent=intent,
            location_lat=payload.location.lat,
            location_lng=payload.location.lng,
            location_label=payload.location.label,
            radius=radius,
            businesses=ranked,
        )

    async def approve_calls(self, task_id: str, payload: ApproveCallsRequest) -> TaskDetail:
        detail = self.store.get_task(task_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Task not found")
        if detail.task.status in {TaskStatus.CANCELLED, TaskStatus.COMPLETED}:
            raise HTTPException(status_code=409, detail=f"Task is already {detail.task.status}")

        planned, skipped = self.call_planner.plan(
            businesses=detail.businesses,
            questions=payload.questions,
            selected_business_ids=payload.business_ids,
            max_calls=payload.max_calls,
        )
        if not planned:
            raise HTTPException(status_code=400, detail={"message": "No eligible businesses to call", "skipped": skipped})

        calls = []
        for business in planned:
            call = await self.voice.place_call(
                task_id=detail.task.id,
                business=business,
                questions=payload.questions,
            )
            if call.transcript:
                call.extraction_json = await self.extractor.extract(call)
            calls.append(call)

        detail.calls = calls
        detail.task.status = TaskStatus.SUMMARIZING if all(call.transcript for call in calls) else TaskStatus.CALLING
        self.store.save_task(detail)

        if all(call.status == CallStatus.COMPLETED and call.extraction_json for call in calls):
            summary = await self.summary.summarize(detail)
            detail.summary = summary
            detail.task.status = TaskStatus.COMPLETED
            self.store.set_summary(detail.task.id, summary)
        return self.store.get_task(detail.task.id) or detail

    async def regenerate_summary(self, task_id: str) -> TaskDetail:
        detail = self.store.get_task(task_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Task not found")
        summary = await self.summary.summarize(detail)
        self.store.set_summary(task_id, summary)
        return self.store.get_task(task_id) or detail

