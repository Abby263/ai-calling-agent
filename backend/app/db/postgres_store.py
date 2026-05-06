from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.db.store import utc_now
from app.schemas import (
    BusinessCandidate,
    CallExtraction,
    CallRecord,
    Question,
    SearchTask,
    SummaryRecord,
    TaskDetail,
    TaskListItem,
    TaskStatus,
)

SCHEMA_SQL_PATH = Path(__file__).with_name("schema.sql")


class PostgresTaskStore:
    """PostgreSQL implementation of the task store contract.

    The API uses this store when `DEMO_MODE=false` and `DATABASE_URL` is configured.
    """

    def __init__(self, database_url: str, *, initialize_schema: bool = True) -> None:
        self.pool = ConnectionPool(
            database_url,
            kwargs={"row_factory": dict_row, "prepare_threshold": None},
        )
        if initialize_schema:
            self.initialize_schema()

    def initialize_schema(self) -> None:
        schema_sql = SCHEMA_SQL_PATH.read_text(encoding="utf-8")
        with self.pool.connection() as conn:
            conn.execute(schema_sql)

    def create_preview(
        self,
        *,
        user_id: str | None = None,
        original_request: str,
        parsed_intent,
        location_lat: float | None,
        location_lng: float | None,
        location_label: str | None,
        radius: int,
        businesses: list[BusinessCandidate],
        caller_display_name: str | None = None,
    ) -> TaskDetail:
        task_id = str(uuid4())
        with self.pool.connection() as conn:
            with conn.transaction():
                conn.execute(
                    """
                    insert into search_tasks (
                      id, user_id, original_request, parsed_intent_json, location_lat, location_lng,
                      location_label, radius, status, created_at, caller_display_name
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        task_id,
                        user_id,
                        original_request,
                        Jsonb(parsed_intent.model_dump(mode="json")),
                        location_lat,
                        location_lng,
                        location_label,
                        radius,
                        TaskStatus.AWAITING_APPROVAL,
                        utc_now(),
                        caller_display_name,
                    ),
                )
                for business in businesses:
                    business.id = str(uuid4())
                    business.task_id = task_id
                    self._insert_business(conn, business)
        detail = self.get_task(task_id)
        if detail is None:
            raise RuntimeError("Failed to create task preview.")
        detail.editable_questions = parsed_intent.required_questions
        return detail

    def ensure_user(self, *, external_subject: str, email: str | None, name: str | None) -> str:
        with self.pool.connection() as conn:
            with conn.transaction():
                row = None
                if email:
                    row = conn.execute(
                        "select id from users where lower(email) = lower(%s)",
                        (email,),
                    ).fetchone()
                if not row:
                    row = conn.execute(
                        "select id from users where external_subject = %s",
                        (external_subject,),
                    ).fetchone()
                if row:
                    conn.execute(
                        """
                        update users
                        set external_subject = coalesce(external_subject, %s),
                            email = coalesce(%s, email),
                            name = coalesce(%s, name)
                        where id = %s
                        """,
                        (external_subject, email, name, row["id"]),
                    )
                    return str(row["id"])

                created = conn.execute(
                    """
                    insert into users (external_subject, email, name)
                    values (%s, %s, %s)
                    returning id
                    """,
                    (external_subject, email, name),
                ).fetchone()
        return str(created["id"])

    def get_request_count(self, user_id: str) -> int:
        with self.pool.connection() as conn:
            row = conn.execute(
                "select request_count from users where id = %s",
                (user_id,),
            ).fetchone()
        return int(row["request_count"] or 0) if row else 0

    def increment_request_count(self, user_id: str) -> int:
        with self.pool.connection() as conn:
            with conn.transaction():
                row = conn.execute(
                    """
                    update users
                    set request_count = request_count + 1
                    where id = %s
                    returning request_count
                    """,
                    (user_id,),
                ).fetchone()
        return int(row["request_count"] or 0) if row else 0

    def list_tasks(self, user_id: str | None = None) -> list[TaskListItem]:
        where_clause = "where t.user_id = %s" if user_id else ""
        params = (user_id,) if user_id else ()
        with self.pool.connection() as conn:
            rows = conn.execute(
                f"""
                select
                  t.id,
                  t.original_request,
                  t.status,
                  t.created_at,
                  t.completed_at,
                  count(distinct b.id) as business_count,
                  count(distinct c.id) as call_count
                from search_tasks t
                left join businesses b on b.task_id = t.id
                left join calls c on c.task_id = t.id
                {where_clause}
                group by t.id
                order by t.created_at desc
                limit 100
                """,
                params,
            ).fetchall()
        return [
            TaskListItem(
                id=str(row["id"]),
                original_request=row["original_request"],
                status=row["status"],
                created_at=row["created_at"],
                completed_at=row["completed_at"],
                business_count=int(row["business_count"] or 0),
                call_count=int(row["call_count"] or 0),
            )
            for row in rows
        ]

    def get_task(self, task_id: str, user_id: str | None = None) -> TaskDetail | None:
        task_query = "select * from search_tasks where id = %s"
        params: tuple[str, ...] = (task_id,)
        if user_id:
            task_query += " and user_id = %s"
            params = (task_id, user_id)
        with self.pool.connection() as conn:
            task_row = conn.execute(task_query, params).fetchone()
            if not task_row:
                return None
            business_rows = conn.execute(
                """
                select *
                from businesses
                where task_id = %s
                order by relevance_score desc nulls last
                """,
                (task_id,),
            ).fetchall()
            call_rows = conn.execute(
                """
                select c.*, b.name as business_name, b.phone as phone_number
                from calls c
                join businesses b on b.id = c.business_id
                where c.task_id = %s
                order by c.created_at asc
                """,
                (task_id,),
            ).fetchall()
            summary_row = conn.execute(
                "select * from summaries where task_id = %s order by created_at desc limit 1",
                (task_id,),
            ).fetchone()

        task = self._task_from_row(task_row)
        return TaskDetail(
            task=task,
            businesses=[self._business_from_row(row) for row in business_rows],
            calls=[self._call_from_row(row) for row in call_rows],
            summary=self._summary_from_row(summary_row) if summary_row else None,
            editable_questions=task.parsed_intent_json.required_questions,
        )

    def save_task(self, detail: TaskDetail) -> TaskDetail:
        with self.pool.connection() as conn:
            with conn.transaction():
                conn.execute(
                    """
                    update search_tasks
                    set status = %s,
                        completed_at = %s,
                        caller_display_name = %s
                    where id = %s
                    """,
                    (
                        detail.task.status,
                        detail.task.completed_at,
                        detail.task.caller_display_name,
                        detail.task.id,
                    ),
                )
                for business in detail.businesses:
                    conn.execute(
                        """
                        update businesses
                        set selected_for_call = %s, do_not_call = %s, relevance_score = %s
                        where id = %s
                        """,
                        (
                            business.selected_for_call,
                            business.do_not_call,
                            business.relevance_score,
                            business.id,
                        ),
                    )
                for call in detail.calls:
                    self._upsert_call(conn, call)
        return self.get_task(detail.task.id) or detail

    def add_calls(self, task_id: str, calls: list[CallRecord]) -> TaskDetail | None:
        detail = self.get_task(task_id)
        if not detail:
            return None
        detail.calls = calls
        detail.task.status = TaskStatus.CALLING
        return self.save_task(detail)

    def update_call(self, task_id: str, call: CallRecord) -> TaskDetail | None:
        with self.pool.connection() as conn:
            with conn.transaction():
                self._upsert_call(conn, call)
        return self.get_task(task_id)

    def find_call(self, call_id: str) -> tuple[TaskDetail, CallRecord] | None:
        with self.pool.connection() as conn:
            row = conn.execute("select task_id from calls where id = %s", (call_id,)).fetchone()
        if not row:
            return None
        detail = self.get_task(str(row["task_id"]))
        if not detail:
            return None
        call = next((item for item in detail.calls if item.id == call_id), None)
        return (detail, call) if call else None

    def find_call_by_sid(self, call_sid: str) -> tuple[TaskDetail, CallRecord] | None:
        with self.pool.connection() as conn:
            row = conn.execute("select id from calls where call_sid = %s", (call_sid,)).fetchone()
        return self.find_call(str(row["id"])) if row else None

    def set_summary(self, task_id: str, summary: SummaryRecord) -> TaskDetail | None:
        with self.pool.connection() as conn:
            with conn.transaction():
                conn.execute(
                    """
                    insert into summaries (
                      id, task_id, final_summary, recommendation_json, created_at
                    )
                    values (%s, %s, %s, %s, %s)
                    """,
                    (
                        summary.id,
                        task_id,
                        summary.final_summary,
                        Jsonb(summary.recommendation_json),
                        summary.created_at,
                    ),
                )
                conn.execute(
                    "update search_tasks set status = %s, completed_at = %s where id = %s",
                    (TaskStatus.COMPLETED, utc_now(), task_id),
                )
        return self.get_task(task_id)

    def cancel_task(self, task_id: str, user_id: str | None = None) -> TaskDetail | None:
        where_clause = "id = %s"
        params: tuple[str, ...] = (task_id,)
        if user_id:
            where_clause += " and user_id = %s"
            params = (task_id, user_id)
        with self.pool.connection() as conn:
            result = conn.execute(
                f"update search_tasks set status = %s, completed_at = %s where {where_clause}",
                (TaskStatus.CANCELLED, utc_now(), *params),
            )
        return self.get_task(task_id, user_id=user_id) if result.rowcount else None

    def delete_task(self, task_id: str, user_id: str | None = None) -> bool:
        where_clause = "id = %s"
        params: tuple[str, ...] = (task_id,)
        if user_id:
            where_clause += " and user_id = %s"
            params = (task_id, user_id)
        with self.pool.connection() as conn:
            result = conn.execute(f"delete from search_tasks where {where_clause}", params)
        return result.rowcount > 0

    def delete_tasks(self, user_id: str | None = None) -> int:
        where_clause = "where user_id = %s" if user_id else ""
        params = (user_id,) if user_id else ()
        with self.pool.connection() as conn:
            result = conn.execute(f"delete from search_tasks {where_clause}", params)
        return result.rowcount or 0

    def _insert_business(self, conn, business: BusinessCandidate) -> None:
        conn.execute(
            """
            insert into businesses (
              id, task_id, name, address, phone, website, rating, review_count, distance,
              opening_hours_json, price_level, place_id, google_maps_url, business_status,
              open_now, relevance_score, selected_for_call, do_not_call, source
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                business.id,
                business.task_id,
                business.name,
                business.address,
                business.phone,
                business.website,
                business.rating,
                business.review_count,
                business.distance_meters,
                Jsonb(business.opening_hours_json) if business.opening_hours_json else None,
                business.price_level,
                business.place_id,
                business.google_maps_url,
                business.business_status,
                business.open_now,
                business.relevance_score,
                business.selected_for_call,
                business.do_not_call,
                business.source,
            ),
        )

    def _upsert_call(self, conn, call: CallRecord) -> None:
        conn.execute(
            """
            insert into calls (
              id, task_id, business_id, call_sid, status, started_at, ended_at, transcript,
              recording_url, extraction_json, questions_json, disclosure_log
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              call_sid = excluded.call_sid,
              status = excluded.status,
              started_at = excluded.started_at,
              ended_at = excluded.ended_at,
              transcript = excluded.transcript,
              recording_url = excluded.recording_url,
              extraction_json = excluded.extraction_json,
              questions_json = excluded.questions_json,
              disclosure_log = excluded.disclosure_log
            """,
            (
                call.id,
                call.task_id,
                call.business_id,
                call.call_sid,
                call.status,
                call.started_at,
                call.ended_at,
                call.transcript,
                call.recording_url,
                (
                    Jsonb(call.extraction_json.model_dump(mode="json"))
                    if call.extraction_json
                    else None
                ),
                Jsonb([question.model_dump(mode="json") for question in call.questions]),
                Jsonb(call.disclosure_log),
            ),
        )

    def _task_from_row(self, row) -> SearchTask:
        return SearchTask(
            id=str(row["id"]),
            user_id=str(row["user_id"]) if row.get("user_id") else None,
            original_request=row["original_request"],
            parsed_intent_json=row["parsed_intent_json"],
            location_lat=self._float_or_none(row["location_lat"]),
            location_lng=self._float_or_none(row["location_lng"]),
            location_label=row["location_label"],
            radius=row["radius"],
            status=row["status"],
            created_at=row["created_at"],
            completed_at=row["completed_at"],
            # Tolerate older row factories that may not include the column —
            # `row.get` returns None instead of raising KeyError.
            caller_display_name=row.get("caller_display_name"),
        )

    def _business_from_row(self, row) -> BusinessCandidate:
        return BusinessCandidate(
            id=str(row["id"]),
            task_id=str(row["task_id"]),
            place_id=row["place_id"],
            name=row["name"],
            address=row["address"] or "",
            phone=row["phone"],
            website=row["website"],
            rating=self._float_or_none(row["rating"]),
            review_count=row["review_count"],
            opening_hours_json=row["opening_hours_json"],
            price_level=row["price_level"],
            distance_meters=row["distance"],
            google_maps_url=row["google_maps_url"],
            business_status=row["business_status"],
            open_now=row["open_now"],
            relevance_score=self._float_or_none(row["relevance_score"]) or 0,
            selected_for_call=row["selected_for_call"],
            do_not_call=row["do_not_call"],
            source=row["source"],
        )

    def _call_from_row(self, row) -> CallRecord:
        extraction = row["extraction_json"]
        return CallRecord(
            id=str(row["id"]),
            task_id=str(row["task_id"]),
            business_id=str(row["business_id"]),
            business_name=row["business_name"],
            phone_number=row["phone_number"],
            call_sid=row["call_sid"],
            status=row["status"],
            started_at=row["started_at"],
            ended_at=row["ended_at"],
            transcript=row["transcript"],
            recording_url=row["recording_url"],
            extraction_json=CallExtraction(**extraction) if extraction else None,
            questions=[Question(**item) for item in row["questions_json"]],
            disclosure_log=row["disclosure_log"],
        )

    def _summary_from_row(self, row) -> SummaryRecord:
        return SummaryRecord(
            id=str(row["id"]),
            task_id=str(row["task_id"]),
            final_summary=row["final_summary"],
            recommendation_json=row["recommendation_json"],
            created_at=row["created_at"],
        )

    def _float_or_none(self, value: Decimal | float | int | None) -> float | None:
        return float(value) if value is not None else None
