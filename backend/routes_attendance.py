import base64
import hashlib
import hmac
import json
import math
import secrets
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException
from core import db, iso_now, new_id, get_ready_user, require_role, is_manager, audit, text, parse_iso, now_utc

from break_policy import attendance_break_spans, hydrate_events
from worktime import merge, length, intersection

router = APIRouter()
PRAGUE = ZoneInfo("Europe/Prague")
KINDS = ("arrival", "departure", "break_start", "break_end", "travel_start")
KIND_LABELS = {"arrival": "Příchod", "departure": "Odchod", "break_start": "Začátek přestávky", "break_end": "Konec přestávky",
               "travel_start": "Přejezd na jinou zakázku"}
# Pauza a odjezd na jinou zakázku se jen klepnou – bez QR/GPS. Příchod a odchod se ověřují podle pracoviště (QR + GPS).
TAP_KINDS = ("break_start", "break_end", "travel_start")
QR_TTL_MS = 120_000


def b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def next_state(state: str, kind: str) -> str:
    if kind == "arrival" and state in ("away", "travel"):
        return "working"
    if kind == "departure" and state in ("working", "break", "travel"):
        return "away"
    if kind == "travel_start" and state == "working":
        return "travel"
    if kind == "break_start" and state == "working":
        return "break"
    if kind == "break_end" and state == "break":
        return "working"
    raise ValueError("Tato událost neodpovídá stavu směny.")


def _ms(e):
    d = parse_iso(e.get("effective_at") or e.get("device_at"))
    return d.timestamp() * 1000 if d else None


def projection(events, now_ms=None, frm=-math.inf, to=math.inf, confirmed_only=False):
    now_ms = now_ms or time.time() * 1000
    state, cursor, wp, presence, brk, trv = "away", 0, "", 0, 0, 0
    issues, segments = [], []
    evs = [e for e in events if e["status"] != "rejected" and (not confirmed_only or e["status"] in ("verified", "approved"))]
    evs.sort(key=lambda e: (_ms(e) or 0, e.get("sequence", 0)))

    def add(end):
        nonlocal presence, brk, trv
        if state == "away" or not cursor:
            return
        s, t = max(cursor, frm), min(end, to)
        if t > s:
            segments.append({"from": s, "to": t, "kind": {"break": "break", "travel": "travel"}.get(state, "presence"), "workplace_id": wp})
            presence += t - s
            if state == "break":
                brk += t - s
            if state == "travel":
                trv += t - s
    for e in evs:
        at = _ms(e)
        if at is None or at > now_ms + 60_000:
            issues.append("Budoucí nebo neplatný čas: " + e["id"])
            continue
        try:
            nxt = next_state(state, e["kind"])
            add(at)
            state, cursor = nxt, at
            if e["kind"] == "arrival":
                wp = e["workplace_id"]
        except ValueError:
            issues.append("Návaznost událostí vyžaduje opravu: " + KIND_LABELS.get(e["kind"], e["kind"]))
    add(min(now_ms, to))
    # Union prevents a manual break and the fixed break being deducted twice.
    fixed = attendance_break_spans(segments, events[0].get("_break_overrides", {}) if events else {})
    manual = [[s["from"], s["to"]] for s in segments if s["kind"] == "break"]
    break_spans = merge(fixed + manual)
    brk = length(break_spans)
    trv -= length(intersection([[s["from"], s["to"]] for s in segments if s["kind"] == "travel"], break_spans))
    return {"state": state, "presenceHours": presence / 3.6e6, "breakHours": brk / 3.6e6, "travelHours": trv / 3.6e6,
            "netHours": (presence - brk) / 3.6e6, "issues": issues, "segments": segments, "open": state != "away",
            "workplace_id": wp if state != "away" else None}


def day_bounds_ms(d: str):
    start = datetime.fromisoformat(d).replace(tzinfo=PRAGUE)
    end = (datetime.fromisoformat(d) + timedelta(days=1)).replace(tzinfo=PRAGUE)
    return start.timestamp() * 1000, end.timestamp() * 1000


