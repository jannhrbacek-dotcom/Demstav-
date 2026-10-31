import re
import hashlib
import json
from urllib.parse import quote
from datetime import date as date_cls
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pymongo.errors import DuplicateKeyError
from core import db, iso_now, new_id, get_ready_user, is_manager, audit, text
from break_policy import hydrate_records
from worktime import time_breakdown, TIME
from journey import duration_minutes
from storage import put_object, get_object, APP_PREFIX

router = APIRouter()

def can_record_interval_service(user: dict, service_by: str) -> bool:
    """Permission comes from the authenticated account, never a selected supplier/name."""
    return bool(user and (user.get("role") in ("owner", "operations_manager") or
        user.get("position") in ("mechanik", "strojnik_mechanik", "externi_servis")))


ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,100}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DEC_RE = re.compile(r"^\d+(?:[.,]\d{1,3})?$")
SIG_RE = re.compile(r"^data:image/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$")
MAX_UPLOAD = 15 * 1024 * 1024
ATT_SECTIONS = ("general", "service", "timesheet")
from record_integrity import CHAIN_GENESIS, canonical, chain_hash
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "text/plain", "application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.spreadsheet"}

RECORD_FIELDS_TEXT = {
    "shift": 100, "operator": 200, "crew": 1000, "attendanceWorkplaceId": 100, "machine": 200, "customer": 300,
    "site": 500, "job": 200, "vehiclesTo": 500, "vehiclesFrom": 500, "downtimeReason": 2000, "work": 12000,
    "mthStart": 30, "mthEnd": 30, "notes": 12000, "handover": 12000, "handoverName": 200, "diesel": 30,
    "hydraulic": 30, "oil": 30, "otherFluid": 1000, "serviceDescription": 12000, "repairDescription": 12000,
    "externalCompany": 300,
}


def _valid_date(s: str) -> bool:
    if not DATE_RE.match(s or ""):
        return False
    try:
        d = date_cls.fromisoformat(s)
    except ValueError:
        return False
    return "2000-01-01" <= s <= "2100-12-31" and d.isoformat() == s


def _num(v: str):
    return float(v.replace(",", ".")) if v and DEC_RE.match(v) else None


