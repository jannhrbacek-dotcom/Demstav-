"""Selektivní čištění EXPLICITNĚ označených testovacích účtů.
Nikdy nemaže vedení, stroje, pracoviště nebo audit.
Před mazáním je nutný náhled + stažení úplné archivní ZIP kopie dotčených záznamů.
"""
import asyncio
import hashlib
import io
import json
import logging
import os
import re
import zipfile
from datetime import timedelta, date

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from core import db, get_ready_user, require_role, verify_password, audit, iso_now, now_utc
from storage import get_object, delete_object

router = APIRouter()
log = logging.getLogger("demstav.test_cleanup")
DELETE_PHRASE = "SMAZAT TESTOVACÍ ÚČTY"
MAX_USERS = 25
MAX_DOCS = 5000
MAX_ZIP_BYTES = 80 * 1024 * 1024
_guard = asyncio.Lock()

# Pouze kolekce s doloženou vazbou na ID konkrétního uživatele.
USER_FIELDS = {
    "attendance_events": "employee_id",
    "attendance_requests": "employee_id",
    "records": "owner_id",
    "leave_requests": "user_id",
    "planned_exceptions": "user_id",
    "attachments": "owner_id",
    "push_subscriptions": "user_id",
}


def _ids(body):
    raw = body.get("user_ids") or []
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_USERS:
        raise HTTPException(status_code=400, detail="Vyberte 1 až 25 testovacích zaměstnanců.")
    if any(not isinstance(i, str) or len(i) > 100 or not i for i in raw) or len(raw) != len(set(raw)):
        raise HTTPException(status_code=400, detail="Neplatný seznam ID uživatelů.")
    return sorted(raw)


