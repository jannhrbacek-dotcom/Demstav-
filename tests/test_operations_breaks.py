import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_demstav")
os.environ.setdefault("JWT_SECRET", "test-secret-only")
from worktime import time_breakdown, day_union
from routes_attendance import projection
from core import ROLE_RANK, require_role
from routes_users import _can_manage, ensure_operations_manager
from routes_leave import _can_decide
from break_policy import hydrate_records, hydrate_events
from routes_breaks import request_break, decide_break, validate_breaks
from fastapi import HTTPException


def record(start="06:00", end="17:00", **kw):
    return {"date": "2026-10-27", "billing": [{"start": start, "end": end}], **kw}


@pytest.mark.parametrize("start,end,hours,br", [("06:00", "15:00", 8.5, .5), ("06:00", "17:00", 10, 1), ("06:00", "12:15", 6, .25), ("12:15", "12:40", 1/6, .25), ("16:00", "18:00", 2, 0), ("22:00", "06:00", 8, 0)])
def test_fixed_break_intersection(start,end,hours,br):
    result=time_breakdown(record(start,end))
    assert result["totalHours"] == pytest.approx(hours)
    assert result["breakHours"] == pytest.approx(br)


def test_no_double_deduction_and_machine_union():
    r=record(billing=[{"start":"06:00","end":"12:00"},{"start":"12:30","end":"15:30"}])
    assert time_breakdown(r)["totalHours"] == 9
    assert day_union([record("06:00","13:00"),record("12:30","17:00")])["totalHours"] == 10


def test_service_breaks_and_original_history():
    r=record(service=[{"start":"11:00","end":"13:00"}])
    b=time_breakdown(r)
    assert b["serviceHours"] == 1.5
    assert not b["serviceOutsideShift"]
    assert b["totalHours"] == b["workHours"] + b["serviceHours"]
    assert time_breakdown(record(date="2026-10-26"))["totalHours"] == 11
    assert time_breakdown(record(approvedBreaks=[]))["totalHours"] == 11


def events(day="2026-10-27", start="06:00", end="17:00"):
    tz=ZoneInfo("Europe/Prague")
    return [{"id":str(i), "employee_id":"employee", "kind":kind, "status":"verified", "workplace_id":"wp",
             "effective_at":datetime.fromisoformat(f"{day}T{t}").replace(tzinfo=tz).isoformat()}
            for i,(kind,t) in enumerate([("arrival",start),("departure",end)])]


def test_attendance_timezone_and_overlap():
    ev=events()
    p=projection(ev, now_ms=2e12)
    assert (p["presenceHours"],p["breakHours"],p["netHours"]) == (11,1,10)
    ev += [{**ev[0],"id":"b1","kind":"break_start","effective_at":"2026-10-27T12:00:00+01:00"},
           {**ev[0],"id":"b2","kind":"break_end","effective_at":"2026-10-27T12:30:00+01:00"}]
    assert projection(ev,now_ms=2e12)["breakHours"] == 1
    assert projection(events(day="2026-10-26"),now_ms=2e12)["breakHours"] == 0
    assert projection(events(start="06:00",end="12:15"),now_ms=2e12)["breakHours"] == .25


def test_full_role_authorization():
    actor={"id":"jakub", "role":"operations_manager"}
    assert ROLE_RANK[actor["role"]] == ROLE_RANK["owner"]
    assert _can_manage(actor,"admin")
    assert _can_manage(actor,"operations_manager")
    assert not _can_manage(actor,"owner")
    assert not _can_manage({"role":"admin"},"operations_manager")
    assert _can_decide(actor,{"user_id":"employee","status":"pending_director"})
    assert not _can_decide(actor,{"user_id":"jakub","status":"pending_director"})
    assert asyncio.run(require_role("admin")(actor)) == actor


def test_invalid_breaks():
    for value in [None,[{"start":"14:00","end":"13:00"}],[{"start":"12:00","end":"13:00"},{"start":"12:30","end":"14:00"}]]:
        with pytest.raises(HTTPException): validate_breaks(value)