def validate_record(r: dict, confirm: bool):
    errors = []
    if not isinstance(r, dict):
        return ["Záznam musí být objekt."], None
    out = {}
    for k, mx in RECORD_FIELDS_TEXT.items():
        v = r.get(k)
        if v is None:
            out[k] = ""
            continue
        if not isinstance(v, str):
            v = str(v)
        if len(v) > mx:
            errors.append(f"Pole {k} je příliš dlouhé (nejvýše {mx} znaků).")
        out[k] = v.strip()[:mx]
    out["id"] = str(r.get("id") or "")
    if not ID_RE.match(out["id"]):
        errors.append("Záznam nemá platný identifikátor.")
    out["date"] = str(r.get("date") or "")
    if not _valid_date(out["date"]):
        errors.append("Vyplňte platné datum.")
    drive = str(r.get("drive") or "").strip()
    minutes = r.get("driveMinutes")
    if drive and ":" in drive:
        parsed = duration_minutes(drive)
        if parsed is None:
            errors.append("Jízda: zadejte dobu H:MM nejvýše 24:00.")
        elif minutes is not None and minutes != parsed:
            errors.append("Doba jízdy nesouhlasí s počtem minut.")
        else:
            minutes = parsed
    elif drive and not re.fullmatch(r"\d{1,3}", drive):
        errors.append("Jízda: zadejte dobu H:MM.")
    if minutes is not None and (not isinstance(minutes, int) or isinstance(minutes, bool) or not 0 <= minutes <= 1440):
        errors.append("Doba jízdy musí být počet minut od 0 do 1440.")
        minutes = None
    out["drive"] = drive
    out["driveMinutes"] = minutes
    out["journeyRole"] = r.get("journeyRole") if r.get("journeyRole") in ("driver", "passenger", "mixed", "none") else ""
    # No chip-system integration exists. A form or GPS cannot verify a chip event.
    out["chipStatus"] = "unverified"
    acc = r.get("accommodation") or ""
    out["accommodation"] = acc if acc in ("yes", "no", "") else ""
    out["workTimeMode"] = "legacy" if r.get("workTimeMode") == "legacy" else "shift"
    labels = {"billing": "pracovní doba", "service": "servis", "downtime": "prostoj", "travel": "přejezd"}
    for key in ("billing", "service", "downtime", "travel"):
        items = r.get(key) or []
        if not isinstance(items, list) or len(items) > 48:
            errors.append(f"Pole {labels[key]} musí být seznam nejvýše 48 úseků.")
            items = []
        clean = []
        for idx, it in enumerate(items):
            if not isinstance(it, dict):
                continue
            s, e = str(it.get("start") or "").strip(), str(it.get("end") or "").strip()
            if (s and not TIME.match(s)) or (e and not TIME.match(e)) or (confirm and (not s or not e)):
                errors.append(f"Doplňte platný čas od–do ({labels[key]}, řádek {idx + 1}).")
            if s and e and s == e:
                errors.append(f"Začátek a konec úseku ({labels[key]}, řádek {idx + 1}) nesmí být shodné.")
            item = {"start": s, "end": e}
            if key == "travel":
                item["from"] = str(it.get("from") or "").strip()[:200]
                item["to"] = str(it.get("to") or "").strip()[:200]
                if confirm and (not item["from"] or not item["to"]):
                    errors.append(f"Přejezd, řádek {idx + 1}: doplňte odkud (bod A) a kam (bod B).")
            clean.append(item)
        out[key] = clean
    for k in ("dailyCheck", "accessoryCheck", "equipmentCheck"):
        out[k] = r.get(k) is True
    out["fit"] = r.get("fit") if r.get("fit") in ("yes", "no", "unknown") else "unknown"
    out["serviceBy"] = r.get("serviceBy") if r.get("serviceBy") in ("operator", "operator_workshop", "workshop", "external", "") else ""
    for k in ("operatorSignature", "handoverSignature", "workshopSignature"):
        s = r.get(k) or ""
        if s and (not isinstance(s, str) or len(s) > 1_200_000 or not SIG_RE.match(s)):
            errors.append("Podpis musí být obrázek PNG nebo JPEG vytvořený podepisující osobou.")
            s = ""
        out[k] = s
    faults = r.get("faults") or []
    if not isinstance(faults, list) or len(faults) > 100:
        errors.append("Závady musí být seznam nejvýše 100 položek.")
        faults = []
    out["faults"] = []
    for i, f in enumerate(faults):
        if not isinstance(f, dict):
            continue
        fault = {"id": str(f.get("id") or new_id())[:100], "date": str(f.get("date") or out["date"])[:10],
                 "time": str(f.get("time") or "")[:5], "description": str(f.get("description") or "").strip()[:12000],
                 "severity": "stop" if f.get("severity") == "stop" else "normal", "resolved": f.get("resolved") is True,
                 "resolution": str(f.get("resolution") or "").strip()[:12000], "acknowledged": f.get("acknowledged") is True,
                 "reportedToWorkshop": f.get("reportedToWorkshop") is True}
        if not fault["description"]:
            errors.append(f"Doplňte popis závady {i + 1}.")
        if fault["time"] and not TIME.match(fault["time"]):
            errors.append(f"Závada {i + 1} nemá platný čas.")
        if confirm and not fault["time"]:
            errors.append(f"Doplňte čas nahlášení závady {i + 1}.")
        if confirm and fault["resolved"] and not fault["resolution"]:
            errors.append(f"Doplňte způsob odstranění závady {i + 1}.")
        out["faults"].append(fault)
    atts = r.get("attachments") or []
    out["attachments"] = []
    if isinstance(atts, list):
        for a in atts[:50]:
            if isinstance(a, dict) and ID_RE.match(str(a.get("id") or "")):
                out["attachments"].append({"id": a["id"], "name": str(a.get("name") or "")[:300], "type": str(a.get("type") or "")[:100],
                                           "size": int(a.get("size") or 0), "kind": a.get("kind") if a.get("kind") in ("vehicleFuel", "machineFuel", "invoice", "photo", "other") else "other",
                                           "km": str(a.get("km") or "")[:30],
                                           "section": a.get("section") if a.get("section") in ATT_SECTIONS else "general"})
    out["intervalService"] = r.get("intervalService") is True
    if confirm and out["intervalService"] and (not out.get("machine") or not str(r.get("mthEnd") or "").strip()):
        errors.append("Pravidelný servis dle intervalu: vyplňte stroj a konečný stav MTH.")
    for k in ("mthStart", "mthEnd", "diesel", "hydraulic", "oil"):
        if out[k] and _num(out[k]) is None:
            errors.append(f"Pole {k}: zadejte nezáporné číslo (lze desetinnou čárku).")
    if confirm:
        if not out["machine"]:
            errors.append("Vyberte stroj.")
        if not out["operator"]:
            errors.append("Doplňte jméno obsluhy.")
        if not out["billing"]:
            errors.append("Doplňte alespoň jeden úsek pracovní doby.")
        if not out["mthStart"] or not out["mthEnd"]:
            errors.append("Povinnost psát začátek a konec MTH.")
        elif _num(out["mthStart"]) is not None and _num(out["mthEnd"]) is not None and _num(out["mthEnd"]) < _num(out["mthStart"]):
            errors.append("Konečný stav MTH nesmí být nižší než počáteční.")
        elif _num(out["mthStart"]) is not None and _num(out["mthEnd"]) is not None and _num(out["mthEnd"]) - _num(out["mthStart"]) > 24:
            errors.append("Rozdíl MTH přesahuje 24 hodin za den. Ověřte stroj a odečtené hodnoty.")
        bd = time_breakdown(out)
        if bd["ambiguousDay"]:
            errors.append("Pracovní úseky zahrnují 24 hodin nebo více; rozdělte je do samostatných dnů.")
        if bd["serviceOutsideShift"]:
            errors.append("Servis musí ležet uvnitř pracovní doby (servis je její součástí).")
        if bd["downtimeOutsideShift"]:
            errors.append("Prostoj musí ležet uvnitř pracovní doby.")
        if bd.get("travelOutsideShift"):
            errors.append("Přejezd musí ležet uvnitř pracovní doby (pracovní doba = celá směna včetně přejezdů).")
        if bd["serviceHours"] > 0 and not (out["serviceDescription"] or out["repairDescription"]):
            errors.append("K hodinám servisu doplňte popis provedené práce – bez popisu nelze čas započítat.")
        if bd["serviceHours"] > 0 and not out["serviceBy"]:
            errors.append("Uveďte, kdo servis provedl (strojník / dílna výjezd / cizí firma).")
        if out["serviceBy"] == "external" and not out["externalCompany"]:
            errors.append("Uveďte název cizí servisní firmy.")
    return errors, out


