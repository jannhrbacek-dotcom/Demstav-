"""One-time guarded production registration of machine from the physical diary cover.

The migration does not touch timesheets, attendance, previous service dates or other
machines. Restarting the server cannot create a duplicate.
"""
import logging
import re
from core import db, new_id, iso_now
from routes_users import _machine_body, audit

log = logging.getLogger("demstav.machine-registration")

MARKER = "machine-l576-5-vatz1459vzb060956-20261028-v1"
SERIAL = "VATZ1459VZB060956"
LABEL = "L576/5"
SPEC = {
    "label": LABEL,
    "type": "L576",
    "manufacturer": "Liebherr",
    "internal_number": "5",
    "serial_number": SERIAL,
    "operating_hours": 8446,
    "service_interval_mth": 500,
    "service_warn_mth": 100,
    "last_service_mth": None,
    "note": "Deník založen 05.02.2026. Výrobní číslo ověřeno podle titulní stránky; řídicí jednotka uvádí 60956. Údaj o posledním provedeném servisu nebyl dodán.",
    "active": True,
}

async def register_l576_5():
    if await db.migrations.find_one({"id": MARKER}):
        log.info("Machine registration %s already done.", MARKER)
        return "already_done"

    # Detect existing copies even if their labels differ from the requested style.
    matches = await db.machines.find({"$or": [
        {"serial_number": {"$regex": "^" + re.escape(SERIAL) + "$", "$options": "i"}},
        {"label": {"$regex": r"^(?:Liebherr\s+)?L\s*576\s*[/\-]\s*5$", "$options": "i"}},
        {"manufacturer": {"$regex": "^Liebherr$", "$options": "i"}, "type": {"$regex": "^L576$", "$options": "i"}, "internal_number": "5"},
    ]}, {"_id": 0}).to_list(10)

    if len(matches) > 1:
        log.error("Machine L576/5 has %d possible duplicates; no write performed.", len(matches))
        return "conflict"
    if matches:
        old = matches[0]
        if old.get("serial_number") and old["serial_number"].upper() != SERIAL:
            log.error("Machine label L576/5 already belongs to another serial; no write performed.")
            return "conflict"
        if old.get("type") and old["type"].replace(" ", "").upper() not in ("L576", "576"):
            log.error("Machine serial %s has conflicting model; no write performed.", SERIAL)
            return "conflict"
        # Update only confirmed fields, never overwrite historical dates/last service.
        previous = old.get("operating_hours")
        try:
            previous = float(str(previous).replace(",", ".")) if previous not in ("", None) else 0
        except (ValueError, TypeError):
            previous = 0
        updates = {
            "serial_number": SERIAL,
            "type": "L576",
            "manufacturer": "Liebherr",
            "internal_number": "5",
            "service_interval_mth": 500,
            "service_warn_mth": 100,
            "operating_hours": max(previous, 8446),
        }
        await db.machines.update_one({"id": old["id"]}, {"$set": updates})
        mid, action = old["id"], "updated"
    else:
        doc = {"id": new_id(), **_machine_body(SPEC), "created_at": iso_now(), "created_by": "migration:" + MARKER}
        # Idempotent by deterministic migration marker; single production web worker.
        await db.machines.insert_one(doc)
        mid, action = doc["id"], "created"

    await audit(None, "machine_registered_from_diary", {"machine_id": mid, "label": LABEL, "serial_number": SERIAL, "migration": MARKER, "operation": action})
    await db.migrations.update_one({"id": MARKER}, {"$set": {"at": iso_now(), "machine_id": mid, "operation": action}}, upsert=True)
    log.info("Machine registration %s: %s; id=%s, serial=%s, interval=500, reading>=8446.", MARKER, action, mid, SERIAL)
    return action