def prague_date(dt: datetime = None) -> str:
    return (dt or now_utc()).astimezone(PRAGUE).date().isoformat()


def distance_m(a, b, c, d):
    rad = math.pi / 180
    x = math.sin((c - a) * rad / 2) ** 2 + math.cos(a * rad) * math.cos(c * rad) * math.sin((d - b) * rad / 2) ** 2
    return 6371000 * 2 * math.atan2(math.sqrt(x), math.sqrt(max(0, 1 - x)))


def check_gps(w, g, at_ms):
    """Coordinates are used only for this calculation and are never stored."""
    ok = isinstance(g, dict) and all(isinstance(g.get(k), (int, float)) and math.isfinite(g.get(k)) for k in ("latitude", "longitude", "accuracy"))
    if not ok or abs(g["latitude"]) > 90 or abs(g["longitude"]) > 180 or g["accuracy"] < 0:
        return {"result": "unavailable", "distance": None, "accuracy": None}
    dist = distance_m(w["latitude"], w["longitude"], g["latitude"], g["longitude"])
    acc = g["accuracy"]
    cap = parse_iso(g.get("capturedAt"))
    if not cap or abs(cap.timestamp() * 1000 - at_ms) > 120_000:
        res = "stale"
    elif acc > w["max_accuracy"]:
        res = "inaccurate"
    elif dist > w["radius"]:
        res = "outside"
    elif dist + acc > w["radius"]:
        res = "boundary"
    else:
        res = "inside"
    return {"result": res, "distance": round(dist), "accuracy": round(acc)}


def dynamic_qr(w, now_ms=None):
    now_ms = int(now_ms or time.time() * 1000)
    payload = b64(json.dumps({"site": w["id"], "v": w["qr_version"], "iat": now_ms, "exp": now_ms + QR_TTL_MS, "nonce": new_id()}).encode())
    sig = b64(hmac.new(w["secret"].encode(), payload.encode(), hashlib.sha256).digest())
    return {"value": f"DS1.{payload}.{sig}", "expiresAt": datetime.fromtimestamp((now_ms + QR_TTL_MS) / 1000, timezone.utc).isoformat()}