async def verify_chain(rid: str) -> dict:
    vs = await db.record_versions.find({"record_id": rid}, {"_id": 0}).sort("revision", 1).to_list(1000)
    prev = CHAIN_GENESIS
    checked = 0
    legacy = 0
    for v in vs:
        if v.get("chain") != 1:
            legacy += 1
            ok = v.get("hash") == hashlib.sha256(json.dumps(v["payload"], sort_keys=True, default=str).encode()).hexdigest()
            if not ok:
                return {"ok": False, "broken_at": v["revision"], "versions": len(vs), "checked": checked, "legacy": legacy, "head": None}
            prev = v["hash"]
            checked += 1
            continue
        if v.get("prev_hash") != prev or chain_hash(prev, v["payload"]) != v.get("hash"):
            return {"ok": False, "broken_at": v["revision"], "versions": len(vs), "checked": checked, "legacy": legacy, "head": None}
        prev = v["hash"]
        checked += 1
    cur = await db.records.find_one({"id": rid}, {"_id": 0})
    # A projection can be edited while retaining its original hash. Compare its
    # actual body with the committed snapshot, not just the copied hash field.
    head_ok = bool(cur and vs and cur.get("integrity_hash") == prev
                   and cur.get("revision") == vs[-1]["revision"]
                   and canonical({k: v for k, v in cur.items() if k not in ("integrity_hash", "prev_hash")}) == canonical(vs[-1]["payload"]))
    return {"ok": head_ok, "broken_at": None if head_ok else (cur or {}).get("revision"), "versions": len(vs),
            "checked": checked, "legacy": legacy, "head": prev if vs else None}


def public_record(doc: dict) -> dict:
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["breakdown"] = time_breakdown(d)
    return d


