"""Fixed daily breaks; approved exceptions are separate from signed source records."""
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo

POLICY_FROM = "2026-10-27"
FIXED_BREAKS = [{"start": "12:00", "end": "12:30"}, {"start": "15:30", "end": "16:00"}]
PRAGUE = ZoneInfo("Europe/Prague")


def breaks_for_record(record):
    if (record.get("date") or "") < POLICY_FROM:
        return []
    return record.get("approvedBreaks", FIXED_BREAKS)


def attendance_break_spans(segments, overrides=None):
    overrides = overrides or {}
    cuts = []
    for segment in segments:
        start, end = segment["from"], segment["to"]
        day = datetime.fromtimestamp(start / 1000, PRAGUE).date()
        last = datetime.fromtimestamp(end / 1000, PRAGUE).date()
        while day <= last:
            date = day.isoformat()
            if date >= POLICY_FROM:
                for br in overrides.get(date, FIXED_BREAKS):
                    a = datetime.combine(day, time.fromisoformat(br["start"]), PRAGUE).timestamp() * 1000
                    b = datetime.combine(day, time.fromisoformat(br["end"]), PRAGUE).timestamp() * 1000
                    if max(a, start) < min(b, end):
                        cuts.append([max(a, start), min(b, end)])
            day += timedelta(days=1)
    return cuts


async def hydrate_records(records):
    from core import db
    if not records:
        return records
    users = list({r.get("owner_id") for r in records if r.get("owner_id")})
    rows = await db.break_requests.find({"employee_id": {"$in": users}, "status": "approved"}, {"_id": 0}).sort("decision.at", 1).to_list(20000)
    lookup = {(r["employee_id"], r["date"]): r for r in rows}
    result = []
    for record in records:
        record = {k: v for k, v in record.items() if k != "approvedBreaks"}
        override = lookup.get((record.get("owner_id"), record.get("date")))
        if override:
            record["approvedBreaks"] = override["breaks"]
        result.append(record)
    return result


async def hydrate_events(events, employee_id=None):
    from core import db
    ids = list({e["employee_id"] for e in events}) or ([employee_id] if employee_id else [])
    rows = await db.break_requests.find({"employee_id": {"$in": ids}, "status": "approved"}, {"_id": 0}).sort("decision.at", 1).to_list(20000)
    by_user = {}
    for r in rows:
        by_user.setdefault(r["employee_id"], {})[r["date"]] = r["breaks"]
    return [{**e, "_break_overrides": by_user.get(e["employee_id"], {})} for e in events]
