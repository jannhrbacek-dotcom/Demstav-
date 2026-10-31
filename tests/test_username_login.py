"""Username-only accounts must support the complete authentication flow."""
import os
import sys
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from mongomock_motor import AsyncMongoMockClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "demstav_test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

import core
import routes_users


@pytest.mark.asyncio
async def test_username_only_login_password_rotation_and_revocation(monkeypatch):
    database = AsyncMongoMockClient().demstav
    monkeypatch.setattr(core, "db", database)
    monkeypatch.setattr(routes_users, "db", database)
    monkeypatch.setenv("JWT_SECRET", "isolated-username-only-test-signing-secret")
    await database.users.insert_one({
        "id": "username-only", "username": "strojnik", "name": "Testovací strojník",
        "role": "employee", "active": True, "must_change_password": True,
        "password_hash": core.hash_password("TemporaryPassword123"), "token_version": 0,
    })
    app = FastAPI()
    app.include_router(routes_users.router, prefix="/api")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://test") as client:
        response = await client.post("/api/auth/login", json={"username": "strojnik", "password": "TemporaryPassword123"})
        assert response.status_code == 200, response.text
        original_token = response.json()["access_token"]
        assert response.json()["user"]["email"] == ""
        client.headers["Authorization"] = "Bearer " + original_token
        assert (await client.get("/api/auth/me")).status_code == 200
        response = await client.post("/api/auth/change-password", json={
            "current_password": "TemporaryPassword123", "new_password": "PersonalPassword456",
        })
        assert response.status_code == 200, response.text
        assert not response.json()["user"]["must_change_password"]
        new_token = response.json()["access_token"]
        # Password rotation revokes the original session for this account.
        assert (await client.get("/api/auth/me")).status_code == 401
        client.headers["Authorization"] = "Bearer " + new_token
        assert (await client.get("/api/auth/me")).json()["user"]["id"] == "username-only"
