"""Cloud portability regressions. No production database or credentials are used."""
import importlib
import os
import sys
from pathlib import Path

import httpx
import pytest
from mongomock_motor import AsyncMongoMockClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "demstav_test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import storage
import routes_users


@pytest.fixture
def local_storage(monkeypatch, tmp_path):
    monkeypatch.setenv("VAPID_PRIVATE_KEY_FILE", str(tmp_path / "vapid.pem"))
    monkeypatch.delenv("VAPID_PUBLIC_KEY", raising=False)
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    monkeypatch.setenv("STORAGE_LOCAL_ROOT", str(tmp_path / "objects"))
    return tmp_path / "objects"


def test_object_bytes_type_and_restart(local_storage):
    payload = b"\x00\xff\nPDF/image payload"
    storage.put_object("demstav/attachment/photo", payload, "image/jpeg")
    importlib.reload(storage)
    assert storage.get_object("demstav/attachment/photo") == (payload, "image/jpeg")
    assert storage.delete_object("demstav/attachment/photo")
    assert storage.delete_object("demstav/attachment/photo")
    with pytest.raises(FileNotFoundError):
        storage.get_object("demstav/attachment/photo")


def test_object_keys_cannot_escape_storage(local_storage):
    storage.put_object("../../escape", b"safe", "text/plain")
    assert len(list(local_storage.iterdir())) == 1
    assert not (local_storage.parent / "escape").exists()
    assert storage.get_object("../../escape") == (b"safe", "text/plain")


@pytest.mark.asyncio
async def test_owner_bootstrap_has_no_defaults_or_restart_reset(monkeypatch):
    db = AsyncMongoMockClient().demstav
    monkeypatch.setattr(routes_users, "db", db)
    monkeypatch.delenv("OWNER_EMAIL", raising=False)
    monkeypatch.delenv("OWNER_PASSWORD", raising=False)
    monkeypatch.delenv("SEED_DEMO_ACCOUNTS", raising=False)
    with pytest.raises(RuntimeError):
        await routes_users.seed_owner()
    assert await db.users.count_documents({}) == 0
    monkeypatch.setenv("OWNER_EMAIL", "owner@example.test")
    monkeypatch.setenv("OWNER_PASSWORD", "InitialOwnerPassword123")
    await routes_users.seed_owner()
    user = await db.users.find_one({"role": "owner"})
    assert user["must_change_password"]
    assert await db.users.count_documents({}) == 1
    monkeypatch.setenv("OWNER_PASSWORD", "AnotherOwnerPassword456")
    await routes_users.seed_owner()
    assert (await db.users.find_one({"role": "owner"}))["password_hash"] == user["password_hash"]


@pytest.mark.asyncio
async def test_cloud_serves_spa_without_masking_missing_api(monkeypatch, tmp_path, local_storage):
    (tmp_path / "index.html").write_text("<html>DEMSTAV</html>")
    (tmp_path / "sw.js").write_text("// service worker")
    monkeypatch.setenv("FRONTEND_BUILD_DIR", str(tmp_path))
    import cloud_app
    importlib.reload(cloud_app)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=cloud_app.app), base_url="https://example.test") as c:
        assert (await c.get("/dnes")).text == "<html>DEMSTAV</html>"
        assert (await c.get("/sw.js")).headers["cache-control"] == "no-cache"
        assert (await c.get("/api/nonexistent")).status_code == 404
        assert (await c.get("/missing.js")).status_code == 404
        assert (await c.get("/api/health")).json() == {"ok": True}
        assert (await c.get("/api/records")).status_code == 401


def test_pdf_exports_have_czech_fonts_without_emergent():
    import fitz
    from exports import timesheet_pdf, diary_pdf
    record = {"id": "cloud-export-test", "date": "2026-10-27", "status": "draft", "revision": 1,
              "machine": "L566/3", "operator": "Jan Hrbáček", "work": "Nakládka štěrku",
              "billing": [{"start": "06:00", "end": "15:00"}], "attachments": []}
    pdf = timesheet_pdf([{"employee_name": "Jan Hrbáček", "records": [record]}], lambda a: None)
    with fitz.open(stream=pdf, filetype="pdf") as doc:
        assert len(doc) >= 1
        assert "Hrbáček" in "".join(page.get_text() for page in doc)
    assert diary_pdf([], lambda a: None).startswith(b"%PDF")


@pytest.mark.asyncio
async def test_login_rotate_save_read_and_export(monkeypatch, local_storage):
    import core
    import routes_records
    import routes_data
    import server
    db = AsyncMongoMockClient().demstav
    for module in (core, routes_users, routes_records, routes_data, server):
        monkeypatch.setattr(module, "db", db)
    monkeypatch.setenv("OWNER_EMAIL", "owner@example.test")
    monkeypatch.setenv("OWNER_PASSWORD", "BootstrapPassword123")
    monkeypatch.setenv("JWT_SECRET", "isolated-test-signing-secret-not-production")
    monkeypatch.delenv("SEED_DEMO_ACCOUNTS", raising=False)
    await routes_users.seed_owner()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="https://example.test") as c:
        login = await c.post("/api/auth/login", json={"username": "jednatel", "password": "BootstrapPassword123"})
        assert login.status_code == 200
        c.headers["Authorization"] = "Bearer " + login.json()["access_token"]
        assert (await c.get("/api/records")).status_code == 403
        rotate = await c.post("/api/auth/change-password", json={"current_password": "BootstrapPassword123", "new_password": "PersonalPassword456"})
        assert rotate.status_code == 200
        c.headers["Authorization"] = "Bearer " + rotate.json()["access_token"]
        saved = await c.put("/api/records/cloud-test-record", json={"opId": "cloud-test-save", "record": {
            "date": "2026-10-27", "machine": "L566/3", "work": "Nakládka štěrku",
            "billing": [{"start": "06:00", "end": "15:00"}]}})
        assert saved.status_code == 200, saved.text
        assert (await c.get("/api/records/cloud-test-record")).status_code == 200
        exported = await c.get("/api/exports/sichtovnice.pdf")
        assert exported.status_code == 200
        assert exported.content.startswith(b"%PDF")
        assert await db.record_versions.count_documents({"record_id": "cloud-test-record"}) == 1