def _fingerprint(data):
    raw = json.dumps(data, sort_keys=True, ensure_ascii=False, default=str, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _snapshot(ids):
    users = await db.users.find({"id": {"$in": ids}}, {"_id": 0}).to_list(MAX_USERS + 1)
    if len(users) != len(ids):
        raise HTTPException(status_code=404, detail="Některý vybraný účet neexistuje.")
    # Kritická ochrana. Role i testovací příznak se ověřují NA SERVERU.
    if any(u.get("role") != "employee" or u.get("is_test") is not True for u in users):
        raise HTTPException(status_code=403, detail="Smazat lze pouze zaměstnance výslovně označené jako TEST. Účty vedení jsou chráněné.")
    data = {"users": sorted(users, key=lambda x: x["id"])}
    for name, field in USER_FIELDS.items():
        docs = await db[name].find({field: {"$in": ids}}, {"_id": 0}).to_list(MAX_DOCS + 1)
        if len(docs) > MAX_DOCS:
            raise HTTPException(status_code=413, detail=f"Příliš mnoho záznamů v {name}, použijte individuální servisní migraci.")
        data[name] = sorted(docs, key=lambda x: str(x.get("id") or x.get("endpoint") or x.get("created_at") or ""))
    record_ids = sorted({r["id"] for r in data["records"]})
    versions = await db.record_versions.find({"record_id": {"$in": record_ids}}, {"_id": 0}).to_list(MAX_DOCS + 1)
    if len(versions) > MAX_DOCS:
        raise HTTPException(status_code=413, detail="Příliš mnoho revizí záznamů.")
    data["record_versions"] = sorted(versions, key=lambda x: (str(x.get("record_id")), str(x.get("revision"))))
    if sum(len(v) for v in data.values()) > MAX_DOCS:
        raise HTTPException(status_code=413, detail="Příliš rozsáhlá data pro tento typ bezpečného čištění.")
    refs = await db.machines.find({"last_service_record_id": {"$in": record_ids}},
                                  {"_id": 0, "label": 1, "last_service_record_id": 1}).to_list(100)
    blockers = []
    if any(u.get("active", True) for u in users):
        blockers.append("Před odstraněním musíte každý vybraný testovací účet deaktivovat, aby už nemohl zapisovat nová data.")
    if refs:
        blockers.append("U některého stroje je poslední pravidelný servis navázán na mazaný záznam.")
    if any(r.get("intervalService") for r in data["records"]):
        blockers.append("Vybrané záznamy obsahují pravidelný servis stroje. Nejprve oddělte a ověřte servisní historii.")
    if any(not a.get("storage_path") for a in data["attachments"]):
        blockers.append("Některá příloha nemá platnou cestu k souboru. Nelze zaručit úplnou zálohu.")
    # Záznamy v ostatních kolekcích nesmí zůstat osiřelé.
    # Existující data jsou různorodá, proto je při neznámých závislostech bezpečnější
    # mazání zastavit než tvrdit, že jsou definitivně odstraněna všechna testovací data.
    if any(a.get("record_id") and a["record_id"] not in {r.get("id") for r in data["records"]}
           for a in data["attachments"]):
        blockers.append("Příloha odkazuje na cizí nebo chybějící provozní záznam. Vyžaduje ruční kontrolu.")
    # Týdenní PDF/XLSX/CSV může obsahovat i docházku či absenci bez provozního zápisu.
    # Proto se po odstranění testovacích dat bezpečně zneplatní VŠECHNY uložené týdenní exporty.
    exported_weeks = await db.weekly_exports.find({}, {"_id": 0, "week": 1}).to_list(5000)
    weeks = sorted({d.get("week") for d in exported_weeks if d.get("week")})
    return data, sorted(set(blockers)), weeks


def _public_preview(ids, data, blockers, weeks):
    return {
        "user_ids": ids,
        "users": [{"id": u["id"], "name": u.get("name"), "username": u.get("username"), "role": u["role"]}
                  for u in data["users"]],
        "counts": {name: len(docs) for name, docs in data.items()},
        "fingerprint": _fingerprint(data),
        "blockers": blockers,
        "affected_weeks": weeks,
        "note": "Stroje, motohodiny, servisní údaje, pracoviště a audit zůstanou zachovány."
    }


@router.post("/admin/test-cleanup/preview")
async def test_cleanup_preview(body: dict, actor: dict = Depends(require_role("admin"))):
    ids = _ids(body)
    data, blockers, weeks = await _snapshot(ids)
    return _public_preview(ids, data, blockers, weeks)


@router.post("/admin/test-cleanup/backup")
async def test_cleanup_backup(body: dict, actor: dict = Depends(require_role("admin"))):
    ids = _ids(body)
    data, blockers, weeks = await _snapshot(ids)
    if blockers:
        raise HTTPException(status_code=409, detail="Nejdřív vyřešte blokované servisní vazby a přílohy: " + " ".join(blockers))
    fp = _fingerprint(data)
    if body.get("fingerprint") != fp:
        raise HTTPException(status_code=409, detail="Data se od náhledu změnila. Proveďte nový náhled.")
    raw = io.BytesIO()
    # Záloha je určena pouze oprávněnému správci. Obsahuje citlivá pracovní data.
    with zipfile.ZipFile(raw, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json", json.dumps({
            "created_at": iso_now(), "user_ids": ids, "fingerprint": fp, "weeks": weeks,
            "notes": "Heslové hashe nejsou v exportu. Obnova účtů vyžaduje reset hesla."
        }, ensure_ascii=False, indent=2))
        for name, docs in data.items():
            safe_docs = [{k: v for k, v in doc.items() if k != "password_hash"} for doc in docs]
            z.writestr(f"data/{name}.json", json.dumps(safe_docs, ensure_ascii=False, default=str, indent=2))
        for a in data["attachments"]:
            path = a["storage_path"]
            try:
                binary, _ = await asyncio.to_thread(get_object, path)
            except Exception as exc:
                log.warning("Missing attachment during cleanup backup, id=%s: %s", a.get("id"), type(exc).__name__)
                raise HTTPException(status_code=503, detail="Příloha není dostupná. Nic nebylo smazáno.")
            if a.get("sha256") and hashlib.sha256(binary).hexdigest() != a["sha256"]:
                raise HTTPException(status_code=409, detail="Kontrolní součet přílohy nesouhlasí, mazání je zablokováno.")
            ext = re.sub(r"[^a-zA-Z0-9]", "", (a.get("name") or "").rsplit(".", 1)[-1])[:8] or "bin"
            z.writestr(f"files/{a['id']}.{ext}", binary)
            if raw.tell() > MAX_ZIP_BYTES:
                raise HTTPException(status_code=413, detail="Záloha přesahuje 80 MB. Nutná samostatná archivace.")
    content = raw.getvalue()
    if len(content) > MAX_ZIP_BYTES:
        raise HTTPException(status_code=413, detail="Záloha přesahuje 80 MB. Nic nebylo smazáno.")
    digest = hashlib.sha256(content).hexdigest()
    token = jwt.encode({
        "type": "test_cleanup_backup", "ids": ids, "fingerprint": fp, "zip_sha256": digest,
        "actor_id": actor["id"], "exp": now_utc() + timedelta(minutes=20)
    }, os.environ["JWT_SECRET"], algorithm="HS256")
    return Response(content=content, media_type="application/zip", headers={
        "Content-Disposition": 'attachment; filename="DEMSTAV_testovaci_ucty_zaloha.zip"',
        "Cache-Control": "no-store", "X-Backup-Token": token, "X-Backup-SHA256": digest
    })


