"""Disposable CI containers only. Never run this script against production."""
import time
import httpx

BASE = "http://127.0.0.1:10000"
with httpx.Client(base_url=BASE, timeout=15) as client:
    for attempt in range(60):
        try:
            if client.get("/api/ready").status_code == 200:
                break
        except httpx.HTTPError:
            pass
        time.sleep(1)
    else:
        raise RuntimeError("Cloud container did not become ready")
    assert "DEMSTAV" in client.get("/dnes").text
    assert client.get("/sw.js").status_code == 200
    assert client.get("/api/not-found").status_code == 404
    login = client.post("/api/auth/login", json={"username": "jednatel", "password": "IsolatedCIPersonal456"})
    if login.status_code != 200:
        login = client.post("/api/auth/login", json={"username": "jednatel", "password": "IsolatedCIBootstrap123"})
    login.raise_for_status()
    client.headers["Authorization"] = "Bearer " + login.json()["access_token"]
    if login.json()["user"]["must_change_password"]:
        rotated = client.post("/api/auth/change-password", json={"current_password": "IsolatedCIBootstrap123", "new_password": "IsolatedCIPersonal456"})
        rotated.raise_for_status()
        client.headers["Authorization"] = "Bearer " + rotated.json()["access_token"]
    public_key = client.get("/api/push/public-key")
    public_key.raise_for_status()
    assert len(public_key.json()["public_key"]) == 87
    assert client.post("/api/push/subscribe", json={"subscription": {"endpoint": "https://127.0.0.1/private", "keys": {"auth": "x", "p256dh": "x"}}}).status_code == 400
    attachment = client.post("/api/attachments", data={"id": "ci-attachment", "kind": "other"},
                             files={"file": ("test.pdf", b"%PDF-1.4\nCI persistence check", "application/pdf")})
    attachment.raise_for_status()
    assert client.get("/api/attachments/ci-attachment").content == b"%PDF-1.4\nCI persistence check"
    saved = client.put("/api/records/ci-record", json={"opId": "ci-save", "record": {
        "date": "2026-10-27", "machine": "L566/3", "work": "CI test", "billing": [{"start": "06:00", "end": "15:00"}]}})
    saved.raise_for_status()
    assert client.get("/api/records/ci-record").status_code == 200
    pdf = client.get("/api/exports/sichtovnice.pdf")
    pdf.raise_for_status()
    assert pdf.content.startswith(b"%PDF")
print("Real MongoDB + frontend + login + password rotation + attachment + record + PDF: PASS")
