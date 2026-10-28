"""Data statistics and permanently disabled legacy global wipe endpoint."""
from fastapi import APIRouter, Depends, HTTPException

from core import db, require_role
router = APIRouter()

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
    raise HTTPException(410, "Globální mazání je vypnuté. Použijte pouze zvlášť ověřený selektivní postup se zálohou.")
