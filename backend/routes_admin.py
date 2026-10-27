"""Základní administrace. Plošný reset je trvale vypnutý kvůli ochraně ostrých záznamů.
Pro výběrové mazání TESTOVACÍCH zaměstnanců slouží routes_test_cleanup.py.
"""
from fastapi import APIRouter, Depends, HTTPException
from core import db, require_role

router = APIRouter()

@router.get("/admin/data-stats")
async def data_stats(user: dict = Depends(require_role("admin"))):
    names = ["users", "machines", "workplaces", "attendance_events", "attendance_requests",
             "records", "record_versions", "leave_requests", "planned_exceptions",
             "weekly_exports", "attachments", "audit", "push_subscriptions"]
    result = {}
    for name in names:
        result[name] = await db[name].count_documents({})
    return result

@router.post("/admin/wipe-data")
async def wipe_data_disabled(body: dict, user: dict = Depends(require_role("admin"))):
    raise HTTPException(status_code=410, detail="Plošný reset je zakázaný. Použijte bezpečné selektivní čištění testovacích účtů.")
