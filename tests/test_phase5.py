"""Focused API regressions. MongoDB is replaced by an in-memory test database."""
import base64
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "demstav_test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import httpx
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import FastAPI
from mongomock_motor import AsyncMongoMockClient
from pywebpush import WebPushException
import core
import routes_push as push
import routes_records as records
import routes_exceptions as exceptions
import routes_data as data
import routes_leave as leave
import routes_attendance as attendance
import routes_users as users


@pytest.fixture
def api(monkeypatch):
    db = AsyncMongoMockClient().demstav
    for module in (core, push, records, exceptions, data, leave, attendance, users):
        monkeypatch.setattr(module, "db", db)
    user = {"id": "operator", "name": "Testovací strojník", "role": "employee", "position": "strojnik"}
    app = FastAPI()
    for router in (push.router, records.router, exceptions.router, data.router):
        app.include_router(router, prefix="/api")
    app.dependency_overrides[core.get_ready_user] = lambda: user
    return app, db, user


def subscription():
    public = ec.generate_private_key(ec.SECP256R1()).public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    enc = lambda x: base64.urlsafe_b64encode(x).decode().rstrip("=")
    return {"endpoint": "https://fcm.googleapis.com/fcm/send/test", "keys": {"p256dh": enc(public), "auth": enc(b"0123456789abcdef")}}


@pytest.mark.asyncio
async def test_operator_cannot_unlock_interval_service_by_selecting_external(api):
    app, db, user = api
    rec = {"date": "2026-10-27", "machine": "L566/3", "operator": user["name"], "mthStart": "400", "mthEnd": "500",
           "billing": [{"start": "06:00", "end": "15:00"}], "service": [{"start": "13:00", "end": "14:00"}],
           "serviceBy": "external", "externalCompany": "Test servis", "serviceDescription": "Výměna oleje", "intervalService": True}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as c:
        r = await c.put("/api/records/record1", json={"record": rec, "confirm": True})
        assert r.status_code == 422
        assert "jen mechanik" in r.text
        assert await db.records.count_documents({}) == 0
        user["position"] = "externi_servis"
        r = await c.put("/api/records/record1", json={"record": rec, "confirm": True})
        assert r.status_code == 200, r.text


@pytest.mark.parametrize("position", ["mechanik", "strojnik_mechanik", "externi_servis"])
def test_authorized_positions(position):
    assert records.can_record_interval_service({"position": position}, "operator")


@pytest.mark.asyncio
async def test_exceptions_invalid_date_scope_and_employee_summary(api):
    app, db, user = api
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as c:
        payload = {"kind": "late_arrival", "date": "2026-02-30", "time_from": "09:00", "reason": "Rodinné důvody"}
        r = await c.post("/api/exceptions", json=payload)
        assert r.status_code == 400
        payload.update(date="2026-10-27", id="exc1")
        assert (await c.post("/api/exceptions", json=payload)).status_code == 200
        assert (await c.post("/api/exceptions", json=payload)).json()["status"] == "duplicate"
        assert await db.planned_exceptions.count_documents({}) == 1
        user.update(id="other", name="Jiný zaměstnanec")
        assert (await c.get("/api/exceptions?employee_id=operator")).json() == []
        assert (await c.delete("/api/exceptions/exc1")).status_code == 403
        user.update(role="manager")
        rows = (await c.get("/api/exceptions?employee_id=operator")).json()
        assert len(rows) == 1
        result = await c.get("/api/my/summary?employee_id=operator&date_from=2026-10-26&date_to=2026-11-01")
        assert result.status_code == 200, result.text
        assert result.json()["exceptions"][0]["id"] == "exc1"


@pytest.mark.asyncio
async def test_push_configuration_subscription_validation_and_ownership(api, monkeypatch):
    app, db, user = api
    monkeypatch.setattr(push, "VAPID_PUBLIC_KEY", "public")
    monkeypatch.setattr(push, "_load_private_key", lambda: None)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as c:
        assert (await c.get("/api/push/public-key")).status_code == 501
        sub = subscription()
        assert (await c.post("/api/push/subscribe", json={"subscription": sub})).status_code == 200
        assert (await c.post("/api/push/subscribe", json={"subscription": sub})).status_code == 200
        assert await db.push_subscriptions.count_documents({}) == 1
        assert (await c.post("/api/push/subscribe", json={"subscription": []})).status_code == 400
        bad = {**sub, "endpoint": "https://127.0.0.1/private"}
        assert (await c.post("/api/push/subscribe", json={"subscription": bad})).status_code == 400
        bad = {**sub, "keys": {"p256dh": "broken", "auth": "broken"}}
        assert (await c.post("/api/push/subscribe", json={"subscription": bad})).status_code == 400
        user["id"] = "other"
        assert (await c.post("/api/push/unsubscribe", json={"endpoint": sub["endpoint"]})).json()["deleted"] == 0


@pytest.mark.asyncio
async def test_push_delivery_and_expired_subscription_cleanup(api, monkeypatch):
    _, db, user = api
    sub = subscription()
    await db.push_subscriptions.insert_one({"endpoint": sub["endpoint"], **sub["keys"], "user_id": user["id"]})
    monkeypatch.setattr(push, "VAPID_PUBLIC_KEY", "public")
    monkeypatch.setattr(push, "_load_private_key", lambda: "/private/vapid.pem")
    sender = Mock()
    monkeypatch.setattr(push, "webpush", sender)
    assert await push.send_push_to_users([user["id"]], "Test", "Zpráva") == 1
    assert sender.call_args.kwargs["vapid_private_key"] == "/private/vapid.pem"
    assert sender.call_args.kwargs["timeout"] == 10
    sender.side_effect = WebPushException("gone", response=SimpleNamespace(status_code=410))
    assert await push.send_push_to_users([user["id"]], "Test", "Zpráva") == 0
    assert await db.push_subscriptions.count_documents({}) == 0


@pytest.mark.asyncio
async def test_service_threshold_retries_failed_delivery_and_deduplicates_success(api, monkeypatch):
    _, db, _ = api
    await db.machines.insert_one({"id": "m1", "label": "L566/3", "operating_hours": 450, "service_interval_mth": 500})
    await db.users.insert_one({"id": "manager", "role": "manager", "active": True})
    deliveries = []
    async def deliver(ids, *args, **kwargs):
        deliveries.append(ids)
        return 0 if len(deliveries) == 1 else 1
    monkeypatch.setattr(push, "send_push_to_users", deliver)
    await push.notify_service_threshold("L566/3", "operator")
    await push.notify_service_threshold("L566/3", "operator")
    await push.notify_service_threshold("L566/3", "operator")
    assert len(deliveries) == 2
    assert set(deliveries[1]) == {"operator", "manager"}


def test_vapid_generator_creates_usable_key_and_refuses_overwrite(tmp_path, monkeypatch, capsys):
    import generate_vapid
    from py_vapid import Vapid
    dest = tmp_path / "private.pem"
    monkeypatch.setattr(sys, "argv", ["generate_vapid", "--private-file", str(dest)])
    generate_vapid.main()
    assert "VAPID_PUBLIC_KEY=" in capsys.readouterr().out
    assert Vapid.from_file(str(dest)).private_key is not None
    original = dest.read_bytes()
    with pytest.raises(FileExistsError):
        generate_vapid.main()
    assert dest.read_bytes() == original
