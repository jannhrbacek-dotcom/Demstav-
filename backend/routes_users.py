import math
import os
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from core import (db, now_utc, iso_now, new_id, hash_password, verify_password, temp_password, password_problem,
                  create_access_token, public_user, get_current_user, get_ready_user, require_role, audit, text,
                  ROLE_RANK, ROLE_LABELS, COMPANY_NAME, POSITIONS, USERNAME_RE)

router = APIRouter()


# ---------------- auth ----------------
@router.post("/auth/login")
async def login(body: dict, request: Request):
    email = text(body.get("login") or body.get("email") or body.get("username"), 200).lower()
    password = body.get("password") or ""
    ip = request.client.host if request.client else "?"
    ident = f"{ip}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident}, {"_id": 0})
    if att and att.get("count", 0) >= 5 and att.get("locked_until") and att["locked_until"] > iso_now():
        raise HTTPException(status_code=429, detail="Příliš mnoho neúspěšných pokusů. Zkuste to znovu za 15 minut.")
    user = await db.users.find_one({"email": email} if "@" in email else {"username": email}, {"_id": 0})
    if not user or not verify_password(password, user.get("password_hash", "")):
        count = (att.get("count", 0) if att else 0) + 1
        upd = {"identifier": ident, "count": count}
        if count >= 5:
            upd["locked_until"] = (now_utc() + timedelta(minutes=15)).isoformat().replace("+00:00", "Z")
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
        raise HTTPException(status_code=401, detail="Nesprávné přihlašovací jméno / e-mail nebo heslo.")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Účet je deaktivovaný. Obraťte se na správce.")
    await db.login_attempts.delete_many({"identifier": ident})
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login_at": iso_now()}})
    return {"access_token": create_access_token(user), "user": public_user(user), "company": COMPANY_NAME}


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user), "company": COMPANY_NAME}


@router.post("/auth/change-password")
async def change_password(body: dict, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not verify_password(body.get("current_password") or "", full["password_hash"]):
        raise HTTPException(status_code=400, detail="Současné (dočasné) heslo není správně.")
    new = body.get("new_password") or ""
    problem = password_problem(new)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    if verify_password(new, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Nové heslo musí být jiné než současné.")
    tv = full.get("token_version", 0) + 1
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(new), "must_change_password": False,
                                                           "token_version": tv, "password_changed_at": iso_now()}})
    await audit(user, "password_changed", {"user_id": user["id"]})
    full.update({"must_change_password": False, "token_version": tv})
    return {"access_token": create_access_token(full), "user": public_user(full)}


# ---------------- users (admin) ----------------
def _can_manage(actor: dict, target_role: str) -> bool:
    if actor["role"] in ("owner", "operations_manager"):
        return target_role != "owner"
    if actor["role"] == "admin":
        return target_role in ("employee", "manager")
    return False