async def _project_version(version):
    """Replay an immutable committed revision without replacing a newer head.

    Works on standalone MongoDB; no transaction/replica-set requirement.
    Older journal entries without projection_pending are never rewritten.
    """
    rid, rev = version["record_id"], version["revision"]
    rec = {**version["payload"], "integrity_hash": version["hash"], "prev_hash": version["prev_hash"]}
    current = await db.records.find_one({"id": rid}, {"_id": 0})
    if not current:
        try:
            await db.records.insert_one(dict(rec))
        except DuplicateKeyError:
            pass
    elif current["revision"] < rev:
        await db.records.replace_one({"id": rid, "revision": current["revision"]}, rec)
    head = await db.records.find_one({"id": rid}, {"_id": 0})
    if not head or head["revision"] < rev:
        raise HTTPException(503, "Revize je bezpečně uložena, dokončení zápisu zopakujte.")
    if head["revision"] == rev and head.get("integrity_hash") != version["hash"]:
        raise HTTPException(503, "Nesoulad historie zápisu vyžaduje kontrolu správce.")
    await db.record_versions.update_one({"record_id": rid, "revision": rev}, {"$set": {"projection_pending": False}})


async def recover_record_writes(rid=None):
    query = {"projection_pending": True}
    if rid:
        query["record_id"] = rid
    async for version in db.record_versions.find(query, {"_id": 0}).sort("revision", 1):
        await _project_version(version)


async def _can_view(user: dict, rec: dict) -> bool:
    return rec.get("owner_id") == user["id"] or is_manager(user)


@router.get("/records")
async def list_records(mine: int = 0, employee_id: str = "", date_from: str = "", date_to: str = "", machine: str = "",
                       status: str = "", limit: int = 500, user: dict = Depends(get_ready_user)):
    q = {}
    if mine or not is_manager(user):
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
    if status in ("draft", "confirmed"):
        q["status"] = status
    docs = await db.records.find(q, {"_id": 0, "operatorSignature": 0, "handoverSignature": 0, "workshopSignature": 0}) \
        .sort([("date", -1), ("updatedAt", -1)]).to_list(min(max(limit, 1), 2000))
    return [public_record(d) for d in await hydrate_records(docs)]


@router.get("/records/{rid}")
async def get_record(rid: str, user: dict = Depends(get_ready_user)):
    rec = await db.records.find_one({"id": rid}, {"_id": 0})
    if not rec or not await _can_view(user, rec):
        raise HTTPException(status_code=404, detail="Záznam nenalezen.")
    return public_record((await hydrate_records([rec]))[0])


@router.get("/records/{rid}/versions")
async def record_versions(rid: str, user: dict = Depends(get_ready_user)):
    rec = await db.records.find_one({"id": rid}, {"_id": 0, "owner_id": 1})
    if not rec or not await _can_view(user, rec):
        raise HTTPException(status_code=404, detail="Záznam nenalezen.")
    vs = await db.record_versions.find({"record_id": rid}, {"_id": 0}).sort("revision", -1).to_list(500)
    for v in vs:
        for k in ("operatorSignature", "handoverSignature", "workshopSignature"):
            v["payload"].pop(k, None)
        v["payload"]["breakdown"] = time_breakdown(v["payload"])
    return vs


@router.get("/records/{rid}/integrity")
async def record_integrity(rid: str, user: dict = Depends(get_ready_user)):
    rec = await db.records.find_one({"id": rid}, {"_id": 0, "owner_id": 1})
    if not rec or not await _can_view(user, rec):
        raise HTTPException(status_code=404, detail="Záznam nenalezen.")
    return await verify_chain(rid)


