"""Requests to replace all automatic breaks for one employee and date."""
from datetime import date
from pymongo.errors import DuplicateKeyError
from fastapi import APIRouter, Depends, HTTPException
from core import db, get_ready_user, require_role, is_manager, audit, iso_now, new_id, text
from worktime import TIME
from break_policy import POLICY_FROM

router = APIRouter()


def validate_breaks(value):
    if not isinstance(value, list) or len(value) > 8:
        raise HTTPException(400, "Zadejte nejvýše osm přestávek, nebo žádnou.")
    result = []
    for item in value:
        if not isinstance(item, dict):
            raise HTTPException(400, "Neplatná přestávka.")
        a, b = item.get("start", ""), item.get("end", "")
        if not isinstance(a, str) or not isinstance(b, str) or not TIME.fullmatch(a) or not TIME.fullmatch(b) or a >= b:
            raise HTTPException(400, "Přestávka musí mít platný čas od–do v jednom dni.")
        result.append({"start": a, "end": b})
    result.sort(key=lambda x: x["start"])
    if any(a["end"] > b["start"] for a, b in zip(result, result[1:])):
        raise HTTPException(400, "Přestávky se nesmějí překrývat.")
    return result


@router.get("/break-requests")
async def requests(mine: int = 0, user: dict = Depends(get_ready_user)):
    query = {"employee_id": user["id"]} if mine or not is_manager(user) else {"status": "pending"}
    return await db.break_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.post("/break-requests")
async def request_break(body: dict, user: dict = Depends(get_ready_user)):
    day = str(body.get("date") or "")
    try:
        date.fromisoformat(day)
    except ValueError:
        raise HTTPException(400, "Zadejte platné datum.")
    if day < POLICY_FROM:
        raise HTTPException(400, "Automatické přestávky platí od 27. 10. 2026.")
    reason = text(body.get("reason"), 1000)
    if not reason:
        raise HTTPException(400, "Doplňte důvod změny nebo neuskutečnění přestávky.")
    breaks = validate_breaks(body.get("breaks"))
    if await db.break_requests.find_one({"employee_id": user["id"], "date": day, "status": "pending"}):
        raise HTTPException(409, "Pro tento den už čeká žádost na schválení.")
    doc = {"id": new_id(), "employee_id": user["id"], "employee_name": user["name"], "date": day,
           "breaks": breaks, "reason": reason, "status": "pending", "created_at": iso_now()}
    try:
        await db.break_requests.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Pro tento den už čeká žádost na schválení.")
    await audit(user, "break_change_requested", {k: v for k, v in doc.items() if k != "_id"})
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/break-requests/{rid}/decision")
async def decide_break(rid: str, body: dict, actor: dict = Depends(require_role("manager"))):
    request = await db.break_requests.find_one({"id": rid}, {"_id": 0})
    if not request:
        raise HTTPException(404, "Žádost nenalezena.")
    if request["employee_id"] == actor["id"]:
        raise HTTPException(403, "Vlastní žádost musí schválit jiný vedoucí.")
    decision, note = body.get("decision"), text(body.get("note"), 1000)
    if decision not in ("approve", "reject") or (decision == "reject" and not note):
        raise HTTPException(400, "Vyberte rozhodnutí; zamítnutí vyžaduje důvod.")
    stamp = {"by_id": actor["id"], "by_name": actor["name"], "at": iso_now(), "note": note}
    result = await db.break_requests.update_one({"id": rid, "status": "pending"}, {"$set": {
        "status": "approved" if decision == "approve" else "rejected", "decision": stamp}})
    if not result.modified_count:
        raise HTTPException(409, "Žádost už byla vyřízena.")
    await audit(actor, "break_change_decided", {"request": request, "decision": decision, **stamp})
    return {"ok": True}
