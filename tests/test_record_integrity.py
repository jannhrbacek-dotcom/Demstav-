"""Regression tests for authorization, durable revision commit and crash recovery.
Uses isolated in-memory MongoDB; no production access.
"""
import asyncio
import os
import sys
from types import SimpleNamespace
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "audit_only")
os.environ.setdefault("JWT_SECRET", "audit-test-only")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import pytest
from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient
import core
import routes_records
import routes_data
import routes_production


def record(**kw):
    return dict(id="audit-record", date="2026-10-28", machine="TEST-2",
                operator="Test operator", mthStart="14000", mthEnd="14002",
                billing=[dict(start="06:00", end="17:00")], **kw)


@pytest.fixture
def database(monkeypatch):
    db = AsyncMongoMockClient().audit_only
    for module in (core, routes_records, routes_data, routes_production):
        monkeypatch.setattr(module, "db", db)
    return db


def test_interval_service_requires_actor_permission():
    assert not routes_records.can_record_interval_service(
        dict(id="ordinary", name="Test employee", role="employee", position="strojnik"), "external")


@pytest.mark.asyncio
async def test_record_retry_does_not_disclose_foreign_record(database):
    owner = dict(id="employee-a", name="Test A", role="employee")
    other = dict(id="employee-b", name="Test B", role="employee")
    body = dict(opId="audit-operation", record=record())
    await routes_records.save_record("audit-record", body, owner)
    with pytest.raises(HTTPException) as exc:
        await routes_records.save_record("audit-record", body, other)
    assert exc.value.status_code in (403, 404)


@pytest.mark.asyncio
async def test_concurrent_record_save_returns_conflict(database, monkeypatch):
    actor = dict(id="employee-a", name="Test A", role="employee")
    await database.record_versions.create_index([("record_id", 1), ("revision", 1)], unique=True)
    await routes_records.save_record("audit-record", dict(opId="initial", record=record()), actor)
    collection = database.record_versions
    original = collection.insert_one
    monkeypatch.setattr(routes_records, "db", SimpleNamespace(records=database.records,
        record_versions=collection, attachments=database.attachments))
    reached = 0
    barrier = asyncio.Event()

    async def simultaneous(*args, **kwargs):
        nonlocal reached
        reached += 1
        if reached == 2:
            barrier.set()
        await asyncio.wait_for(barrier.wait(), timeout=3)
        return await original(*args, **kwargs)

    monkeypatch.setattr(collection, "insert_one", simultaneous)
    result = await asyncio.gather(*[
        routes_records.save_record("audit-record", dict(opId=f"writer-{i}", baseRevision=1,
            record=record(work=f"writer-{i}")), actor) for i in range(2)
    ], return_exceptions=True)
    assert sum(isinstance(r, dict) for r in result) == 1
    assert any(isinstance(r, HTTPException) and r.status_code == 409 for r in result), result
    assert (await routes_records.verify_chain("audit-record"))["ok"]
    head = await database.records.find_one({"id": "audit-record"})
    version = await database.record_versions.find_one({"record_id": "audit-record", "revision": 2})
    assert head["work"] == version["payload"]["work"]


@pytest.mark.asyncio
async def test_crash_after_journal_commit_is_recovered(database, monkeypatch):
    actor = dict(id="employee-a", name="Test A", role="employee")
    real_project = routes_records._project_version
    async def interrupted(version):
        raise RuntimeError("simulated interruption after durable journal commit")
    monkeypatch.setattr(routes_records, "_project_version", interrupted)
    body = dict(opId="recover-operation", record=record())
    with pytest.raises(RuntimeError):
        await routes_records.save_record("audit-record", body, actor)
    assert await database.records.count_documents({}) == 0
    assert await database.record_versions.count_documents({"projection_pending": True}) == 1
    monkeypatch.setattr(routes_records, "_project_version", real_project)
    result = await routes_records.save_record("audit-record", body, actor)
    assert result["status"] == "duplicate"
    assert result["record"]["revision"] == 1
    assert await database.record_versions.count_documents({}) == 1
    assert (await routes_records.verify_chain("audit-record"))["ok"]


@pytest.mark.asyncio
async def test_global_wipe_is_disabled_without_deleting_data(database, monkeypatch):
    import routes_admin
    monkeypatch.setattr(routes_admin, "db", database)
    await database.records.insert_one(record())
    with pytest.raises(HTTPException) as exc:
        await routes_admin.wipe_data({}, dict(id="owner", role="owner"))
    assert exc.value.status_code == 410
    assert await database.records.count_documents({}) == 1