@router.get("/users")
async def list_users(user: dict = Depends(require_role("manager"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(2000)
    return [public_user(u) for u in users]


async def _clean_username(v, uid):
    un = text(v, 60).lower()
    if not un:
        return ""
    if not USERNAME_RE.match(un):
        raise HTTPException(status_code=400, detail="Přihlašovací jméno: 3–30 znaků, malá písmena bez diakritiky, číslice, tečka, pomlčka.")
    other = await db.users.find_one({"username": un}, {"_id": 0, "id": 1})
    if other and other["id"] != uid:
        raise HTTPException(status_code=409, detail="Toto přihlašovací jméno už používá jiný uživatel.")
    return un


@router.get("/roles")
async def roles_info(user: dict = Depends(get_ready_user)):
    return {"roles": [{"role": r, "label": ROLE_LABELS[r]} for r in ("owner", "operations_manager", "admin", "manager", "employee")],
            "positions": [{"value": k, "label": v} for k, v in POSITIONS.items()]}


@router.post("/users")
async def create_user(body: dict, actor: dict = Depends(require_role("admin"))):
    email = text(body.get("email"), 200).lower()
    name = text(body.get("name"), 200)
    role = body.get("role") or "employee"
    if role not in ROLE_RANK or not _can_manage(actor, role):
        raise HTTPException(status_code=403, detail="Tuto roli nemůžete přidělit.")
    if not name:
        raise HTTPException(status_code=400, detail="Doplňte jméno uživatele.")
    if email and ("@" not in email or email.startswith("@") or email.endswith("@")):
        raise HTTPException(status_code=400, detail="Zkontrolujte e-mailovou adresu.")
    if not email and not text(body.get("username"), 60):
        raise HTTPException(status_code=400, detail="Doplňte přihlašovací jméno nebo e-mail.")
    if email and await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Uživatel s tímto e-mailem už existuje.")
    username = await _clean_username(body.get("username"), None)
    position = body.get("position") if body.get("position") in POSITIONS else "strojnik"
    pw = temp_password()
    wp = [w for w in (body.get("workplace_ids") or []) if isinstance(w, str)][:200]
    doc = {"id": new_id(), "name": name, "role": role, "password_hash": hash_password(pw),
           "must_change_password": True, "active": True, "workplace_ids": wp, "token_version": 0,
           "created_at": iso_now(), "created_by": actor["id"], "position": position if role == "employee" else ""}
    if email:
        doc["email"] = email
    if username:
        doc["username"] = username
    await db.users.insert_one(doc)
    await audit(actor, "user_created", {"user_id": doc["id"], "email": email, "role": role})
    return {"user": public_user(doc), "temporary_password": pw}


@router.patch("/users/{uid}")
async def update_user(uid: str, body: dict, actor: dict = Depends(require_role("manager"))):
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Uživatel nenalezen.")
    upd = {}
    # managers may only assign workplaces to employees
    if actor["role"] == "manager":
        if set(body.keys()) - {"workplace_ids"} or target["role"] != "employee":
            raise HTTPException(status_code=403, detail="Vedoucí může měnit pouze přiřazení pracovišť zaměstnanců.")
    elif not _can_manage(actor, target["role"]):
        raise HTTPException(status_code=403, detail="Tento účet nemůžete upravovat." if target["role"] != "owner" else "Účet vlastníka je chráněný.")
    if "name" in body:
        upd["name"] = text(body["name"], 200) or target["name"]
    if "username" in body:
        un = await _clean_username(body.get("username"), uid)
        if un:
            upd["username"] = un
    if "position" in body:
        if body["position"] not in POSITIONS:
            raise HTTPException(status_code=400, detail="Neznámé pracovní zařazení.")
        upd["position"] = body["position"]
    if "role" in body:
        if body["role"] not in ROLE_RANK or not _can_manage(actor, body["role"]):
            raise HTTPException(status_code=403, detail="Tuto roli nemůžete přidělit.")
        upd["role"] = body["role"]
    if "workplace_ids" in body:
        upd["workplace_ids"] = [w for w in (body.get("workplace_ids") or []) if isinstance(w, str)][:200]
    if "active" in body:
        if target["id"] == actor["id"]:
            raise HTTPException(status_code=400, detail="Vlastní účet nelze deaktivovat.")
        upd["active"] = bool(body["active"])
        upd["deactivated_at"] = None if upd["active"] else iso_now()
        upd["token_version"] = target.get("token_version", 0) + 1
    await db.users.update_one({"id": uid}, {"$set": upd})
    await audit(actor, "user_updated", {"user_id": uid, "changes": {k: v for k, v in upd.items() if k != "token_version"}})
    target.update(upd)
    return public_user(target)


@router.post("/users/{uid}/reset-password")
async def reset_password(uid: str, actor: dict = Depends(require_role("admin"))):
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Uživatel nenalezen.")
    if not _can_manage(actor, target["role"]):
        raise HTTPException(status_code=403, detail="Účet vlastníka je chráněný." if target["role"] == "owner" else "Tento účet nemůžete resetovat.")
    pw = temp_password()
    await db.users.update_one({"id": uid}, {"$set": {"password_hash": hash_password(pw), "must_change_password": True,
                                                    "token_version": target.get("token_version", 0) + 1}})
    await audit(actor, "password_reset", {"user_id": uid})
    return {"temporary_password": pw}


# ---------------- machines ----------------
def _mth(v):
    try:
        return float(str(v).replace(",", ".")) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def service_status(m: dict, current) -> dict:
    """Pravidelný servis každých N mth (výchozí 500). Varování X mth předem (výchozí 100)."""
    interval = m.get("service_interval_mth") or 500
    warn = m.get("service_warn_mth") if m.get("service_warn_mth") is not None else 100
    if current is None:
        return {"current_mth": None, "next_service_mth": None, "remaining_mth": None, "service_state": "unknown",
                "service_interval_mth": interval, "service_warn_mth": warn}
    last = m.get("last_service_mth")
    if last is not None:
        covered = max(round(last / interval), 1) * interval
        nxt = covered + interval
    else:
        nxt = max(math.ceil(current / interval), 1) * interval
    remaining = round(nxt - current, 1)
    state = "due" if remaining <= 0 else "soon" if remaining <= warn else "ok"
    return {"current_mth": round(current, 1), "next_service_mth": nxt, "remaining_mth": remaining, "service_state": state,
            "service_interval_mth": interval, "service_warn_mth": warn}


async def machines_with_status() -> list:
    ms = await db.machines.find({}, {"_id": 0}).sort("label", 1).to_list(1000)
    best = {}
    async for r in db.records.find({"machine": {"$in": [m["label"] for m in ms]}}, {"_id": 0, "machine": 1, "mthEnd": 1, "mthStart": 1, "date": 1}):
        v = _mth(r.get("mthEnd")) or _mth(r.get("mthStart"))
        if v is not None and v > best.get(r["machine"], (-1, ""))[0]:
            best[r["machine"]] = (v, r.get("date", ""))
    out = []
    for m in ms:
        cands = [x for x in (_mth(m.get("operating_hours")), best.get(m["label"], (None,))[0]) if x is not None]
        st = service_status(m, max(cands) if cands else None)
        out.append({**m, **st, "mth_updated": best.get(m["label"], (None, None))[1]})
    return out


@router.get("/machines")
async def list_machines(user: dict = Depends(get_ready_user)):
    return await machines_with_status()


@router.get("/service-alerts")
async def service_alerts(user: dict = Depends(get_ready_user)):
    return [m for m in await machines_with_status() if m.get("active", True) and m["service_state"] in ("soon", "due")]


def _machine_body(body: dict) -> dict:
    label = text(body.get("label"), 200)
    if not label:
        raise HTTPException(status_code=400, detail="Doplňte název stroje (např. Liebherr L566/3).")
    def num(k, lo, hi, cast=float):
        v = body.get(k)
        if v in (None, ""):
            return None
        try:
            v = cast(str(v).replace(",", "."))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Zkontrolujte číselné údaje stroje (rok, výkon, hmotnost, motohodiny).")
        if not lo <= v <= hi:
            raise HTTPException(status_code=400, detail="Zkontrolujte číselné údaje stroje (rok, výkon, hmotnost, motohodiny).")
        return v
    return {"label": label, "type": text(body.get("type"), 200), "internal_number": text(body.get("internal_number"), 100),
            "serial_number": text(body.get("serial_number"), 200), "plate": text(body.get("plate"), 50),
            "manufacturer": text(body.get("manufacturer"), 120),
            "year": num("year", 1950, 2100, int), "power_kw": num("power_kw", 0, 5000),
            "weight_kg": num("weight_kg", 0, 500000), "operating_hours": num("operating_hours", 0, 1000000),
            "note": text(body.get("note"), 500),
            "service_interval_mth": num("service_interval_mth", 10, 100000) or 500,
            "service_warn_mth": num("service_warn_mth", 0, 10000) if body.get("service_warn_mth") not in (None, "") else 100,
            "last_service_mth": num("last_service_mth", 0, 1000000),
            "active": body.get("active", True) is not False}


@router.post("/machines")
async def create_machine(body: dict, actor: dict = Depends(require_role("manager"))):
    doc = {"id": new_id(), **_machine_body(body), "created_at": iso_now(), "created_by": actor["id"]}
    if await db.machines.find_one({"label": doc["label"]}):
        raise HTTPException(status_code=409, detail="Stroj se stejným názvem už v seznamu je.")
    await db.machines.insert_one(doc)
    doc.pop("_id", None)
    await audit(actor, "machine_created", {"machine_id": doc["id"], "label": doc["label"]})
    return doc


@router.put("/machines/{mid}")
async def update_machine(mid: str, body: dict, actor: dict = Depends(require_role("manager"))):
    upd = {k: v for k, v in _machine_body(body).items() if k in body or k == "label"}
    res = await db.machines.update_one({"id": mid}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Stroj nenalezen.")
    await audit(actor, "machine_updated", {"machine_id": mid})
    return await db.machines.find_one({"id": mid}, {"_id": 0})


# ---------------- audit ----------------
@router.get("/audit")
async def list_audit(limit: int = 200, actor: dict = Depends(require_role("admin"))):
    return await db.audit.find({}, {"_id": 0}).sort("at", -1).to_list(min(max(limit, 1), 1000))


async def seed_owner():
    # Ostrý provoz: žádné veřejně známé výchozí heslo ani reset existujícího hesla po restartu.
    email = (os.environ.get("OWNER_EMAIL") or "").strip().lower()
    pw = os.environ.get("OWNER_PASSWORD") or ""
    owner_count = await db.users.count_documents({"role": "owner"})
    if owner_count == 0:
        if not email or len(pw) < 12:
            raise RuntimeError("Pro první spuštění nastavte OWNER_EMAIL a silné OWNER_PASSWORD (min. 12 znaků).")
        await db.users.insert_one({"id": new_id(), "email": email, "name": os.environ.get("OWNER_NAME", "Jednatel DEMSTAV"),
                                   "role": "owner", "password_hash": hash_password(pw), "must_change_password": True,
                                   "active": True, "workplace_ids": [], "token_version": 0, "created_at": iso_now(),
                                   "username": "jednatel"})
    elif email and pw:
        # Existující heslo se NIKDY automaticky nepřepisuje nastavením v prostředí.
        pass

    # Demo účty se v ostrém provozu nesmějí automaticky obnovovat po smazání.
    # Explicitně povolit jen v izolovaném testovacím prostředí.
    if os.environ.get("SEED_DEMO_ACCOUNTS", "").lower() not in ("1", "true", "yes"):
        return
    # Demo accounts for pilot – only created if explicitly enabled in isolated test env.
    demo_pw = os.environ.get("SEED_DEMO_PASSWORD") or ""
    if len(demo_pw) < 12:
        raise RuntimeError("SEED_DEMO_PASSWORD musí mít alespoň 12 znaků, pokud jsou demo účty povoleny.")
    demo = [
        {"email": "admin@demstav.cz", "name": "Správce DEMSTAV", "role": "admin", "pw": demo_pw, "username": "admin"},
        {"email": "vedouci@demstav.cz", "name": "Vedoucí výroby", "role": "manager", "pw": demo_pw, "username": "vedouci"},
        {"email": "strojnik@demstav.cz", "name": "Jan Strojník", "role": "employee", "pw": demo_pw, "username": "strojnik"},
    ]
    if email and await db.users.find_one({"email": email, "role": "owner", "username": {"$exists": False}}):
        if not await db.users.find_one({"username": "jednatel"}):
            await db.users.update_one({"email": email}, {"$set": {"username": "jednatel"}})
    for d in demo:
        ex = await db.users.find_one({"email": d["email"]}, {"_id": 0, "username": 1})
        if ex is not None and not ex.get("username") and not await db.users.find_one({"username": d["username"]}):
            await db.users.update_one({"email": d["email"]}, {"$set": {"username": d["username"]}})
        if ex is None:
            await db.users.insert_one({"id": new_id(), "email": d["email"], "name": d["name"], "role": d["role"],
                                       "password_hash": hash_password(d["pw"]), "must_change_password": True,
                                       "active": True, "workplace_ids": [], "token_version": 0, "created_at": iso_now(),
                                       "username": d["username"], "position": "strojnik" if d["role"] == "employee" else ""})


async def ensure_operations_manager():
    """One-time named account migration. Never reset an existing password on restart."""
    marker = "operations-manager-jakub-karas-v1"
    if await db.migrations.find_one({"id": marker}):
        return
    matches = await db.users.find({"name": {"$regex": r"^\s*Jakub\s+Karas\s*$", "$options": "i"}}, {"_id": 0}).to_list(3)
    if len(matches) > 1:
        raise RuntimeError("Více účtů Jakub Karas: správce musí nejprve ověřit totožnost účtu.")
    if matches:
        account = matches[0]
        if account["role"] != "owner":
            await db.users.update_one({"id": account["id"]}, {"$set": {"role": "operations_manager"}, "$inc": {"token_version": 1}})
    else:
        if await db.users.find_one({"username": "jakub.karas"}):
            raise RuntimeError("Přihlašovací jméno jakub.karas je už obsazené jiným účtem.")
        account = {"id": new_id(), "name": "Jakub Karas", "username": "jakub.karas",
                   "role": "operations_manager",
                   "password_hash": hash_password(temp_password()), "must_change_password": True,
                   "active": True, "workplace_ids": [], "token_version": 0, "created_at": iso_now(),
                   "created_by": "system"}
        await db.users.insert_one(account)
    await audit(None, "operations_manager_provisioned", {"user_id": account["id"], "migration": marker})
    await db.migrations.update_one({"id": marker}, {"$set": {"at": iso_now()}}, upsert=True)