@router.put("/records/{rid}")
async def save_record(rid: str, body: dict, user: dict = Depends(get_ready_user)):
    """Idempotent, revisioned save. body: {opId, baseRevision, confirm, correctionReason, record, deviceSavedAt}"""
    op_id = str(body.get("opId") or "")[:100]
    confirm = body.get("confirm") is True
    base = body.get("baseRevision") or 0
    payload = body.get("record") or {}
    if not isinstance(payload, dict) or not isinstance(base, int) or isinstance(base, bool) or base < 0:
        raise HTTPException(400, "Neplatný obsah nebo revize zápisu.")
    payload["id"] = rid
    await recover_record_writes(rid)
    current = await db.records.find_one({"id": rid}, {"_id": 0})
    if current and current["owner_id"] != user["id"] and user["role"] != "operations_manager":
        raise HTTPException(status_code=403, detail="Cizí záznam nelze upravit.")
    if op_id:
        done = await db.record_versions.find_one({"record_id": rid, "op_id": op_id}, {"_id": 0})
        if done:
            cur = await db.records.find_one({"id": rid}, {"_id": 0})
            return {"status": "duplicate", "record": public_record((await hydrate_records([cur]))[0])}
    cur_rev = current["revision"] if current else 0
    if base != cur_rev:
        raise HTTPException(status_code=409, detail={"code": "conflict", "message": "Záznam byl mezitím změněn na jiném zařízení.",
                                                     "server": public_record(current) if current else None})
    errors, rec = validate_record(payload, confirm)
    # Autorizace pravidelného (interval) servisu – jen mechanik, externí servis nebo konkrétní strojník/mechanik Jan Hrbáček.
    if rec and rec.get("intervalService") and confirm and not can_record_interval_service(user, rec.get("serviceBy", "")):
        errors.append("Pravidelný servis (500 mth) může zapsat jen mechanik, externí servisní firma nebo pověřený pracovník (Jan Hrbáček).")
    reason = text(body.get("correctionReason"), 2000)
    if current and current["status"] == "confirmed" and not reason:
        errors.append("Oprava potvrzeného záznamu vyžaduje důvod opravy.")
    if current and current["status"] == "confirmed" and not confirm:
        errors.append("Potvrzený záznam lze opravit pouze novou potvrzenou revizí.")
    if errors:
        raise HTTPException(status_code=422, detail={"code": "invalid", "message": errors[0], "errors": errors})
    if rec["attachments"]:
        ids = [a["id"] for a in rec["attachments"]]
        docs = {d["id"]: d for d in await db.attachments.find({"id": {"$in": ids}, "owner_id": {"$in": [user["id"], current["owner_id"] if current else user["id"]]}, "is_deleted": False},
                                                              {"_id": 0, "id": 1, "sha256": 1}).to_list(100)}
        if len(docs) != len(set(ids)):
            raise HTTPException(status_code=422, detail={"code": "attachments_missing", "message": "Některá příloha ještě nebyla nahrána na server."})
        for a in rec["attachments"]:  # otisk souboru se stává součástí otisku revize
            a["sha256"] = docs[a["id"]].get("sha256", "")
    now = iso_now()
    rev = cur_rev + 1
    rec.update({"owner_id": current["owner_id"] if current else user["id"], "owner_name": current["owner_name"] if current else user["name"], "revision": rev,
                "status": "confirmed" if confirm else "draft", "createdAt": current["createdAt"] if current else (text(payload.get("createdAt"), 40) or now),
                "updatedAt": now, "serverReceivedAt": now, "deviceSavedAt": text(body.get("deviceSavedAt"), 40),
                "author_id": user["id"], "author_name": user["name"], "correctionReason": reason or None,
                "confirmedAt": now if confirm else None, "confirmedBy": user["id"] if confirm else None,
                "last_op_id": op_id})
    snapshot = {k: v for k, v in rec.items() if k not in ("_id", "integrity_hash", "prev_hash")}
    last_v = await db.record_versions.find_one({"record_id": rid}, {"_id": 0, "hash": 1}, sort=[("revision", -1)])
    prev_hash = (last_v or {}).get("hash") or CHAIN_GENESIS
    h = chain_hash(prev_hash, snapshot)
    rec["integrity_hash"] = h
    rec["prev_hash"] = prev_hash
    version = {"record_id": rid, "revision": rev, "op_id": op_id, "payload": snapshot,
                                         "author_id": user["id"], "author_name": user["name"], "at": now,
                                         "status": rec["status"], "correction_reason": reason or None,
               "chain": 1, "prev_hash": prev_hash, "hash": h, "projection_pending": True}
    # The existing unique (record_id, revision) journal is the commit point.
    # Project ONLY the winning revision; a crash is recovered on retry/startup.
    try:
        await db.record_versions.insert_one(version)
    except DuplicateKeyError:
        await recover_record_writes(rid)
        latest = await db.records.find_one({"id": rid}, {"_id": 0})
        done = await db.record_versions.find_one({"record_id": rid, "op_id": op_id}) if op_id else None
        if done and latest and (latest["owner_id"] == user["id"] or user["role"] == "operations_manager"):
            return {"status": "duplicate", "record": public_record((await hydrate_records([latest]))[0])}
        raise HTTPException(409, {"code": "conflict", "message": "Záznam byl souběžně změněn.",
                                   "server": public_record(latest) if latest and await _can_view(user, latest) else None})
    await _project_version(version)
    if current and current["status"] == "confirmed":
        await audit(user, "record_corrected", {"record_id": rid, "revision": rev, "reason": reason, "hash": h})
    elif confirm:
        await audit(user, "record_confirmed", {"record_id": rid, "revision": rev, "hash": h})
    if confirm and rec.get("intervalService") and rec.get("machine") and _num(rec.get("mthEnd", "")) is not None:
        m = await db.machines.find_one({"label": rec["machine"]}, {"_id": 0, "id": 1})
        if m:
            await db.machines.update_one({"id": m["id"]}, {"$set": {"last_service_mth": _num(rec["mthEnd"]), "last_service_date": rec["date"],
                                                                    "last_service_record_id": rid}})
            await audit(user, "interval_service_recorded", {"machine_id": m["id"], "record_id": rid, "mth": rec["mthEnd"]})
    # Push notifikace vedení při STOP závadě (nová neopravená závada).
    if confirm:
        try:
            stops = [f for f in rec.get("faults", []) if f.get("severity") == "stop" and not f.get("resolved")]
            if stops:
                from routes_push import notify_users_by_role
                first = stops[0]
                await notify_users_by_role(["manager", "owner", "operations_manager"], f"STOP závada: {rec.get('machine', '')}",
                                           f"{user['name']} · {first.get('description', '')[:160]}",
                                           url=f"/detail/{rid}", tag=f"stop-{rid}", exclude_user_id=user["id"])
        except Exception:
            pass
    rec.pop("_id", None)
    return {"status": "saved", "record": public_record((await hydrate_records([rec]))[0])}


