"""Žádosti o nepřítomnost: dovolená, neplacené volno, návštěva lékaře, ohlášení nemoci.

Schvalování:
- dovolená: vedoucí výroby → jednatel (dvoustupňové),
- neplacené volno, lékař, nemoc: jen vedoucí výroby.
Jednatel může schválit kterýkoli krok. Admin spravuje aplikaci, ale dovolenou neschvaluje.
"""
import re
from datetime import date as date_cls

from fastapi import APIRouter, Depends, HTTPException

from core import db, get_ready_user, is_manager, audit, iso_now, new_id, text, ROLE_LABELS

router = APIRouter()

TYPES = {"vacation": "Dovolená", "unpaid": "Neplacené volno", "doctor": "Návštěva lékaře", "sick": "Nemoc (ohlášení)"}
STATUS_LABELS = {"pending_manager": "Čeká na vedoucího výroby", "pending_director": "Čeká na jednatele",
                 "approved": "Schváleno", "rejected": "Zamítnuto", "cancelled": "Zrušeno"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def workdays(a: str, b: str, half: bool) -> float:
    d1, d2 = date_cls.fromisoformat(a), date_cls.fromisoformat(b)
    n = sum(1 for i in range((d2 - d1).days + 1) if date_cls.fromordinal(d1.toordinal() + i).weekday() < 5)
    return 0.5 if half and n >= 1 else float(n)


def public(r: dict) -> dict:
    return {**{k: v for k, v in r.items() if k != "_id"}, "type_label": TYPES.get(r["type"], r["type"]),
            "status_label": STATUS_LABELS.get(r["status"], r["status"])}


def _can_decide(user: dict, r: dict) -> bool:
    if r["user_id"] == user["id"]:
        return False  # nikdo neschvaluje sám sobě
    if r["status"] == "pending_manager":
        return user["role"] in ("manager", "owner", "operations_manager")
    if r["status"] == "pending_director":
        return user["role"] in ("owner", "operations_manager")
    return False


@router.post("/leave")
async def create_leave(b: dict, user: dict = Depends(get_ready_user)):
    t = b.get("type")
    if t not in TYPES:
        raise HTTPException(status_code=400, detail="Vyberte druh nepřítomnosti.")
    df, dt = str(b.get("date_from") or ""), str(b.get("date_to") or b.get("date_from") or "")
    if not DATE.match(df) or not DATE.match(dt) or dt < df:
        raise HTTPException(status_code=400, detail="Zadejte platné datum od–do (konec nesmí být před začátkem).")
    if (date_cls.fromisoformat(dt) - date_cls.fromisoformat(df)).days > 366:
        raise HTTPException(status_code=400, detail="Žádost může mít nejvýše jeden rok.")
    half = b.get("half_day") is True and df == dt and t in ("vacation", "unpaid")
    tf, tt = str(b.get("time_from") or ""), str(b.get("time_to") or "")
    if t == "doctor":
        if df != dt or not TIME.match(tf) or not TIME.match(tt) or tt <= tf:
            raise HTTPException(status_code=400, detail="Návštěva lékaře: zadejte jeden den a čas od–do.")
    else:
        tf, tt = "", ""
    rid = str(b.get("id") or "")[:100] or new_id()
    if await db.leave_requests.find_one({"id": rid}):
        return {"status": "duplicate"}
    clash = await db.leave_requests.find_one({"user_id": user["id"], "status": {"$in": ["pending_manager", "pending_director", "approved"]},
                                              "date_from": {"$lte": dt}, "date_to": {"$gte": df}, "type": {"$ne": "doctor"}}, {"_id": 0})
    if clash and t != "doctor":
        raise HTTPException(status_code=409, detail=f"V tomto termínu už máte žádost: {TYPES[clash['type']]} {clash['date_from']} – {clash['date_to']}.")
    now = iso_now()
    doc = {"id": rid, "user_id": user["id"], "user_name": user["name"], "type": t, "date_from": df, "date_to": dt,
           "half_day": half, "time_from": tf, "time_to": tt, "days": 0 if t == "doctor" else workdays(df, dt, half),
           "note": text(b.get("note"), 1000), "status": "pending_manager", "created_at": now, "updated_at": now,
           "history": [{"action": "created", "by_id": user["id"], "by_name": user["name"], "role": ROLE_LABELS.get(user["role"]), "at": now}]}
    await db.leave_requests.insert_one(doc)
    await audit(user, "leave_requested", {"leave_id": rid, "type": t, "from": df, "to": dt})
    # Push notifikace schvalovatelům (manager + owner, kromě žadatele).
    try:
        from routes_push import notify_users_by_role
        label = TYPES[t]
        when = df if df == dt else f"{df} – {dt}"
        await notify_users_by_role(["manager", "owner", "operations_manager"], f"Nová žádost: {label}",
                                   f"{user['name']} · {when}", url="/nepritomnost", tag=f"leave-{rid}",
                                   exclude_user_id=user["id"])
    except Exception:
        pass
    return {"status": "saved", "request": public(doc)}


@router.get("/leave")
async def list_leave(mine: int = 0, status: str = "", type: str = "", employee_id: str = "", date_from: str = "", date_to: str = "",
                     user: dict = Depends(get_ready_user)):
    q = {}
    if mine or not is_manager(user):
        q["user_id"] = user["id"]
    elif employee_id:
        q["user_id"] = employee_id
    if status == "to_decide":
        q["status"] = {"$in": ["pending_manager"] + (["pending_director"] if user["role"] in ("owner", "operations_manager") else [])}
        q["user_id"] = {"$ne": user["id"]} if "user_id" not in q else q["user_id"]
    elif status:
        q["status"] = status
    if type in TYPES:
        q["type"] = type
    if date_from:
        q["date_to"] = {"$gte": date_from}
    if date_to:
        q["date_from"] = {"$lte": date_to}
    rows = await db.leave_requests.find(q, {"_id": 0}).sort("date_from", -1).to_list(2000)
    return [{**public(r), "can_decide": _can_decide(user, r),
             "can_cancel": r["user_id"] == user["id"] and r["status"] in ("pending_manager", "pending_director")} for r in rows]


@router.post("/leave/{rid}/decision")
async def decide(rid: str, b: dict, user: dict = Depends(get_ready_user)):
    r = await db.leave_requests.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Žádost nenalezena.")
    if not _can_decide(user, r):
        raise HTTPException(status_code=403, detail="Tuto žádost teď nemůžete schválit ani zamítnout.")
    action = b.get("action")
    note = text(b.get("note"), 1000)
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Neplatná akce.")
    if action == "reject" and not note:
        raise HTTPException(status_code=400, detail="Při zamítnutí uveďte důvod.")
    if action == "reject":
        new = "rejected"
    elif r["type"] == "vacation" and r["status"] == "pending_manager" and user["role"] not in ("owner", "operations_manager"):
        new = "pending_director"
    else:
        new = "approved"
    now = iso_now()
    step = {"action": action, "by_id": user["id"], "by_name": user["name"], "role": ROLE_LABELS.get(user["role"]), "at": now, "note": note,
            "step": "director" if r["status"] == "pending_director" or user["role"] in ("owner", "operations_manager") else "manager"}
    await db.leave_requests.update_one({"id": rid, "status": r["status"]}, {"$set": {"status": new, "updated_at": now}, "$push": {"history": step}})
    await audit(user, "leave_" + action, {"leave_id": rid, "from_status": r["status"], "to_status": new})
    try:
        from routes_push import send_push_to_users
        verb = "schválena" if new == "approved" else ("zamítnuta" if new == "rejected" else "posunuta jednateli")
        await send_push_to_users([r["user_id"]], f"Žádost {TYPES[r['type']]} – {verb}",
                                 f"{r['date_from']}{' – ' + r['date_to'] if r['date_to'] != r['date_from'] else ''}"
                                 + (f" · {note}" if note else ""),
                                 url="/nepritomnost", tag=f"leave-{rid}")
    except Exception:
        pass
    r = await db.leave_requests.find_one({"id": rid}, {"_id": 0})
    return public(r)


@router.post("/leave/{rid}/cancel")
async def cancel(rid: str, user: dict = Depends(get_ready_user)):
    r = await db.leave_requests.find_one({"id": rid}, {"_id": 0})
    if not r or r["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Žádost nenalezena.")
    if r["status"] not in ("pending_manager", "pending_director"):
        raise HTTPException(status_code=400, detail="Vyřízenou žádost nelze zrušit – obraťte se na vedoucího výroby.")
    now = iso_now()
    await db.leave_requests.update_one({"id": rid}, {"$set": {"status": "cancelled", "updated_at": now},
                                                    "$push": {"history": {"action": "cancelled", "by_id": user["id"], "by_name": user["name"], "at": now}}})
    await audit(user, "leave_cancelled", {"leave_id": rid})
    return {"ok": True}


async def leaves_in_range(date_from: str, date_to: str, user_ids=None, statuses=("approved",)):
    q = {"status": {"$in": list(statuses)}}
    if date_from:
        q["date_to"] = {"$gte": date_from}
    if date_to:
        q["date_from"] = {"$lte": date_to}
    if user_ids is not None:
        q["user_id"] = {"$in": list(user_ids)}
    return await db.leave_requests.find(q, {"_id": 0}).to_list(5000)
