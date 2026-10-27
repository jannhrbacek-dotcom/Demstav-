"""Administrátorské operace nad daty.

- `GET /api/admin/data-stats` – počty záznamů v jednotlivých kolekcích (pro UI potvrzení).
- `POST /api/admin/wipe-data` – nevratné smazání dat zaměstnanců (docházka, zápisy, přílohy,
  žádosti o volno, plánované výjimky, revize, týdenní exporty, přílohy v objektovém úložišti).
  Vyžaduje roli `owner` nebo `admin`, heslo přihlášeného účtu a potvrzovací frázi `SMAZAT TRVALE`.
  Zachovává: uživatele, stroje, pracoviště, push odběry, audit log a login_attempts.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException

from core import db, get_ready_user, require_role, verify_password, audit, iso_now
from storage import delete_object

log = logging.getLogger("admin")
router = APIRouter()

CONFIRM_PHRASE = "SMAZAT TRVALE"

EMPLOYEE_COLLECTIONS = [
    "attendance_events", "attendance_requests", "records", "record_versions",
    "leave_requests", "planned_exceptions", "weekly_exports",
]


@router.get("/admin/data-stats")
async def data_stats(user: dict = Depends(require_role("admin"))):
    out = {}
    for name in EMPLOYEE_COLLECTIONS + ["attachments", "users", "machines", "workplaces", "audit", "push_subscriptions"]:
        try:
            out[name] = await db[name].count_documents({})
        except Exception:
            out[name] = None
    return out


@router.post("/admin/wipe-data")
async def wipe_data(body: dict, user: dict = Depends(require_role("admin"))):
    # Bezpečnostní pojistka: původní implementace maže bez filtru i produkční deníky.
    # Hromadný reset zůstává deaktivován, dokud nebude existovat selektivní mazání
    # identifikovaných TESTOVACÍCH účtů a ověřená obnovitelná záloha DB a příloh.
    raise HTTPException(status_code=403, detail="Plošné mazání je z bezpečnostních důvodů deaktivováno. Použijte cílené čištění testovacích účtů po ověřené záloze.")

    confirm = (body.get("confirm") or "").strip()
    if confirm != CONFIRM_PHRASE:
        raise HTTPException(status_code=400, detail=f'Pro potvrzení smazání napište přesně: "{CONFIRM_PHRASE}".')
    password = body.get("password") or ""
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not full or not verify_password(password, full.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Pro potvrzení zadejte své přihlašovací heslo.")

    options = body.get("options") or {}
    reset_machine_mth = bool(options.get("reset_machine_mth"))

    stats_before = {name: await db[name].count_documents({}) for name in EMPLOYEE_COLLECTIONS + ["attachments"]}
    deleted = {}

    # 1) Smazání dat zaměstnanců (bez uživatelů, strojů, pracovišť).
    for name in EMPLOYEE_COLLECTIONS:
        res = await db[name].delete_many({})
        deleted[name] = res.deleted_count

    # 2) Přílohy – nejdřív smazat soubory v objektovém úložišti, pak metadata.
    att_cursor = db.attachments.find({}, {"_id": 0, "path": 1})
    deleted_files = 0
    failed_files = 0
    async for a in att_cursor:
        p = a.get("path")
        if not p:
            continue
        try:
            if delete_object(p):
                deleted_files += 1
            else:
                failed_files += 1
        except Exception as e:  # noqa: BLE001
            log.warning("wipe: failed to delete object %s: %s", p, e)
            failed_files += 1
    att_res = await db.attachments.delete_many({})
    deleted["attachments"] = att_res.deleted_count
    deleted["attachment_files"] = deleted_files
    deleted["attachment_files_failed"] = failed_files

    # 3) Volitelně reset motohodin / termínu posledního servisu u strojů.
    if reset_machine_mth:
        upd = await db.machines.update_many({}, {"$unset": {"last_service_mth": "", "last_service_date": "",
                                                            "last_service_record_id": "", "current_mth": ""}})
        deleted["machines_mth_reset"] = upd.modified_count

    await audit(user, "data_wiped", {"stats_before": stats_before, "deleted": deleted, "reset_mth": reset_machine_mth,
                                     "at": iso_now()})
    return {"status": "ok", "deleted": deleted, "stats_before": stats_before}
