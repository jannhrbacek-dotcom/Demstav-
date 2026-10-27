"""Fixed breaks and approved daily exceptions; original records remain immutable."""
from contextvars import ContextVar
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

FIXED = [{"start": "12:00", "end": "12:30"}, {"start": "15:30", "end": "16:00"}]
EFFECTIVE_DATE = "2026-10-27"
POLICIES = ContextVar("break_policies", default={})

async def load_policies(user):
    from core import db, is_manager
    query = {"status": "approved"}
    if not is_manager(user):
        query["employee_id"] = user["id"]
    values = {}
    async for row in db.break_requests.find(query, {"_id": 0}).sort([("decision.at", 1), ("id", 1)]):
        values[(row["employee_id"], row["date"])] = row["intervals"]
    POLICIES.set(values)

def record_policy(record, new=False):
    day = record.get("date", "")
    key = (record.get("owner_id", ""), day)
    if key in POLICIES.get():
        return {"breakPolicy": "fixed_v1", "breakIntervals": POLICIES.get()[key]}
    if day >= EFFECTIVE_DATE:
        return {"breakPolicy": "fixed_v1", "breakIntervals": FIXED}
    return {"breakPolicy": "legacy", "breakIntervals": []}

def attendance_breaks(events, segments):
    employee = next((e.get("employee_id") for e in events if e.get("employee_id")), "")
    tz = ZoneInfo("Europe/Prague")
    result = []
    for seg in segments:
        day = datetime.fromtimestamp(seg["from"] / 1000, tz).date()
        last = datetime.fromtimestamp((seg["to"] - 1) / 1000, tz).date()
        while day <= last:
            ds = day.isoformat()
            windows = POLICIES.get().get((employee, ds), FIXED if ds >= EFFECTIVE_DATE else [])
            for window in windows:
                start = datetime.fromisoformat(ds + "T" + window["start"]).replace(tzinfo=tz).timestamp() * 1000
                end = datetime.fromisoformat(ds + "T" + window["end"]).replace(tzinfo=tz).timestamp() * 1000
                a, b = max(seg["from"], start), min(seg["to"], end)
                if a < b:
                    result.append((a, b))
            day += timedelta(days=1)
    return result
