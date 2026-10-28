from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import logging  # noqa: E402
import os  # noqa: E402
from datetime import date as date_cls, timedelta  # noqa: E402
from fastapi import FastAPI, APIRouter, Depends, HTTPException  # noqa: E402
from fastapi.responses import Response  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from core import db, client, get_ready_user, require_role, is_manager, COMPANY_NAME  # noqa: E402
from routes_breaks import router as breaks_router
from routes_users import router as users_router, seed_owner, ensure_operations_manager, machines_with_status  # noqa: E402
from routes_records import router as records_router  # noqa: E402
from routes_stt import router as stt_router  # noqa: E402
from routes_leave import router as leave_router  # noqa: E402
from routes_exceptions import router as exceptions_router  # noqa: E402
from routes_push import router as push_router  # noqa: E402
from routes_admin import router as admin_router  # noqa: E402
from routes_production import router as production_router  # noqa: E402
from routes_data import router as data_router  # noqa: E402
from routes_attendance import router as att_router, projection, day_bounds_ms, prague_date, seed_attendance_workplace  # noqa: E402
from worktime import day_union, fmt_hours, time_breakdown  # noqa: E402
from storage import init_storage, get_object  # noqa: E402
from break_policy import hydrate_records, hydrate_events
from exports import timesheet_pdf, diary_pdf  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("demstav")

app = FastAPI(title="DEMSTAV OPERATIONS")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"app": "DEMSTAV OPERATIONS", "company": COMPANY_NAME}


@api.get("/health")
async def health():
    return {"ok": True}


# ---------------- manager overview ----------------
@api.get("/overview")
async def overview(date: str = "", days: int = 7, user: dict = Depends(require_role("manager"))):
    day = date or prague_date()
    try:
        date_cls.fromisoformat(day)
    except ValueError:
        raise HTTPException(status_code=400, detail="Neplatné datum.")
    days = min(max(days, 1), 31)
    users = await db.users.find({"active": True, "role": {"$ne": "owner"}}, {"_id": 0, "password_hash": 0}).to_list(2000)
    start_day = (date_cls.fromisoformat(day) - timedelta(days=days - 1)).isoformat()
    recs = await db.records.find({"date": {"$gte": start_day, "$lte": day}},
                                 {"_id": 0, "operatorSignature": 0, "handoverSignature": 0, "workshopSignature": 0}).to_list(20000)
    recs = await hydrate_records(recs)
    events_all = await db.attendance_events.find({}, {"_id": 0}).to_list(100000)
    events_all = await hydrate_events(events_all)
    by_emp_ev = {}
    for e in events_all:
        by_emp_ev.setdefault(e["employee_id"], []).append(e)
    present, comparison, missing = [], [], []
    chart = {d: {"date": d, "attendance": 0.0, "timesheet": 0.0} for d in
             [(date_cls.fromisoformat(start_day) + timedelta(days=i)).isoformat() for i in range(days)]}
    for u in users:
        evs = by_emp_ev.get(u["id"], [])
        p = projection(evs)
        if p["open"]:
            last = sorted([e for e in evs if e["status"] != "rejected"], key=lambda e: e.get("effective_at") or "")[-1:]
            present.append({"id": u["id"], "name": u["name"], "state": p["state"],
                            "workplace": last[0]["workplace_name"] if last else "", "since": last[0].get("effective_at") if last else None})
        for d in chart:
            f, t = day_bounds_ms(d)
            att = projection(evs, frm=f, to=t)
            rs = [r for r in recs if r["owner_id"] == u["id"] and r["date"] == d]
            un = day_union(rs) if rs else None
            chart[d]["attendance"] += att["netHours"]
            chart[d]["timesheet"] += un["totalHours"] if un else 0
            if d == day and (att["presenceHours"] > 0 or rs):
                comparison.append({"id": u["id"], "name": u["name"], "attendance_net": round(att["netHours"], 2),
                                   "attendance_break": round(att["breakHours"], 2), "timesheet_total": round(un["totalHours"], 2) if un else 0,
                                   "service": round(un["serviceHours"], 2) if un else 0, "downtime": round(un["downtimeHours"], 2) if un else 0,
                                   "overlap": round(un["overlapHours"], 2) if un else 0, "records": len(rs),
                                   "drafts": sum(1 for r in rs if r["status"] == "draft"), "issues": att["issues"]})
            if att["presenceHours"] > 0 and not rs and d < prague_date() or (d == day and att["presenceHours"] > 0 and not rs and not att["open"]):
                missing.append({"id": u["id"], "name": u["name"], "date": d, "attendance_net": round(att["netHours"], 2)})
    open_drafts = await db.records.find({"status": "draft", "date": {"$lt": prague_date()}},
                                        {"_id": 0, "id": 1, "date": 1, "owner_name": 1, "machine": 1}).sort("date", -1).to_list(200)
    stop_recs = await db.records.find({"faults": {"$elemMatch": {"resolved": False}}},
                                      {"_id": 0, "id": 1, "date": 1, "owner_name": 1, "machine": 1, "faults": 1, "status": 1}).sort("date", -1).to_list(500)
    faults = [{"record_id": r["id"], "date": r["date"], "employee": r.get("owner_name"), "machine": r.get("machine"), **f}
              for r in stop_recs for f in r["faults"] if not f.get("resolved")]
    faults.sort(key=lambda f: (f["severity"] != "stop", f["date"]), reverse=False)
    pending_events = await db.attendance_events.count_documents({"status": "pending_review"})
    pending_requests = await db.attendance_requests.count_documents({"status": "pending"})
    pending_requests += await db.break_requests.count_documents({"status": "pending"})
    leave_q = {"status": {"$in": ["pending_manager"] + (["pending_director"] if user["role"] in ("owner", "operations_manager") else [])}, "user_id": {"$ne": user["id"]}}
    pending_leave = await db.leave_requests.count_documents(leave_q) if user["role"] in ("manager", "owner", "operations_manager") else 0
    today_exceptions = await db.planned_exceptions.find({"date": {"$gte": day, "$lte": (date_cls.fromisoformat(day) + timedelta(days=7)).isoformat()}}, {"_id": 0}).sort("date", 1).to_list(200)
    service_alerts = [m for m in await machines_with_status() if m.get("active", True) and m["service_state"] in ("soon", "due")]
    return {"date": day, "present": present, "comparison": comparison, "missing": missing[:200], "open_drafts": open_drafts,
            "faults": faults, "pending_events": pending_events, "pending_requests": pending_requests, "service_alerts": service_alerts, "pending_leave": pending_leave,
            "upcoming_exceptions": [{**r, "kind_label": {"late_arrival": "Pozdní příchod", "early_departure": "Dřívější odchod", "other": "Jiná výjimka"}.get(r.get("kind"), r.get("kind"))} for r in today_exceptions],
            "chart": [{**v, "attendance": round(v["attendance"], 2), "timesheet": round(v["timesheet"], 2)} for v in chart.values()],
            "employees": len(users)}


