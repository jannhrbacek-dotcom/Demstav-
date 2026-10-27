"""Web Push notifikace (VAPID).

- `POST /api/push/public-key` → vrací veřejný VAPID klíč pro frontend.
- `POST /api/push/subscribe` → uloží push subscription uživatele.
- `POST /api/push/unsubscribe` → odebere subscription.
- `POST /api/push/test` → pošle testovací notifikaci přihlášenému uživateli.

Notifikace se posílají interně helperem `send_push_to_users(user_ids, title, body, url)`.
"""
import asyncio
import base64
import json
import logging
import os
from typing import Iterable, Optional
from urllib.parse import urlparse
from cryptography.hazmat.primitives.asymmetric import ec

from fastapi import APIRouter, Depends, HTTPException
from pywebpush import webpush, WebPushException

from core import db, get_ready_user, iso_now, new_id, text, require_role

log = logging.getLogger("push")
router = APIRouter()

VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY_FILE = os.environ.get("VAPID_PRIVATE_KEY_FILE", os.path.join(os.path.dirname(__file__), "vapid_private.pem"))
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@demstav.cz")


def _load_private_key() -> Optional[str]:
    # pywebpush accepts a file path or a base64 key, not the PEM file contents.
    return VAPID_PRIVATE_KEY_FILE if os.path.isfile(VAPID_PRIVATE_KEY_FILE) else None


def valid_endpoint(endpoint: str) -> bool:
    """Accept browser push services, never arbitrary URLs supplied by a client."""
    try:
        u = urlparse(endpoint)
        host = (u.hostname or "").lower()
        allowed = host in ("fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com") or host.endswith(".push.apple.com") or host.endswith(".notify.windows.com")
        return bool(allowed and u.scheme == "https" and u.port in (None, 443) and not u.username and not u.password and not u.fragment)
    except ValueError:
        return False


@router.get("/push/public-key")
async def public_key(user: dict = Depends(get_ready_user)):
    if not VAPID_PUBLIC_KEY or not _load_private_key():
        raise HTTPException(status_code=501, detail="Push notifikace nejsou nakonfigurované (chybí VAPID klíč).")
    return {"public_key": VAPID_PUBLIC_KEY}


@router.post("/push/subscribe")
async def subscribe(body: dict, user: dict = Depends(get_ready_user)):
    sub = body.get("subscription") or {}
    if not isinstance(sub, dict) or not isinstance(sub.get("keys"), dict):
        raise HTTPException(status_code=400, detail="Nekompletní subscription (endpoint/keys).")
    endpoint = str(sub.get("endpoint") or "")[:1024]
    keys = sub.get("keys") or {}
    p256dh = str(keys.get("p256dh") or "")[:200]
    auth = str(keys.get("auth") or "")[:200]
    if not valid_endpoint(endpoint) or not p256dh or not auth:
        raise HTTPException(status_code=400, detail="Nekompletní subscription (endpoint/keys).")
    try:
        decode = lambda v: base64.b64decode(v + "=" * (-len(v) % 4), altchars=b"-_", validate=True)
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), decode(p256dh))
        if len(decode(auth)) != 16:
            raise ValueError("auth")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Neplatné klíče push subscription.")
    ua = text(body.get("user_agent"), 500)
    now = iso_now()
    doc = {"user_id": user["id"], "endpoint": endpoint, "p256dh": p256dh, "auth": auth,
           "user_agent": ua, "updated_at": now, "last_seen_at": now, "failed_count": 0}
    await db.push_subscriptions.update_one({"endpoint": endpoint},
        {"$set": doc, "$setOnInsert": {"id": new_id(), "created_at": now}}, upsert=True)
    return {"status": "subscribed"}


@router.post("/push/unsubscribe")
async def unsubscribe(body: dict, user: dict = Depends(get_ready_user)):
    endpoint = str(body.get("endpoint") or "")[:1024]
    if not endpoint:
        raise HTTPException(status_code=400, detail="Chybí endpoint.")
    res = await db.push_subscriptions.delete_one({"endpoint": endpoint, "user_id": user["id"]})
    return {"status": "deleted", "deleted": res.deleted_count}


