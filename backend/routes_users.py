import os
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from core import (db, now_utc, iso_now, new_id, hash_password, verify_password, temp_password, password_problem,
                  create_access_token, public_user, get_current_user, get_ready_user, require_role, audit, text,
                  ROLE_RANK, ROLE_LABELS, COMPANY_NAME)

router = APIRouter()


# ---------------- auth ----------------
@router.post("/auth/login")
async def login(body: dict, request: Request):
    email = text(body.get("email"), 200).lower()
    password = body.get("password") or ""
    ip = request.client.host if request.client else "?"
    ident = f"{ip}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident}, {"_id": 0})
    if att and att.get("count", 0) >= 5 and att.get("locked_until") and att["locked_until"] > iso_now():
        raise HTTPException(status_code=429, detail="Příliš mnoho neúspěšných pokusů. Zkuste to znovu za 15 minut.")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(password, user.get("password_hash", "")):
        count = (att.get("count", 0) if att else 0) + 1
        upd = {"identifier": ident, "count": count}
        if count >= 5:
            upd["locked_until"] = (now_utc() + timedelta(minutes=15)).isoformat().replace("+00:00", "Z")
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
        raise HTTPException(status_code=401, detail="Nesprávný e-mail nebo heslo.")
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
    if actor["role"] == "owner":
        return target_role != "owner"
    if actor["role"] == "admin":
        return target_role in ("employee", "manager")
    return False


@router.get("/users")
async def list_users(user: dict = Depends(require_role("manager"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(2000)
    return [public_user(u) for u in users]


@router.post("/users")
async def create_user(body: dict, actor: dict = Depends(require_role("admin"))):
    email = text(body.get("email"), 200).lower()
    name = text(body.get("name"), 200)
    role = body.get("role") or "employee"
    if role not in ROLE_RANK or not _can_manage(actor, role):
        raise HTTPException(status_code=403, detail="Tuto roli nemůžete přidělit.")
    if "@" not in email or not name:
        raise HTTPException(status_code=400, detail="Doplňte jméno a platný e-mail.")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Uživatel s tímto e-mailem už existuje.")
    pw = temp_password()
    wp = [w for w in (body.get("workplace_ids") or []) if isinstance(w, str)][:200]
    doc = {"id": new_id(), "email": email, "name": name, "role": role, "password_hash": hash_password(pw),
           "must_change_password": True, "active": True, "workplace_ids": wp, "token_version": 0,
           "created_at": iso_now(), "created_by": actor["id"]}
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
@router.get("/machines")
async def list_machines(user: dict = Depends(get_ready_user)):
    return await db.machines.find({}, {"_id": 0}).sort("label", 1).to_list(1000)


def _machine_body(body: dict) -> dict:
    label = text(body.get("label"), 200)
    if not label:
        raise HTTPException(status_code=400, detail="Doplňte název stroje (např. Liebherr L566/3).")
    return {"label": label, "type": text(body.get("type"), 200), "internal_number": text(body.get("internal_number"), 100),
            "serial_number": text(body.get("serial_number"), 200), "plate": text(body.get("plate"), 50),
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
    upd = _machine_body(body)
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
    email = os.environ.get("OWNER_EMAIL", "vlastnik@demstav.cz").lower()
    pw = os.environ.get("OWNER_PASSWORD", "Demstav2026!")
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({"id": new_id(), "email": email, "name": os.environ.get("OWNER_NAME", "Vlastník firmy"),
                                   "role": "owner", "password_hash": hash_password(pw), "must_change_password": False,
                                   "active": True, "workplace_ids": [], "token_version": 0, "created_at": iso_now()})
    elif not verify_password(pw, existing["password_hash"]) and not existing.get("password_changed_at"):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pw)}})

    # Demo accounts for pilot – only created if missing; passwords never reset once user logs in and changes them.
    demo = [
        {"email": "admin@demstav.cz", "name": "Správce DEMSTAV", "role": "admin", "pw": "Demstav2026!"},
        {"email": "vedouci@demstav.cz", "name": "Vedoucí směny", "role": "manager", "pw": "Demstav2026!"},
        {"email": "strojnik@demstav.cz", "name": "Jan Strojník", "role": "employee", "pw": "Demstav2026!"},
    ]
    for d in demo:
        if await db.users.find_one({"email": d["email"]}) is None:
            await db.users.insert_one({"id": new_id(), "email": d["email"], "name": d["name"], "role": d["role"],
                                       "password_hash": hash_password(d["pw"]), "must_change_password": False,
                                       "active": True, "workplace_ids": [], "token_version": 0, "created_at": iso_now()})