# ---------------- exports ----------------
async def _export_records(user, employee_id, date_from, date_to, machine, include_drafts):
    q = {}
    if not is_manager(user):
        q["owner_id"] = user["id"]
    elif employee_id:
        q["owner_id"] = employee_id
    if date_from or date_to:
        q["date"] = {}
        if date_from:
            q["date"]["$gte"] = date_from
        if date_to:
            q["date"]["$lte"] = date_to
    if machine:
        q["machine"] = machine
    if not include_drafts:
        q["status"] = "confirmed"
    return await hydrate_records(await db.records.find(q, {"_id": 0}).sort([("date", 1), ("updatedAt", 1)]).to_list(5000))


def _range_name(a, b):
    return f"{a or 'zacatek'}_{b or 'dnes'}"


@api.get("/exports/sichtovnice.pdf")
async def export_timesheet(employee_id: str = "", date_from: str = "", date_to: str = "", include_drafts: int = 1, duplex: int = 0,
                           user: dict = Depends(get_ready_user)):
    recs = await _export_records(user, employee_id, date_from, date_to, "", bool(include_drafts))
    groups = {}
    for r in recs:
        groups.setdefault(r["owner_id"], {"employee_name": r.get("owner_name") or r.get("operator", ""), "records": []})["records"].append(r)
    owners = {u["id"]: u for u in await db.users.find({"id": {"$in": list(groups)}}, {"_id": 0, "id": 1, "name": 1}).to_list(2000)}
    for oid, g in groups.items():
        if oid in owners:
            g["employee_name"] = owners[oid]["name"]
    att_ids = [a["id"] for r in recs for a in (r.get("attachments") or [])]
    atts = {a["id"]: a for a in await db.attachments.find({"id": {"$in": att_ids}, "is_deleted": False}, {"_id": 0}).to_list(5000)}

    def loader(a):
        doc = atts.get(a["id"])
        if not doc:
            return None
        try:
            return get_object(doc["storage_path"])[0]
        except Exception:
            return None
    data = timesheet_pdf(sorted(groups.values(), key=lambda g: g["employee_name"]) or [{"employee_name": user["name"], "records": []}], loader, duplex=bool(duplex))
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="DEMSTAV_sichtovnice_{_range_name(date_from, date_to)}.pdf"'})