async def send_push_to_users(user_ids: Iterable[str], title: str, body: str, url: str = "/", tag: str = "demstav"):
    """Odešle web push notifikaci na všechny subscription daných uživatelů.

    Smaže expirované subscription (410) a loguje selhání.
    """
    priv = _load_private_key()
    if not priv or not VAPID_PUBLIC_KEY:
        log.warning("Push notifications disabled – missing VAPID keys")
        return 0
    user_ids = list(user_ids or [])
    if not user_ids:
        return 0
    subs = await db.push_subscriptions.find({"user_id": {"$in": user_ids}}, {"_id": 0}).to_list(2000)
    if not subs:
        return 0
    payload = json.dumps({"title": title[:120], "body": body[:300], "url": url[:200], "tag": tag[:60]})
    sent = 0
    for s in subs:
        if not valid_endpoint(s["endpoint"]):
            continue
        try:
            await asyncio.to_thread(webpush,
                subscription_info={"endpoint": s["endpoint"], "keys": {"p256dh": s["p256dh"], "auth": s["auth"]}},
                data=payload,
                vapid_private_key=priv,
                vapid_claims={"sub": VAPID_SUBJECT},
                ttl=3600,
                timeout=10,
            )
            sent += 1
            await db.push_subscriptions.update_one({"endpoint": s["endpoint"]},
                                                   {"$set": {"last_seen_at": iso_now(), "failed_count": 0}})
        except WebPushException as e:
            status = getattr(e.response, "status_code", 0) if getattr(e, "response", None) is not None else 0
            if status in (404, 410):
                await db.push_subscriptions.delete_one({"endpoint": s["endpoint"]})
            else:
                await db.push_subscriptions.update_one({"endpoint": s["endpoint"]},
                                                       {"$inc": {"failed_count": 1}, "$set": {"last_error": str(e)[:300]}})
                log.warning("push failed status=%s", status)
        except Exception as e:  # noqa: BLE001
            log.warning("push failed (%s)", type(e).__name__)
    return sent


@router.post("/push/test")
async def push_test(user: dict = Depends(get_ready_user)):
    n = await send_push_to_users([user["id"]], "DEMSTAV OPERATIONS", "Zkouška notifikace – vše funguje.", "/dnes", tag="test")
    return {"sent": n}


async def notify_users_by_role(roles: Iterable[str], title: str, body: str, url: str = "/", tag: str = "demstav", exclude_user_id: Optional[str] = None) -> int:
    q = {"role": {"$in": list(roles)}, "active": True}
    if exclude_user_id:
        q["id"] = {"$ne": exclude_user_id}
    users = await db.users.find(q, {"_id": 0, "id": 1}).to_list(1000)
    return await send_push_to_users([u["id"] for u in users], title, body, url, tag)


async def notify_service_threshold(machine_label: str, operator_id: str):
    """Evaluate service intervals when a log arrives, without requiring an open client."""
    from routes_users import machines_with_status
    machines = await machines_with_status()
    m = next((m for m in machines if m["label"] == machine_label and m.get("active", True)), None)
    if not m or m["service_state"] not in ("soon", "due"):
        return
    marker = f"{m['next_service_mth']}:{m['service_state']}"
    if m.get("push_service_marker") == marker:
        return
    managers = await db.users.find({"role": {"$in": ["manager", "owner"]}, "active": True}, {"id": 1}).to_list(1000)
    ids = list({operator_id, *(u["id"] for u in managers)})
    sent = await send_push_to_users(ids, f"Servis: {machine_label}",
        f"Stav {m['current_mth']} mth. Další servis při {m['next_service_mth']} mth.", "/dnes", tag=f"service-{m['id']}")
    if sent:
        await db.machines.update_one({"id": m["id"]}, {"$set": {"push_service_marker": marker}})

