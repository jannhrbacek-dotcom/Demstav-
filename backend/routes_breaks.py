from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from core import db, get_ready_user, require_role, is_manager, iso_now, new_id, audit, text
from worktime import TIME, merge, length
from break_policy import FIXED

router = APIRouter()

def clean_intervals(value):
    if not isinstance(value, list) or len(value) > 4:
        raise HTTPException(400, "Zadejte nejvýše čtyři přestávky, nebo prázdný seznam při neuskutečnění.")
    out = []
    for row in value:
        if not isinstance(row, dict):
            raise HTTPException(400, "Neplatná přestávka.")
        a, b = row.get("start", ""), row.get("end", "")
        if not isinstance(a, str) or not isinstance(b, str) or not TIME.fullmatch(a) or not TIME.fullmatch(b) or a >= b:
            raise HTTPException(400, "Přestávka musí mít platný čas od–do v témže dni.")
        out.append({"start": a, "end": b})
    spans = [[int(r["start"][:2])*60+int(r["start"][3:]), int(r["end"][:2])*60+int(r["end"][3:])] for r in out]
    if length(merge(spans)) != length(spans):
        raise HTTPException(400, "Přestávky se nesmějí překrývat.")
    return out

@router.get("/breaks")
async def get_breaks(user=Depends(get_ready_user)):
    q = {} if is_manager(user) else {"employee_id": user["id"]}
    return {"fixed": FIXED, "requests": await db.break_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)}

@router.post("/breaks")
async def request_break(body: dict, user=Depends(get_ready_user)):
    try:
        day = date.fromisoformat(str(body.get("date", ""))).isoformat()
    except ValueError:
        raise HTTPException(400, "Zadejte platné datum.")
    reason = text(body.get("reason"), 1000)
    if not reason:
        raise HTTPException(400, "Napište důvod změny nebo neuskutečnění přestávky.")
    intervals = clean_intervals(body.get("intervals"))
    from pymongo.errors import DuplicateKeyError
    row = {"id": new_id(), "employee_id": user["id"], "employee_name": user["name"], "date": day,
           "intervals": intervals, "reason": reason, "status": "pending", "created_at": iso_now()}
    try:
        await db.break_requests.insert_one(row)
    except DuplicateKeyError:
        raise HTTPException(409, "Pro tento den už čeká žádost na schválení.")
    await audit(user, "break_requested", {k:v for k,v in row.items() if k != "_id"})
    return {"status": "pending", "id": row["id"]}

@router.post("/breaks/{rid}/decision")
async def decide_break(rid: str, body: dict, actor=Depends(require_role("manager"))):
    row = await db.break_requests.find_one({"id": rid}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Žádost nenalezena.")
    if row["employee_id"] == actor["id"]:
        raise HTTPException(403, "Vlastní žádost musí vyřídit jiné vedení.")
    decision, note = body.get("decision"), text(body.get("note"), 1000)
    if decision not in ("approve", "reject") or (decision == "reject" and not note):
        raise HTTPException(400, "Vyberte rozhodnutí a při zamítnutí doplňte důvod.")
    now = iso_now()
    result = await db.break_requests.update_one({"id": rid, "status": "pending"}, {"$set": {"status": "approved" if decision == "approve" else "rejected",
        "decision": {"actor_id": actor["id"], "actor_name": actor["name"], "at": now, "note": note}}})
    if not result.modified_count:
        raise HTTPException(409, "Žádost už byla vyřízena.")
    await audit(actor, "break_decided", {"request_id": rid, "decision": decision, "note": note, "before": row})
    return {"ok": True}