def verify_qr(w, value, at_ms):
    if not w.get("qr_active") or not isinstance(value, str) or len(value) > 2000:
        return None
    if value.startswith("DS0.") and w["qr_mode"] == "static" and w.get("static_hash"):
        if hmac.compare_digest(hashlib.sha256(value.encode()).hexdigest(), w["static_hash"]):
            return {"type": "static", "version": w["qr_version"]}
        return None
    if not value.startswith("DS1.") or w["qr_mode"] != "dynamic":
        return None
    try:
        _, payload, sig = value.split(".")
        exp_sig = b64(hmac.new(w["secret"].encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, exp_sig):
            return None
        p = json.loads(unb64(payload))
        if p.get("site") != w["id"] or p.get("v") != w["qr_version"] or p["exp"] - p["iat"] != QR_TTL_MS or p["iat"] > at_ms + 10_000 or p["exp"] < at_ms:
            return None
        return {"type": "dynamic", "version": w["qr_version"]}
    except Exception:
        return None


def public_wp(w, full=False):
    d = {k: v for k, v in w.items() if k not in ("_id", "secret", "static_hash")}
    if not full and not d.get("has_location"):
        d.pop("latitude", None)
        d.pop("longitude", None)
    return d


def parse_workplace(b: dict, prev: dict = None):
    name, address = text(b.get("name"), 160), text(b.get("address"), 300)
    mode, qr_mode = b.get("mode"), b.get("qr_mode") or "dynamic"
    if not name or not address or mode not in ("qr", "gps", "qr_gps", "manual") or qr_mode not in ("static", "dynamic"):
        raise HTTPException(status_code=400, detail="Doplňte název, adresu a způsob ověření.")
    lat, lng = b.get("latitude"), b.get("longitude")
    has_loc = lat not in (None, "") and lng not in (None, "")
    if not has_loc and mode in ("gps", "qr_gps"):
        raise HTTPException(status_code=400, detail="Pro GPS ověření nejprve zadejte skutečné souřadnice pracoviště.")
    try:
        lat = float(lat) if has_loc else 0.0
        lng = float(lng) if has_loc else 0.0
        radius = int(b.get("radius") or 150)
        max_acc = int(b.get("max_accuracy") or 100)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Zkontrolujte GPS souřadnice, poloměr a přesnost.")
    if abs(lat) > 90 or abs(lng) > 180 or not 10 <= radius <= 10000 or not 1 <= max_acc <= 1000:
        raise HTTPException(status_code=400, detail="Zkontrolujte GPS souřadnice, poloměr (10–10000 m) a přesnost (1–1000 m).")
    prev = prev or {}
    return {"id": prev.get("id") or new_id(), "name": name, "address": address, "latitude": lat, "longitude": lng,
            "has_location": has_loc, "radius": radius, "max_accuracy": max_acc, "mode": mode, "qr_mode": qr_mode,
            "active": b.get("active", True) is not False, "version": prev.get("version", 0) + 1,
            "qr_version": prev.get("qr_version", 1), "qr_active": prev.get("qr_active", mode in ("qr", "qr_gps")),
            "secret": prev.get("secret") or secrets.token_urlsafe(32), "static_hash": prev.get("static_hash"),
            "created_at": prev.get("created_at") or iso_now(), "updated_at": iso_now()}


# ---------------- workplaces ----------------
@router.get("/workplaces")
async def list_workplaces(all: int = 0, user: dict = Depends(get_ready_user)):
    if is_manager(user):
        q = {} if all else {"active": True}
        return [public_wp(w, True) for w in await db.workplaces.find(q, {"_id": 0}).sort("name", 1).to_list(1000)]
    q = {"active": True}
    if user.get("workplace_ids"):
        q["id"] = {"$in": user["workplace_ids"]}
    return [public_wp(w) for w in await db.workplaces.find(q, {"_id": 0}).sort("name", 1).to_list(1000)]


@router.post("/workplaces")
async def create_workplace(body: dict, actor: dict = Depends(require_role("manager"))):
    w = parse_workplace(body)
    await db.workplaces.insert_one(w)
    await audit(actor, "workplace_created", {"workplace_id": w["id"], "name": w["name"], "mode": w["mode"]})
    return public_wp(w, True)


@router.put("/workplaces/{wid}")
async def update_workplace(wid: str, body: dict, actor: dict = Depends(require_role("manager"))):
    prev = await db.workplaces.find_one({"id": wid}, {"_id": 0})
    if not prev:
        raise HTTPException(status_code=404, detail="Pracoviště nenalezeno.")
    w = parse_workplace(body, prev)
    if w["mode"] in ("qr", "qr_gps"):
        w["qr_active"] = True
    await db.workplaces.replace_one({"id": wid}, w)
    await audit(actor, "workplace_updated", {"workplace_id": wid, "version": w["version"]})
    return public_wp(w, True)


@router.post("/workplaces/{wid}/qr/static")
async def static_qr(wid: str, actor: dict = Depends(require_role("manager"))):
    w = await db.workplaces.find_one({"id": wid}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Pracoviště nenalezeno.")
    code = "DS0." + secrets.token_urlsafe(24)
    qv = w.get("qr_version", 1) + 1
    await db.workplaces.update_one({"id": wid}, {"$set": {"static_hash": hashlib.sha256(code.encode()).hexdigest(), "qr_mode": "static",
                                                         "qr_active": True, "qr_version": qv}})
    await audit(actor, "qr_static_issued", {"workplace_id": wid, "qr_version": qv})
    return {"value": code, "qr_version": qv, "note": "Statický QR lze vyfotit nebo přeposlat; přísnější je časově omezený QR."}


@router.post("/workplaces/{wid}/qr/rotate")
async def rotate_qr(wid: str, actor: dict = Depends(require_role("manager"))):
    w = await db.workplaces.find_one({"id": wid}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Pracoviště nenalezeno.")
    await db.workplaces.update_one({"id": wid}, {"$set": {"qr_version": w.get("qr_version", 1) + 1, "static_hash": None,
                                                         "qr_mode": "dynamic", "qr_active": True}})
    await audit(actor, "qr_rotated", {"workplace_id": wid})
    return {"ok": True}


@router.get("/workplaces/{wid}/qr/dynamic")
async def get_dynamic_qr(wid: str, actor: dict = Depends(require_role("manager"))):
    w = await db.workplaces.find_one({"id": wid}, {"_id": 0})
    if not w or w.get("qr_mode") != "dynamic" or not w.get("qr_active"):
        raise HTTPException(status_code=400, detail="Pracoviště nemá aktivní časově omezený QR.")
    return {**dynamic_qr(w), "workplace": w["name"]}


# ---------------- events ----------------
async def _employee_events(emp_id: str, frm: str = None):
    q = {"employee_id": emp_id}
    return await hydrate_events(await db.attendance_events.find(q, {"_id": 0}).sort("sequence", 1).to_list(20000), emp_id)


@router.post("/attendance/events")
async def create_event(b: dict, user: dict = Depends(get_ready_user)):
    eid = str(b.get("id") or "")[:100]
    if len(eid) < 8 or b.get("kind") not in KINDS or not isinstance(b.get("offline", False), bool):
        raise HTTPException(status_code=400, detail="Neplatné údaje docházky.")
    req_hash = hashlib.sha256(json.dumps({k: b.get(k) for k in ("kind", "workplaceId", "deviceAt")}, sort_keys=True).encode()).hexdigest()
    existing = await db.attendance_events.find_one({"id": eid}, {"_id": 0})
    if existing:
        if existing["employee_id"] != user["id"] or existing["request_hash"] != req_hash:
            raise HTTPException(status_code=409, detail="Událost se stejným identifikátorem má jiný obsah.")
        return {"status": "duplicate", "event": existing}
    tap = b["kind"] in TAP_KINDS
    wid = b.get("workplaceId")
    if tap and not wid:
        wid = projection(await _employee_events(user["id"]))["workplace_id"]
    w = await db.workplaces.find_one({"id": wid, "active": True} if not tap else {"id": wid}, {"_id": 0})
    if not w or (user.get("workplace_ids") and w["id"] not in user["workplace_ids"] and not is_manager(user)):
        raise HTTPException(status_code=400, detail="Pracoviště není dostupné nebo vám není přiřazeno.")
    device_at = parse_iso(b.get("deviceAt"))
    if not device_at:
        raise HTTPException(status_code=400, detail="Chybí čas zařízení.")
    received = now_utc()
    offline = b.get("offline") is True
    at_ms = device_at.timestamp() * 1000
    reasons = []
    if device_at > received + timedelta(minutes=2):
        raise HTTPException(status_code=400, detail="Čas události je v budoucnosti. Zkontrolujte hodiny v telefonu.")
    if offline:
        reasons.append("offline")
    elif abs((received - device_at).total_seconds()) > 300:
        reasons.append("device_clock")
    qr_res, gps_res = None, None
    if tap:
        pass
    elif w["mode"] in ("qr", "qr_gps"):
        qr_res = verify_qr(w, b.get("qr"), at_ms if offline else received.timestamp() * 1000)
        if not qr_res:
            reasons.append("qr_invalid" if b.get("qr") else "qr_missing")
    if not tap and w["mode"] in ("gps", "qr_gps"):
        gps_res = check_gps(w, b.get("gps"), at_ms)
        if gps_res["result"] != "inside":
            reasons.append("gps_" + gps_res["result"])
    if not tap and w["mode"] == "manual":
        reasons.append("manual")
    exc_reason = text(b.get("exceptionReason"), 1000)
    if reasons and not offline and not exc_reason and w["mode"] != "manual":
        raise HTTPException(status_code=422, detail={"code": "exception_reason_required", "reasons": reasons,
                                                     "message": "Ověření se nepodařilo. Doplňte důvod – záznam pak schválí vedoucí."})
    events = await _employee_events(user["id"])
    state = projection(events, now_ms=at_ms + 1)["state"]
    try:
        next_state(state, b["kind"])
    except ValueError:
        if not offline:
            raise HTTPException(status_code=400, detail=f"{KIND_LABELS[b['kind']]} neodpovídá stavu směny. Obnovte přehled nebo požádejte o opravu.")
        reasons.append("out_of_order")
    seq = (events[-1]["sequence"] if events else 0) + 1
    ev = {"id": eid, "employee_id": user["id"], "employee_name": user["name"], "workplace_id": w["id"], "workplace_name": w["name"],
          "kind": b["kind"], "device_at": device_at.isoformat().replace("+00:00", "Z"), "received_at": received.isoformat().replace("+00:00", "Z"),
          "effective_at": device_at.isoformat().replace("+00:00", "Z"), "offline": offline,
          "status": "pending_review" if reasons else "verified", "reasons": reasons, "sequence": seq,
          "gps": gps_res, "qr": qr_res, "exception_reason": exc_reason, "mode": "tap" if tap else w["mode"], "request_hash": req_hash,
          "decision": None, "travel_from": text(b.get("travelFrom"), 300) if b["kind"] == "travel_start" else "",
          "travel_to": text(b.get("travelTo"), 300) if b["kind"] == "travel_start" else ""}
    try:
        await db.attendance_events.insert_one(ev)
    except Exception:
        raise HTTPException(status_code=409, detail="Událost už byla přijata.")
    ev.pop("_id", None)
    return {"status": "saved", "event": ev}


@router.get("/attendance/me")
async def my_attendance(days: int = 31, user: dict = Depends(get_ready_user)):
    events = await _employee_events(user["id"])
    today = prague_date()
    f, t = day_bounds_ms(today)
    since = (now_utc() - timedelta(days=min(max(days, 1), 366))).isoformat()
    reqs = await db.attendance_requests.find({"employee_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"today": today, "projection": projection(events), "today_projection": projection(events, frm=f, to=t),
            "events": [e for e in events if (e.get("effective_at") or "") >= since[:10]][::-1], "requests": reqs}


@router.post("/attendance/requests")
async def create_request(b: dict, user: dict = Depends(get_ready_user)):
    rid = str(b.get("id") or "")[:100] or new_id()
    if await db.attendance_requests.find_one({"id": rid}):
        return {"status": "duplicate"}
    reason = text(b.get("reason"), 1000)
    at = parse_iso(b.get("at"))
    kind = b.get("kind")
    if not reason or not at or kind not in KINDS:
        raise HTTPException(status_code=400, detail="Doplňte druh události, skutečný čas a důvod opravy.")
    if at > now_utc() + timedelta(minutes=2):
        raise HTTPException(status_code=400, detail="Čas opravy nesmí být v budoucnosti.")
    w = await db.workplaces.find_one({"id": b.get("workplaceId")}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=400, detail="Vyberte pracoviště.")
    event_id = b.get("eventId") or None
    if event_id and not await db.attendance_events.find_one({"id": event_id, "employee_id": user["id"]}):
        raise HTTPException(status_code=400, detail="Opravovaná událost nenalezena.")
    doc = {"id": rid, "employee_id": user["id"], "employee_name": user["name"], "event_id": event_id, "kind": kind,
           "at": at.isoformat().replace("+00:00", "Z"), "workplace_id": w["id"], "workplace_name": w["name"], "reason": reason,
           "status": "pending", "created_at": iso_now(), "decision": None}
    await db.attendance_requests.insert_one(doc)
    doc.pop("_id", None)
    return {"status": "saved", "request": doc}


# ---------------- manager review ----------------
@router.get("/attendance/review")
async def review_queue(user: dict = Depends(require_role("manager"))):
    evs = await db.attendance_events.find({"status": "pending_review"}, {"_id": 0}).sort("device_at", -1).to_list(1000)
    reqs = await db.attendance_requests.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"events": evs, "requests": reqs}


@router.post("/attendance/events/{eid}/decision")
async def decide_event(eid: str, b: dict, actor: dict = Depends(require_role("manager"))):
    ev = await db.attendance_events.find_one({"id": eid}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Událost nenalezena.")
    if ev["status"] != "pending_review":
        raise HTTPException(status_code=400, detail="O události už bylo rozhodnuto.")
    if ev["employee_id"] == actor["id"] and actor["role"] != "owner":
        raise HTTPException(status_code=403, detail="Vlastní výjimku nemůžete schválit; schválí ji jiný vedoucí.")
    decision = b.get("decision")
    note = text(b.get("note"), 1000)
    if decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Neplatné rozhodnutí.")
    if decision == "reject" and not note:
        raise HTTPException(status_code=400, detail="U zamítnutí uveďte důvod.")
    upd = {"status": "approved" if decision == "approve" else "rejected",
           "decision": {"by": actor["id"], "by_name": actor["name"], "at": iso_now(), "note": note, "decision": decision}}
    eff = parse_iso(b.get("effectiveAt")) if b.get("effectiveAt") else None
    if eff and decision == "approve":
        upd["effective_at"] = eff.isoformat().replace("+00:00", "Z")
    await db.attendance_events.update_one({"id": eid}, {"$set": upd})
    await audit(actor, "attendance_event_" + upd["status"], {"event_id": eid, "employee_id": ev["employee_id"], "note": note})
    return {**ev, **upd}


@router.post("/attendance/requests/{rid}/decision")
async def decide_request(rid: str, b: dict, actor: dict = Depends(require_role("manager"))):
    r = await db.attendance_requests.find_one({"id": rid}, {"_id": 0})
    if not r or r["status"] != "pending":
        raise HTTPException(status_code=404, detail="Žádost nenalezena nebo už vyřízena.")
    if r["employee_id"] == actor["id"] and actor["role"] != "owner":
        raise HTTPException(status_code=403, detail="Vlastní žádost nemůžete schválit.")
    decision, note = b.get("decision"), text(b.get("note"), 1000)
    if decision not in ("approve", "reject") or (decision == "reject" and not note):
        raise HTTPException(status_code=400, detail="Zvolte rozhodnutí; u zamítnutí uveďte důvod.")
    dec = {"by": actor["id"], "by_name": actor["name"], "at": iso_now(), "note": note, "decision": decision}
    if decision == "approve":
        if r.get("event_id"):
            await db.attendance_events.update_one({"id": r["event_id"]}, {"$set": {"effective_at": r["at"], "status": "approved",
                                                                                 "corrected_by_request": rid, "decision": dec}})
        else:
            events = await _employee_events(r["employee_id"])
            seq = (events[-1]["sequence"] if events else 0) + 1
            await db.attendance_events.insert_one({"id": "req-" + rid, "employee_id": r["employee_id"], "employee_name": r["employee_name"],
                                                   "workplace_id": r["workplace_id"], "workplace_name": r["workplace_name"], "kind": r["kind"],
                                                   "device_at": r["at"], "received_at": r["created_at"], "effective_at": r["at"], "offline": False,
                                                   "status": "approved", "reasons": ["correction"], "sequence": seq, "gps": None, "qr": None,
                                                   "exception_reason": r["reason"], "mode": "manual", "request_hash": rid, "decision": dec})
    await db.attendance_requests.update_one({"id": rid}, {"$set": {"status": "approved" if decision == "approve" else "rejected", "decision": dec}})
    await audit(actor, "attendance_request_" + decision, {"request_id": rid, "employee_id": r["employee_id"], "note": note})
    return {"ok": True}


@router.get("/attendance/events")
async def list_events(employee_id: str = "", date_from: str = "", date_to: str = "", user: dict = Depends(require_role("manager"))):
    q = {}
    if employee_id:
        q["employee_id"] = employee_id
    if date_from or date_to:
        q["effective_at"] = {}
        if date_from:
            q["effective_at"]["$gte"] = datetime.fromtimestamp(day_bounds_ms(date_from)[0] / 1000, timezone.utc).isoformat().replace("+00:00", "Z")
        if date_to:
            q["effective_at"]["$lt"] = datetime.fromtimestamp(day_bounds_ms(date_to)[1] / 1000, timezone.utc).isoformat().replace("+00:00", "Z")
    return await db.attendance_events.find(q, {"_id": 0}).sort("effective_at", -1).to_list(5000)
