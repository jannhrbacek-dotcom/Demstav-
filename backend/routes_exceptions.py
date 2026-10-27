"""Plánované výjimky / zkrácené směny.

Zaměstnanec zadává bez schvalování:
- pozdě (pozdní příchod) – orientační čas příchodu,
- dřív (dřívější odchod) – orientační čas odchodu,
- jiné – libovolná poznámka pro vedení.

Vedení (manager+) vidí všechny výjimky napříč zaměstnanci.
"""
import re
from datetime import date as date_cls, timedelta

from fastapi import APIRouter, Depends, HTTPException

from core import db, get_ready_user, is_manager, audit, iso_now, new_id, text, role_label

router = APIRouter()

KINDS = {"late_arrival": "Pozdní příchod", "early_departure": "Dřívější odchod", "other": "Jiná výjimka"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def _public(r: dict) -> dict:
    return {**{k: v for k, v in r.items() if k != "_id"}, "kind_label": KINDS.get(r.get("kind", ""), r.get("kind", ""))}


@router.post("/exceptions")
async def create_exception(b: dict, user: dict = Depends(get_ready_user)):
    kind = b.get("kind")
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail="Vyberte druh výjimky (pozdě, dřív, jiné).")
    date = str(b.get("date") or "")
    if not DATE.match(date):
        raise HTTPException(status_code=400, detail="Zadejte platné datum.")
    d_obj = date_cls.fromisoformat(date)
    today = date_cls.fromisoformat(iso_now()[:10])
    if d_obj > today + timedelta(days=180):
        raise HTTPException(status_code=400, detail="Datum může být nejvýše půl roku dopředu.")
    time_from = str(b.get("time_from") or "")
    time_to = str(b.get("time_to") or "")
    reason = text(b.get("reason"), 1000)
    if kind == "late_arrival":
        if not TIME.match(time_from):
            raise HTTPException(status_code=400, detail="Zadejte orientační čas příchodu (HH:MM).")
        time_to = ""
    elif kind == "early_departure":
        if not TIME.match(time_to):
            raise HTTPException(status_code=400, detail="Zadejte orientační čas odchodu (HH:MM).")
        time_from = ""
    else:
        time_from = time_from if TIME.match(time_from) else ""
        time_to = time_to if TIME.match(time_to) else ""
    if not reason:
        raise HTTPException(status_code=400, detail="Doplňte prosím důvod (např. dítě, úřad, zubař).")
    rid = str(b.get("id") or "")[:100] or new_id()
    if await db.planned_exceptions.find_one({"id": rid}):
        return {"status": "duplicate"}
    now = iso_now()
    doc = {"id": rid, "user_id": user["id"], "user_name": user["name"],
           "role_label": role_label(user), "date": date, "kind": kind,
           "time_from": time_from, "time_to": time_to, "reason": reason,
           "created_at": now, "updated_at": now}
    await db.planned_exceptions.insert_one(doc)
    await audit(user, "exception_created", {"exception_id": rid, "kind": kind, "date": date})
    try:
        from routes_push import notify_users_by_role
        when = date + (f" {time_from}" if time_from else "") + (f"–{time_to}" if time_to else "")
        await notify_users_by_role(["manager", "owner", "operations_manager"], f"Výjimka: {KINDS[kind]}",
                                   f"{user['name']} · {when} · {reason[:80]}",
                                   url="/nepritomnost", tag=f"exc-{rid}", exclude_user_id=user["id"])
    except Exception:
        pass
    return {"status": "saved", "exception": _public(doc)}


@router.get("/exceptions")
async def list_exceptions(mine: int = 0, employee_id: str = "", date_from: str = "", date_to: str = "",
                          user: dict = Depends(get_ready_user)):
    q = {}
    if mine or not is_manager(user):
        q["user_id"] = user["id"]
    elif employee_id:
        q["user_id"] = employee_id
    if date_from:
        q.setdefault("date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("date", {})["$lte"] = date_to
    rows = await db.planned_exceptions.find(q, {"_id": 0}).sort("date", -1).to_list(2000)
    return [{**_public(r), "can_delete": r["user_id"] == user["id"]} for r in rows]


@router.delete("/exceptions/{rid}")
async def delete_exception(rid: str, user: dict = Depends(get_ready_user)):
    r = await db.planned_exceptions.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Výjimka nenalezena.")
    if r["user_id"] != user["id"] and user["role"] not in ("admin", "owner", "operations_manager"):
        raise HTTPException(status_code=403, detail="Výjimku může smazat její autor nebo správce.")
    await db.planned_exceptions.delete_one({"id": rid})
    await audit(user, "exception_deleted", {"exception_id": rid})
    return {"ok": True}


async def exceptions_in_range(date_from: str, date_to: str, user_ids=None):
    q = {}
    if date_from:
        q.setdefault("date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("date", {})["$lte"] = date_to
    if user_ids is not None:
        q["user_id"] = {"$in": list(user_ids)}
    return await db.planned_exceptions.find(q, {"_id": 0}).to_list(5000)
