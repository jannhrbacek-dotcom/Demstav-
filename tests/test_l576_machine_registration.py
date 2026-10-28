"""Idempotency and conflict checks for production machine import."""
import asyncio
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_demstav")
os.environ.setdefault("JWT_SECRET", "test-secret-only")

from mongomock_motor import AsyncMongoMockClient
import migrate_l576_5 as migration


async def context(monkeypatch):
    testdb = AsyncMongoMockClient().test
    monkeypatch.setattr(migration, "db", testdb)
    events = []
    async def audit(actor, action, payload):
        events.append((action, payload))
    monkeypatch.setattr(migration, "audit", audit)
    return testdb, events


def test_register_once_and_never_duplicate(monkeypatch):
    async def run():
        db, events = await context(monkeypatch)
        assert await migration.register_l576_5() == "created"
        assert await migration.register_l576_5() == "already_done"
        rows = await db.machines.find({}, {"_id": 0}).to_list(10)
        assert len(rows) == 1
        m = rows[0]
        assert m["label"] == "L576/5"
        assert m["serial_number"] == "VATZ1459VZB060956"
        assert m["operating_hours"] == 8446
        assert m["service_interval_mth"] == 500
        assert m["service_warn_mth"] == 100
        assert m["last_service_mth"] is None
        assert len(events) == 1
    asyncio.run(run())


def test_conflicting_serial_never_overwrites(monkeypatch):
    async def run():
        db, events = await context(monkeypatch)
        await db.machines.insert_one({"id": "existing", "label": "L576/5", "serial_number": "OTHER", "operating_hours": 9000})
        assert await migration.register_l576_5() == "conflict"
        assert await db.machines.count_documents({}) == 1
        assert await db.migrations.count_documents({}) == 0
        assert events == []
    asyncio.run(run())


def test_existing_machine_is_updated_without_resetting_last_service(monkeypatch):
    async def run():
        db, events = await context(monkeypatch)
        await db.machines.insert_one({"id": "exists", "label": "Liebherr L576/5", "type": "L576",
                                      "serial_number": "VATZ1459VZB060956", "operating_hours": 8470,
                                      "last_service_mth": 8110, "service_interval_mth": 400})
        assert await migration.register_l576_5() == "updated"
        m = await db.machines.find_one({"id": "exists"})
        assert m["operating_hours"] == 8470
        assert m["last_service_mth"] == 8110
        assert m["service_interval_mth"] == 500
        assert await db.machines.count_documents({}) == 1
        assert len(events) == 1
    asyncio.run(run())