@router.delete("/records/{rid}")
async def delete_draft(rid: str, user: dict = Depends(get_ready_user)):
    rec = await db.records.find_one({"id": rid}, {"_id": 0})
    if not rec or rec["owner_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Záznam nenalezen.")
    if rec["status"] != "draft" or rec["revision"] > 1:
        raise HTTPException(status_code=400, detail="Smazat lze pouze nikdy nepotvrzený koncept bez historie.")
    await db.records.delete_one({"id": rid})
    await db.record_versions.delete_many({"record_id": rid})
    await audit(user, "draft_deleted", {"record_id": rid})
    return {"ok": True}


# ---------------- attachments ----------------
@router.post("/attachments")
async def upload_attachment(file: UploadFile = File(...), id: str = Form(...), kind: str = Form("other"),
                            km: str = Form(""), record_id: str = Form(""), section: str = Form("general"),
                            user: dict = Depends(get_ready_user)):
    if not ID_RE.match(id):
        raise HTTPException(status_code=400, detail="Neplatný identifikátor přílohy.")
    existing = await db.attachments.find_one({"id": id}, {"_id": 0})
    if existing:
        if existing["owner_id"] != user["id"]:
            raise HTTPException(status_code=409, detail="Identifikátor přílohy je obsazený.")
        return existing  # idempotent re-upload
    ctype = (file.content_type or "application/octet-stream").lower()
    if ctype not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Povolené jsou fotografie, PDF, Word, Excel, CSV, TXT, ODT a ODS.")
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="Soubor je větší než 15 MB.")
    if not data:
        raise HTTPException(status_code=400, detail="Soubor je prázdný.")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    path = f"{APP_PREFIX}/attachments/{user['id']}/{id}.{re.sub(r'[^a-z0-9]', '', ext)[:8] or 'bin'}"
    try:
        result = put_object(path, data, ctype)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Úložiště souborů je dočasně nedostupné. Zkuste odeslat znovu. ({type(e).__name__})")
    doc = {"id": id, "owner_id": user["id"], "record_id": record_id[:100], "name": (file.filename or "soubor")[:300],
           "type": ctype, "size": len(data), "kind": kind if kind in ("vehicleFuel", "machineFuel", "invoice", "photo", "other") else "other",
           "km": km[:30], "section": section if section in ATT_SECTIONS else "general", "storage_path": result["path"], "sha256": hashlib.sha256(data).hexdigest(), "is_deleted": False, "at": iso_now()}
    await db.attachments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/attachments/{aid}")
async def download_attachment(aid: str, user: dict = Depends(get_ready_user)):
    att = await db.attachments.find_one({"id": aid, "is_deleted": False}, {"_id": 0})
    if not att or (att["owner_id"] != user["id"] and not is_manager(user)):
        raise HTTPException(status_code=404, detail="Příloha nenalezena.")
    try:
        data, _ = get_object(att["storage_path"])
    except Exception:
        raise HTTPException(status_code=503, detail="Úložiště souborů je dočasně nedostupné.")
    return Response(content=data, media_type=att["type"], headers={"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Disposition": f"attachment; filename*=UTF-8''{quote(att['name'], safe='')}"})
