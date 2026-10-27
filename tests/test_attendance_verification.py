"""Exercise the actual attendance endpoint with an isolated in-memory database."""
import os
import sys
from datetime import timedelta
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from mongomock_motor import AsyncMongoMockClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "demstav_test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import routes_attendance as attendance
import core


@pytest.fixture
def environment(monkeypatch):
    database = AsyncMongoMockClient().demstav
    monkeypatch.setattr(attendance, "db", database)
    monkeypatch.setattr(core, "db", database)
    app = FastAPI()
    app.include_router(attendance.router)
    app.dependency_overrides[attendance.get_ready_user] = lambda: {"id": "employee-1", "name": "Test", "role": "employee"}
    return database, app


@pytest.mark.asyncio
@pytest.mark.parametrize("proof", ["gps", "qr", "bad_gps_good_qr", "bad_qr_good_gps", "neither", "outside", "boundary", "inaccurate", "stale", "expired_qr", "revoked_qr", "offline", "exception", "both_required"])
async def test_verification(environment, proof):
    db, app = environment
    w = attendance.parse_workplace({"name": "Test", "address": "Test", "mode": "gps_or_qr",
        "latitude": 49.8136097, "longitude": 18.3151526, "radius": 150, "max_accuracy": 50})
    if proof == "both_required":
        w["mode"] = "qr_gps"
    now = attendance.now_utc()
    body = {"id": "test-event-12345", "kind": "arrival", "deviceAt": now.isoformat(), "workplaceId": w["id"]}
    gps = {"latitude": w["latitude"], "longitude": w["longitude"], "accuracy": 5, "capturedAt": now.isoformat()}
    if proof in ("gps", "bad_qr_good_gps", "outside", "boundary", "inaccurate", "stale", "offline", "both_required"):
        body["gps"] = gps
    if proof in ("qr", "bad_gps_good_qr", "expired_qr", "revoked_qr"):
        body["qr"] = attendance.dynamic_qr(w, int((now - timedelta(minutes=3) if proof == "expired_qr" else now).timestamp() * 1000))["value"]
    if proof == "revoked_qr":
        w["qr_version"] += 1
    if proof == "bad_gps_good_qr":
        body["gps"] = {**gps, "latitude": 0}
    if proof == "bad_qr_good_gps":
        body["qr"] = "DS1.invalid.signature"
    if proof == "outside":
        gps["latitude"] += 0.01
    if proof == "boundary":
        gps["latitude"] += 0.0013
        gps["accuracy"] = 20
    if proof == "inaccurate":
        gps["accuracy"] = 100
    if proof == "stale":
        gps["capturedAt"] = (now - timedelta(minutes=3)).isoformat()
    if proof == "offline":
        body["offline"] = True
    if proof == "exception":
        body["exceptionReason"] = "GPS bez signálu, poškozený QR"
    await db.workplaces.insert_one(w)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/attendance/events", json=body)
        if proof in ("neither", "outside", "boundary", "inaccurate", "stale", "expired_qr", "revoked_qr", "both_required"):
            assert response.status_code == 422, response.text
            assert await db.attendance_events.count_documents({}) == 0
        else:
            assert response.status_code == 200, response.text
            event = response.json()["event"]
            assert event["status"] == ("pending_review" if proof in ("offline", "exception") else "verified")
            assert event["verification_method"] == ("qr" if proof in ("qr", "bad_gps_good_qr") else None if proof == "exception" else "gps")
            assert "latitude" not in (event.get("gps") or {})
            duplicate = await client.post("/attendance/events", json=body)
            assert duplicate.json()["status"] == "duplicate"
            assert await db.attendance_events.count_documents({}) == 1
            if proof not in ("offline", "exception"):
                body.update(id="departure-12345", kind="departure", deviceAt=attendance.now_utc().isoformat())
                departure = await client.post("/attendance/events", json=body)
                assert departure.status_code == 200, departure.text
                assert departure.json()["event"]["status"] == "verified"


@pytest.mark.asyncio
async def test_seed_preserves_manager_changes(environment):
    db, _ = environment
    await attendance.seed_attendance_workplace()
    w = await db.workplaces.find_one({})
    assert w["latitude"] == 49.8136097
    assert w["longitude"] == 18.3151526
    assert w["mode"] == "gps_or_qr"
    await db.workplaces.update_one({"id": w["id"]}, {"$set": {"radius": 222, "active": False}})
    await attendance.seed_attendance_workplace()
    assert await db.workplaces.count_documents({}) == 1
    w = await db.workplaces.find_one({})
    assert w["radius"] == 222 and w["active"] is False


@pytest.mark.parametrize("coordinate", [float("nan"), float("inf")])
def test_reject_nonfinite_workplace(coordinate):
    with pytest.raises(attendance.HTTPException):
        attendance.parse_workplace({"name": "Test", "address": "Test", "mode": "gps_or_qr", "latitude": coordinate, "longitude": 18})
