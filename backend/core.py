import os
import re
import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger("demstav")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
ACCESS_HOURS = 12
COMPANY_NAME = os.environ.get("COMPANY_NAME", "DEMSTAV GROUP")

ROLE_RANK = {"employee": 1, "manager": 2, "admin": 3, "owner": 4}
ROLE_LABELS = {"employee": "Strojník", "manager": "Vedoucí výroby", "admin": "Admin", "owner": "Jednatel"}
# Pracovní zařazení zaměstnanců (role "employee" – vidí jen svá data).
POSITIONS = {"strojnik": "Strojník", "mechanik": "Mechanik", "strojnik_mechanik": "Strojník / mechanik", "externi_servis": "Externí servis", "ridic": "Řidič", "strojnik_phm": "Strojník pohonných hmot"}
USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,29}$")


def role_label(u: dict) -> str:
    if u.get("role") == "employee":
        return POSITIONS.get(u.get("position") or "strojnik", "Strojník")
    return ROLE_LABELS.get(u.get("role"), u.get("role"))


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return now_utc().isoformat().replace("+00:00", "Z")


def new_id() -> str:
    return str(uuid.uuid4())


def parse_iso(value) -> Optional[datetime]:
    if not isinstance(value, str) or len(value) > 40:
        return None
    try:
        d = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d
    except ValueError:
        return None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def temp_password() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(10))


def password_problem(pw: str) -> Optional[str]:
    if not isinstance(pw, str) or len(pw) < 8:
        return "Heslo musí mít alespoň 8 znaků."
    if len(pw) > 200:
        return "Heslo je příliš dlouhé."
    if not re.search(r"\d", pw) or not re.search(r"[A-Za-zÁ-ž]", pw):
        return "Heslo musí obsahovat písmeno i číslici."
    return None


def create_access_token(user: dict) -> str:
    payload = {"sub": user["id"], "email": user["email"], "tv": user.get("token_version", 0),
               "exp": now_utc() + timedelta(hours=ACCESS_HOURS), "type": "access"}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def public_user(u: dict) -> dict:
    return {
        "id": u["id"], "email": u["email"], "username": u.get("username", ""), "name": u.get("name", ""), "role": u["role"],
        "role_label": role_label(u), "role_group": ROLE_LABELS.get(u["role"], u["role"]),
        "position": (u.get("position") or "strojnik") if u["role"] == "employee" else "", "active": u.get("active", True),
        "must_change_password": u.get("must_change_password", False),
        "workplace_ids": u.get("workplace_ids", []), "created_at": u.get("created_at"),
        "protected": u["role"] == "owner", "deactivated_at": u.get("deactivated_at"),
    }


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Nejste přihlášeni.")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Přihlášení vypršelo. Přihlaste se znovu; neodeslané záznamy zůstávají v telefonu.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Neplatné přihlášení.")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Neplatné přihlášení.")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Účet není aktivní. Obraťte se na správce.")
    if user.get("token_version", 0) != payload.get("tv", 0):
        raise HTTPException(status_code=401, detail="Přihlášení bylo zneplatněno. Přihlaste se znovu.")
    return user


async def get_ready_user(user: dict = Depends(get_current_user)) -> dict:
    """User who already replaced the temporary password."""
    if user.get("must_change_password"):
        raise HTTPException(status_code=403, detail="Nejprve si změňte dočasné heslo.")
    return user


def require_role(min_role: str):
    async def dep(user: dict = Depends(get_ready_user)) -> dict:
        if ROLE_RANK.get(user["role"], 0) < ROLE_RANK[min_role]:
            raise HTTPException(status_code=403, detail="K této akci nemáte oprávnění.")
        return user
    return dep


def is_manager(user: dict) -> bool:
    return ROLE_RANK.get(user["role"], 0) >= ROLE_RANK["manager"]


async def audit(actor: dict, action: str, payload: dict):
    await db.audit.insert_one({"id": new_id(), "actor_id": actor.get("id") if actor else None,
                               "actor_name": actor.get("name") if actor else "system",
                               "at": iso_now(), "action": action, "payload": payload})


def text(v, max_len=12000) -> str:
    if v is None:
        return ""
    if not isinstance(v, str):
        v = str(v)
    v = v.strip()
    if len(v) > max_len:
        raise HTTPException(status_code=400, detail=f"Text je příliš dlouhý (nejvýše {max_len} znaků).")
    return v

