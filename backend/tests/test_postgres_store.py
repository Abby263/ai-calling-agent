from typing import Any

from app.db import postgres_store


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