@api.get("/exports/denik.pdf")
async def export_diary(employee_id: str = "", machine: str = "", date_from: str = "", date_to: str = "", include_drafts: int = 1,
                       user: dict = Depends(get_ready_user)):
    recs = await _export_records(user, employee_id, date_from, date_to, machine, bool(include_drafts))
    att_ids = [a["id"] for r in recs for a in (r.get("attachments") or []) if a.get("section") == "service"]
    atts = {a["id"]: a for a in await db.attachments.find({"id": {"$in": att_ids}, "is_deleted": False}, {"_id": 0}).to_list(5000)}

    def loader(a):
        doc = atts.get(a["id"])
        if not doc:
            return None
        try:
            return get_object(doc["storage_path"])[0]
        except Exception:
            return None
    data = diary_pdf(recs, loader)
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="DEMSTAV_provozni_denik_{_range_name(date_from, date_to)}.pdf"'})


api.include_router(breaks_router)
api.include_router(users_router)
api.include_router(records_router)
api.include_router(att_router)
api.include_router(stt_router)
api.include_router(leave_router)
api.include_router(exceptions_router)
api.include_router(push_router)
api.include_router(admin_router)
api.include_router(data_router)
api.include_router(production_router)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    # Retain uniqueness for real email addresses, while allowing many username-only users.
    # Create the replacement index FIRST; only then remove the legacy index which treats all missing emails as duplicate null.
    await db.users.create_index("email", unique=True, name="email_present_unique", partialFilterExpression={"email": {"$type": "string"}})
    email_indexes = await db.users.index_information()
    if "email_1" in email_indexes and not email_indexes["email_1"].get("partialFilterExpression"):
        await db.users.drop_index("email_1")
    await db.break_requests.create_index("id", unique=True)
    await db.break_requests.create_index([("employee_id", 1), ("date", 1)], unique=True, partialFilterExpression={"status": "pending"})
    await db.users.create_index("id", unique=True)
    await db.users.create_index("username", unique=True, partialFilterExpression={"username": {"$type": "string"}})
    await db.leave_requests.create_index("id", unique=True)
    await db.leave_requests.create_index([("user_id", 1), ("date_from", -1)])
    await db.planned_exceptions.create_index("id", unique=True)
    await db.planned_exceptions.create_index([("user_id", 1), ("date", -1)])
    await db.planned_exceptions.create_index([("date", -1)])
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await db.push_subscriptions.create_index([("user_id", 1)])
    await db.weekly_exports.create_index("week", unique=True)
    await db.production_reports.create_index("id", unique=True)
    # Only newly saved reports have these fields. Existing reports are not migrated.
    await db.production_reports.create_index("shift_key", unique=True, sparse=True)
    await db.production_reports.create_index("tickets.sha256", unique=True, sparse=True)
    await db.production_reports.create_index("tickets.dedupe_key", unique=True, sparse=True)
    await db.production_reports.create_index([("owner_id", 1), ("date", -1)])
    await db.production_settings.create_index("id", unique=True)
    await db.records.create_index("id", unique=True)
    await db.records.create_index([("owner_id", 1), ("date", -1)])
    await db.record_versions.create_index([("record_id", 1), ("revision", 1)], unique=True)
    await db.attendance_events.create_index("id", unique=True)
    await db.attendance_events.create_index([("employee_id", 1), ("sequence", 1)], unique=True)
    await db.attendance_requests.create_index("id", unique=True)
    await db.attachments.create_index("id", unique=True)
    await db.workplaces.create_index("id", unique=True)
    await db.machines.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")
    await seed_owner()
    await seed_attendance_workplace()
    await ensure_operations_manager()
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
