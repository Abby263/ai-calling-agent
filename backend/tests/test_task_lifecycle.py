from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.db.store import InMemoryTaskStore, utc_now
from app.schemas import CallRecord, CallStatus, ParsedIntent, SummaryRecord, TaskStatus
from app.services.orchestrator import TaskOrchestrator


@pytest.fixture
def run():
    store = InMemoryTaskStore()
    detail = store.create_preview(
        user_id="owner", original_request="Ask about dinner",
        parsed_intent=ParsedIntent(required_questions=[]),
        location_lat=None, location_lng=None, location_label=None,
        radius=3000, businesses=[],
    )
    agent = TaskOrchestrator(Settings(_env_file=None, DEMO_MODE=True), store)
    agent.extractor.extract = AsyncMock()
    agent.summary.summarize = AsyncMock()
    return store, detail, agent


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status", [None, CallStatus.PENDING, CallStatus.CALLING, CallStatus.ANSWERED]
)
async def test_results_reject_unfinished_calls(run, status):
    store, detail, agent = run
    if status:
        detail.calls = [CallRecord(id="call", task_id=detail.task.id, business_id="b",
                                   business_name="Contact", status=status)]
        detail.task.status = TaskStatus.CALLING
        store.save_task(detail)
    with pytest.raises(HTTPException) as error:
        await agent.regenerate_summary(detail.task.id, user_id="owner")
    assert error.value.status_code == 409
    agent.summary.summarize.assert_not_awaited()
    assert store.get_task(detail.task.id).task.status != TaskStatus.COMPLETED


@pytest.mark.asyncio
async def test_late_completion_does_not_reopen_cancelled_task(run):
    store, detail, agent = run
    detail.calls = [CallRecord(id="call", task_id=detail.task.id, business_id="b",
                               business_name="Contact", status=CallStatus.COMPLETED)]
    store.save_task(detail)
    store.cancel_task(detail.task.id, user_id="owner")
    updated = await agent.finalize_if_ready(detail.task.id, user_id="owner")
    assert updated.task.status == TaskStatus.CANCELLED
    agent.summary.summarize.assert_not_awaited()


@pytest.mark.asyncio
async def test_duplicate_completion_reuses_existing_summary(run):
    store, detail, agent = run
    store.set_summary(detail.task.id, SummaryRecord(
        id="summary", task_id=detail.task.id, final_summary="Done",
        recommendation_json={}, created_at=utc_now(),
    ))
    updated = await agent.finalize_if_ready(detail.task.id, user_id="owner")
    assert updated.summary.final_summary == "Done"
    agent.summary.summarize.assert_not_awaited()
