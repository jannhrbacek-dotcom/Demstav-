"""Complete report + local photograph + PDF flow, with an isolated mock database."""
import io
import os
import sys
from pathlib import Path
os.environ.setdefault('MONGO_URL', 'mongodb://localhost:27017')
os.environ.setdefault('DB_NAME', 'demstav_test')
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))

import fitz
import httpx
import pytest
from PIL import Image
from fastapi import FastAPI
from mongomock_motor import AsyncMongoMockClient
import routes_production
import routes_records
from core import get_ready_user


@pytest.mark.asyncio
async def test_report_photo_pdf_and_access(monkeypatch, tmp_path):
    database = AsyncMongoMockClient().demstav
    monkeypatch.setattr(routes_records, 'db', database)
    monkeypatch.setattr(routes_production, 'db', database)
    monkeypatch.setenv('STORAGE_BACKEND', 'local')
    monkeypatch.setenv('STORAGE_LOCAL_ROOT', str(tmp_path / 'objects'))
    async def audit(*args): pass
    monkeypatch.setattr(routes_production, 'audit', audit)
    current = {'id': 'marcel-user', 'name': 'Marcel Schmidt', 'role': 'employee'}
    app = FastAPI()
    app.include_router(routes_records.router, prefix='/api')
    app.include_router(routes_production.router, prefix='/api')
    async def identity(): return current
    app.dependency_overrides[get_ready_user] = identity
    photo = io.BytesIO()
    Image.new('RGB', (100, 200), 'white').save(photo, format='JPEG')
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://test') as client:
        uploaded = await client.post('/api/attachments', data={'id': 'photo-123456', 'record_id': 'report-12345'}, files={'file': ('listek.jpg', photo.getvalue(), 'image/jpeg')})
        assert uploaded.status_code == 200
        report = dict(date='2026-10-26', customer='JEKAER a.s.', site='Struskárna', crew='Schmidt, Hynčicová', machines='L566/3', work='Třídění strusky', start='16:30', end='18:00', tonnes='31,35', tickets=[dict(attachment_id='photo-123456', number='206', fraction='25-35', tonnes='31,35')])
        body = dict(opId='save-12345', baseRevision=0, submit=True, report=report)
        saved = await client.put('/api/production/report-12345', json=body)
        assert saved.status_code == 200, saved.text
        assert saved.json()['status'] == 'submitted'
        assert len((await client.get('/api/production')).json()) == 1
        pdf = await client.get('/api/production/report-12345/pdf')
        assert pdf.status_code == 200
        doc = fitz.open(stream=pdf.content, filetype='pdf')
        assert len(doc) == 2 and doc[1].get_images()
        # A lost response and retry may not create another revision.
        assert (await client.put('/api/production/report-12345', json=body)).json()['revision'] == 1
        current = {'id': 'hana-user', 'name': 'Hana Hynčicová', 'role': 'employee'}
        assert (await client.get('/api/production')).json() == []
        assert (await client.get('/api/production/report-12345/pdf')).status_code == 404
        assert (await client.get('/api/attachments/photo-123456')).status_code == 404
        current = {'id': 'manager-user', 'name': 'Vedoucí', 'role': 'manager'}
        assert len((await client.get('/api/production')).json()) == 1
        assert (await client.get('/api/production/report-12345/pdf')).status_code == 200
        # A ticket from a different report cannot be attached to another report.
        current = {'id': 'marcel-user', 'name': 'Marcel Schmidt', 'role': 'employee'}
        foreign = await client.put('/api/production/report-other', json={**body, 'opId': 'save-other'})
        assert foreign.status_code == 422
        assert foreign.json()['detail']['code'] == 'attachments_missing'
