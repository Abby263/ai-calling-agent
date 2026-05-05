from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from threading import RLock
from uuid import uuid4

from app.schemas import (
    BusinessCandidate,
    CallRecord,
    SearchTask,
    SummaryRecord,
    TaskDetail,
    TaskListItem,
    TaskStatus,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class InMemoryTaskStore:
    """Development store with the same shape as the Postgres schema.

    Production deployments should replace this with a repository backed by the SQL schema in
    app/db/schema.sql. Keeping the interface small makes that swap predictable.
    """

    def __init__(self) -> None:
        self._tasks: dict[str, TaskDetail] = {}
        self._lock = RLock()

    def create_preview(
        self,
        *,
        original_request: str,
        parsed_intent,
        location_lat: float | None,
        location_lng: float | None,
        location_label: str | None,
        radius: int,
        businesses: list[BusinessCandidate],
    ) -> TaskDetail:
        task_id = str(uuid4())
        task = SearchTask(
            id=task_id,
            original_request=original_request,
            parsed_intent_json=parsed_intent,
            location_lat=location_lat,
            location_lng=location_lng,
            location_label=location_label,
            radius=radius,
            status=TaskStatus.AWAITING_APPROVAL,
            created_at=utc_now(),
        )
        for business in businesses:
            business.task_id = task_id
        detail = TaskDetail(
            task=task,
            businesses=businesses,
            editable_questions=parsed_intent.required_questions,
        )
        for business in detail.businesses:
            business.id = str(uuid4())
            business.task_id = task_id
        with self._lock:
            self._tasks[task_id] = detail
        return deepcopy(detail)

    def list_tasks(self) -> list[TaskListItem]:
        with self._lock:
            details = list(self._tasks.values())
        return [
            TaskListItem(
                id=detail.task.id,
                original_request=detail.task.original_request,
                status=detail.task.status,
                created_at=detail.task.created_at,
                completed_at=detail.task.completed_at,
                business_count=len(detail.businesses),
                call_count=len(detail.calls),
            )
            for detail in sorted(details, key=lambda item: item.task.created_at, reverse=True)
        ]

    def get_task(self, task_id: str) -> TaskDetail | None:
        with self._lock:
            detail = self._tasks.get(task_id)
            return deepcopy(detail) if detail else None

    def save_task(self, detail: TaskDetail) -> TaskDetail:
        with self._lock:
            self._tasks[detail.task.id] = deepcopy(detail)
        return deepcopy(detail)

    def add_calls(self, task_id: str, calls: list[CallRecord]) -> TaskDetail | None:
        with self._lock:
            detail = self._tasks.get(task_id)
            if not detail:
                return None
            detail.calls = calls
            detail.task.status = TaskStatus.CALLING
            self._tasks[task_id] = detail
            return deepcopy(detail)

    def update_call(self, task_id: str, call: CallRecord) -> TaskDetail | None:
        with self._lock:
            detail = self._tasks.get(task_id)
            if not detail:
                return None
            detail.calls = [call if existing.id == call.id else existing for existing in detail.calls]
            self._tasks[task_id] = detail
            return deepcopy(detail)

    def find_call(self, call_id: str) -> tuple[TaskDetail, CallRecord] | None:
        with self._lock:
            for detail in self._tasks.values():
                for call in detail.calls:
                    if call.id == call_id:
                        return deepcopy(detail), deepcopy(call)
        return None

    def find_call_by_sid(self, call_sid: str) -> tuple[TaskDetail, CallRecord] | None:
        with self._lock:
            for detail in self._tasks.values():
                for call in detail.calls:
                    if call.call_sid == call_sid:
                        return deepcopy(detail), deepcopy(call)
        return None

    def set_summary(self, task_id: str, summary: SummaryRecord) -> TaskDetail | None:
        with self._lock:
            detail = self._tasks.get(task_id)
            if not detail:
                return None
            detail.summary = summary
            detail.task.status = TaskStatus.COMPLETED
            detail.task.completed_at = utc_now()
            self._tasks[task_id] = detail
            return deepcopy(detail)

    def cancel_task(self, task_id: str) -> TaskDetail | None:
        with self._lock:
            detail = self._tasks.get(task_id)
            if not detail:
                return None
            detail.task.status = TaskStatus.CANCELLED
            detail.task.completed_at = utc_now()
            self._tasks[task_id] = detail
            return deepcopy(detail)

    def delete_task(self, task_id: str) -> bool:
        with self._lock:
            return self._tasks.pop(task_id, None) is not None
