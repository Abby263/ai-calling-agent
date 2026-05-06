import inspect
from typing import Any

from app.db import postgres_store
from app.db.store import InMemoryTaskStore


class FakeConnection:
    def __init__(self) -> None:
        self.executed_sql: list[str] = []

    def execute(self, sql: str) -> None:
        self.executed_sql.append(sql)


class FakeConnectionContext:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> FakeConnection:
        return self.connection

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        return None


class FakeConnectionPool:
    instances: list["FakeConnectionPool"] = []

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.connection_instance = FakeConnection()
        FakeConnectionPool.instances.append(self)

    def connection(self) -> FakeConnectionContext:
        return FakeConnectionContext(self.connection_instance)


def test_postgres_store_initializes_schema_on_startup(monkeypatch):
    FakeConnectionPool.instances = []
    monkeypatch.setattr(postgres_store, "ConnectionPool", FakeConnectionPool)

    postgres_store.PostgresTaskStore("postgresql://example", initialize_schema=True)

    pool = FakeConnectionPool.instances[0]
    assert len(pool.connection_instance.executed_sql) == 1
    schema_sql = pool.connection_instance.executed_sql[0]
    assert "create table if not exists users" in schema_sql
    assert "create table if not exists search_tasks" in schema_sql


def test_postgres_store_can_skip_schema_initialization(monkeypatch):
    FakeConnectionPool.instances = []
    monkeypatch.setattr(postgres_store, "ConnectionPool", FakeConnectionPool)

    postgres_store.PostgresTaskStore("postgresql://example", initialize_schema=False)

    pool = FakeConnectionPool.instances[0]
    assert pool.connection_instance.executed_sql == []


def test_postgres_create_preview_accepts_same_kwargs_as_in_memory_store():
    """Regression for #25 (PR #24 hotfix): the orchestrator calls
    `store.create_preview(caller_display_name=...)`. Both the InMemoryTaskStore
    and the PostgresTaskStore must accept that kwarg, otherwise production
    Postgres deployments 500.
    """
    in_memory_kwargs = set(
        inspect.signature(InMemoryTaskStore.create_preview).parameters.keys()
    )
    postgres_kwargs = set(
        inspect.signature(postgres_store.PostgresTaskStore.create_preview).parameters.keys()
    )

    missing = in_memory_kwargs - postgres_kwargs
    assert not missing, (
        f"PostgresTaskStore.create_preview is missing kwargs present on the in-memory store: {missing}"
    )
    assert "caller_display_name" in postgres_kwargs


def test_postgres_schema_includes_caller_display_name_column():
    """Schema must declare or ALTER-add the column the create_preview INSERT uses."""
    schema_sql = postgres_store.SCHEMA_SQL_PATH.read_text(encoding="utf-8")
    assert "caller_display_name" in schema_sql, "schema.sql must declare caller_display_name"
    assert (
        "alter table search_tasks add column if not exists caller_display_name" in schema_sql
    ), "schema.sql must include an idempotent ALTER for existing deployments"