@router.post("/admin/test-cleanup/delete")
async def test_cleanup_delete(body: dict, actor: dict = Depends(require_role("admin"))):
    ids = _ids(body)
    if body.get("confirm") != DELETE_PHRASE or body.get("backup_saved") is not True:
        raise HTTPException(status_code=400, detail="Vyžadujeme přesnou potvrzovací frázi a potvrzení uložení zálohy.")
    full = await db.users.find_one({"id": actor["id"]}, {"_id": 0, "password_hash": 1})
    if not full or not verify_password(body.get("password") or "", full.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Přihlašovací heslo není správné.")
    try:
        token = jwt.decode(body.get("backup_token") or "", os.environ["JWT_SECRET"], algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=409, detail="Potvrzení zálohy vypršelo. Stáhněte ji znovu.")
    if token.get("type") != "test_cleanup_backup" or token.get("ids") != ids or token.get("actor_id") != actor["id"]:
        raise HTTPException(status_code=403, detail="Záloha neodpovídá vybraným účtům.")
    if token.get("zip_sha256") != body.get("backup_sha256"):
        raise HTTPException(status_code=409, detail="Kontrolní součet zálohy nesouhlasí.")
    if _guard.locked():
        raise HTTPException(status_code=409, detail="Jiné čištění právě probíhá.")
    async with _guard:
        data, blockers, weeks = await _snapshot(ids)
        if blockers:
            raise HTTPException(status_code=409, detail="Objevily se servisní vazby. Nic nebylo smazáno.")
        if token.get("fingerprint") != _fingerprint(data):
            raise HTTPException(status_code=409, detail="Data se od stažení zálohy změnila. Proveďte nový náhled a zálohu.")
        # Pozn.: transakce závisí na konfiguraci MongoDB. Tato operace vyžaduje předchozí externí
        # ověřenou zálohu databáze i souborů; ZIP je navíc selektivní záchranná kopie.
        deleted = {}
        record_ids = [r["id"] for r in data["records"]]
        if record_ids:
            deleted["record_versions"] = (await db.record_versions.delete_many({"record_id": {"$in": record_ids}})).deleted_count
        for name, field in USER_FIELDS.items():
            deleted[name] = (await db[name].delete_many({field: {"$in": ids}})).deleted_count
        deleted["users"] = (await db.users.delete_many({"id": {"$in": ids}, "role": "employee", "is_test": True})).deleted_count
        if deleted["users"] != len(ids):
            log.error("Mismatch during cleanup: users deleted %s, expected %s", deleted["users"], len(ids))
        # Staré agregované exporty se nemažou potichu; jsou zneplatněné pro stahování.
        # Zneplatnit všechny, včetně těch, jejichž obsah zahrnoval jen docházku/absence.
        stale_result = await db.weekly_exports.update_many({},
                    {"$set": {"stale": True, "stale_reason": "Testovací data byla odstraněna."}})
        deleted["weekly_exports_invalidated"] = stale_result.modified_count
        await audit(actor, "test_cleanup_deleted", {
            "user_ids": ids, "deleted": deleted, "zip_sha256": body["backup_sha256"], "affected_weeks": weeks
        })
        # Binární soubory se odstraňují až po DB, aby se při pádu mazání nepoškodily záznamy.
        failed_files = []
        for a in data["attachments"]:
            try:
                ok = await asyncio.to_thread(delete_object, a["storage_path"])
            except Exception:
                ok = False
            if not ok:
                failed_files.append(a["id"])
        if failed_files:
            await audit(actor, "test_cleanup_orphaned_files", {"attachment_ids": failed_files})
        return {"ok": True, "deleted": deleted, "orphaned_file_count": len(failed_files),
                "affected_weekly_exports": weeks}