def test_request_approval_applies_to_attendance_and_exports(monkeypatch):
    from mongomock_motor import AsyncMongoMockClient
    import core, routes_users, routes_breaks
    db=AsyncMongoMockClient().db
    for module in (core,routes_users,routes_breaks): monkeypatch.setattr(module,"db",db)
    async def scenario():
        employee={"id":"employee","name":"Jan","role":"employee"}
        manager={"id":"manager","name":"Jakub Karas","role":"operations_manager"}
        source=record(owner_id="employee",integrity_hash="unchanged")
        req=await request_break({"date":"2026-10-27","breaks":[],"reason":"Práce bez pauzy"},employee)
        assert (await hydrate_records([source]))[0].get("approvedBreaks") is None
        with pytest.raises(HTTPException) as e: await decide_break(req["id"],{"decision":"approve"},employee)
        assert e.value.status_code==403
        await decide_break(req["id"],{"decision":"approve"},manager)
        hydrated=(await hydrate_records([source]))[0]
        assert time_breakdown(hydrated)["totalHours"] == 11
        assert hydrated["integrity_hash"] == source["integrity_hash"]
        assert "approvedBreaks" not in source
        assert projection(await hydrate_events(events()),now_ms=2e12)["netHours"]==11
        with pytest.raises(HTTPException) as e: await decide_break(req["id"],{"decision":"reject","note":"dup"},manager)
        assert e.value.status_code==409
        req2=await request_break({"date":"2026-10-27","breaks":[{"start":"13:00","end":"13:30"}],"reason":"Změna"},employee)
        await decide_break(req2["id"],{"decision":"reject","note":"Neschváleno"},manager)
        assert time_breakdown((await hydrate_records([source]))[0])["totalHours"]==11
    asyncio.run(scenario())


def test_jakub_migration_is_idempotent(monkeypatch):
    from mongomock_motor import AsyncMongoMockClient
    import core, routes_users
    db=AsyncMongoMockClient().db
    monkeypatch.setattr(core,"db",db);monkeypatch.setattr(routes_users,"db",db)
    async def scenario():
        await ensure_operations_manager()
        first=await db.users.find_one({"username":"jakub.karas"})
        assert first["name"]=="Jakub Karas" and first["role"]=="operations_manager"
        assert first["must_change_password"]
        await ensure_operations_manager()
        second=await db.users.find_one({"username":"jakub.karas"})
        assert first["password_hash"]==second["password_hash"]
        assert await db.users.count_documents({})==1
    asyncio.run(scenario())


def test_operations_manager_can_correct_record_without_changing_employee(monkeypatch):
    from mongomock_motor import AsyncMongoMockClient
    import core, routes_records
    db=AsyncMongoMockClient().db
    monkeypatch.setattr(core,"db",db); monkeypatch.setattr(routes_records,"db",db)
    async def scenario():
        operator={"id":"operator","name":"Jan Hrbáček","role":"employee"}
        manager={"id":"jakub","name":"Jakub Karas","role":"operations_manager"}
        payload=record()
        first=await routes_records.save_record("test-record",{"opId":"first","record":payload},operator)
        with pytest.raises(HTTPException) as e:
            await routes_records.save_record("test-record",{"opId":"bad","baseRevision":1,"record":payload},{"id":"other","name":"Jiný strojník","role":"employee"})
        assert e.value.status_code==403
        saved=await routes_records.save_record("test-record",{"opId":"edit","baseRevision":1,"record":{**payload,"work":"Opravený popis"}},manager)
        assert saved["record"]["owner_id"]==operator["id"]
        assert saved["record"]["owner_name"]==operator["name"]
        assert saved["record"]["author_id"]==manager["id"]
        assert saved["record"]["revision"]==2
        assert (await routes_records.verify_chain("test-record"))["ok"]
    asyncio.run(scenario())
