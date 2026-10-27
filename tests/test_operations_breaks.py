"""Permission, accounting and approval regressions without production data."""
import asyncio
import os
import sys
from pathlib import Path
import pytest
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from break_policy import POLICIES, FIXED, record_policy
from worktime import time_breakdown, day_union
from routes_attendance import projection
from core import ROLE_RANK, ROLE_LABELS, require_role
from routes_users import _can_manage
from fastapi import HTTPException

@pytest.fixture(autouse=True)
def policies():
    token = POLICIES.set({})
    yield
    POLICIES.reset(token)

def record(start="06:00", end="16:00", **extra):
    return {"owner_id":"employee", "date":"2026-10-27", "billing":[{"start":start,"end":end}], **extra}

@pytest.mark.parametrize("start,end,total,brk",[("06:00","16:00",9,1),("06:00","15:00",8.5,.5),("06:00","12:00",6,0),("12:15","12:45",.25,.25),("15:45","16:15",.25,.25),("22:00","06:00",8,0),("12:00","12:30",0,.5)])
def test_fixed_intersection(start,end,total,brk):
    bd=time_breakdown(record(start,end))
    assert bd["totalHours"]==total
    assert bd["breakHours"]==brk

def test_multiple_machines_and_explicit_gap_do_not_double_deduct():
    rows=[record("06:00","12:00"),record("12:30","16:00")]
    assert day_union(rows)["totalHours"]==9
    assert day_union([record(),record()])["totalHours"]==9

def test_categories_and_service_spanning_break():
    r=record(service=[{"start":"11:00","end":"13:00"}], downtime=[{"start":"14:00","end":"15:00"}])
    b=time_breakdown(r)
    assert b["serviceHours"]==1.5
    assert not b["serviceOutsideShift"]
    assert b["totalHours"]==b["workHours"]+b["serviceHours"]+b["downtimeHours"]+b["travelHours"]

def test_approved_override_and_legacy():
    r=record()
    POLICIES.set({("employee",r["date"]):[]})
    assert time_breakdown(r)["totalHours"]==10
    assert time_breakdown(record(date="2026-10-23"))["totalHours"]==10
    assert record_policy({**r,"breakIntervals":[]})["breakIntervals"]==[] # approved context
    POLICIES.set({})
    assert record_policy({**r,"breakIntervals":[],"breakPolicy":"fake"})["breakIntervals"]==FIXED

def event(kind,at,seq):
    return {"id":str(seq),"employee_id":"employee","effective_at":at,"kind":kind,"status":"verified","sequence":seq,"workplace_id":"site"}

def test_attendance_prague_timezone_and_no_double_break():
    ev=[event("arrival","2026-10-27T05:00:00Z",1),event("break_start","2026-10-27T11:00:00Z",2),event("break_end","2026-10-27T11:30:00Z",3),event("departure","2026-10-27T15:00:00Z",4)]
    p=projection(ev,now_ms=1793200000000)
    assert p["presenceHours"]==10
    assert p["breakHours"]==1
    assert p["netHours"]==9
    # Summer time: noon in Prague is 10:00 UTC, and legacy days remain unchanged.
    ev=[event("arrival","2027-07-01T04:00:00Z",1),event("departure","2027-07-01T14:00:00Z",2)]
    p=projection(ev,now_ms=1900000000000)
    assert p["netHours"]==9

def test_permissions():
    ops={"id":"ops","role":"operations_manager"}
    assert ROLE_RANK[ops["role"]]==ROLE_RANK["owner"]
    assert ROLE_LABELS[ops["role"]]=="Vedoucí provozu"
    assert _can_manage(ops,"admin") and _can_manage(ops,"manager")
    assert not _can_manage(ops,"owner")
    assert not _can_manage({"role":"employee"},"operations_manager")
    assert asyncio.run(require_role("owner")(ops))==ops
    with pytest.raises(HTTPException):
        asyncio.run(require_role("admin")({"role":"employee"}))

def test_interval_validation():
    from routes_breaks import clean_intervals
    assert clean_intervals([])==[]
    with pytest.raises(HTTPException): clean_intervals([{"start":"13:00","end":"12:00"}])
    with pytest.raises(HTTPException): clean_intervals([{"start":"12:00","end":"13:00"},{"start":"12:30","end":"13:30"}])

def test_request_approval_and_provisioning(monkeypatch):
    from mongomock_motor import AsyncMongoMockClient
    import core, routes_breaks, routes_users
    from break_policy import load_policies
    db=AsyncMongoMockClient().db
    for module in (core,routes_breaks,routes_users): monkeypatch.setattr(module,"db",db)
    employee={"id":"employee","name":"Strojník","role":"employee"}
    manager={"id":"manager","name":"Jakub Karas","role":"operations_manager"}
    async def run():
        await db.break_requests.create_index([("employee_id",1),("date",1)],unique=True,partialFilterExpression={"status":"pending"})
        req=await routes_breaks.request_break({"date":"2026-10-27","intervals":[],"reason":"Nakládka"},employee)
        await load_policies(employee)
        assert time_breakdown(record())["totalHours"]==9
        with pytest.raises(HTTPException) as error:
            await routes_breaks.decide_break(req["id"],{"decision":"approve"},employee)
        assert error.value.status_code==403
        await routes_breaks.decide_break(req["id"],{"decision":"approve"},manager)
        await load_policies(employee)
        assert time_breakdown(record())["totalHours"]==10
        with pytest.raises(HTTPException):
            await routes_breaks.decide_break(req["id"],{"decision":"approve"},manager)
        await routes_users.seed_operations_manager()
        await routes_users.seed_operations_manager()
        assert await db.users.count_documents({})==1
        karas=await db.users.find_one({"username":"jakub.karas"})
        assert karas["role"]=="operations_manager" and not karas["active"] and karas["must_change_password"]
        assert await db.audit.count_documents({})>=3
    asyncio.run(run())
