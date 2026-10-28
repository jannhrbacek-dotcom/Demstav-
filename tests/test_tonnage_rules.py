import os
import sys
from pathlib import Path
os.environ.setdefault('MONGO_URL', 'mongodb://localhost:27017')
os.environ.setdefault('DB_NAME', 'isolated_tonnage')
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import pytest
from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient
import routes_production as routes
from production import clean_report

def report(**extra):
    return dict(date='2026-10-27', customer='Test customer', site='Test site', job='A', crew='Test crew',
        machines='TEST-2', work='Test work', start='06:00', end='15:00', shift_closed=True,
        tonnes='999', tickets=[dict(attachment_id='ticket-0001', number='001', tonnes='10,50'),
        dict(attachment_id='ticket-0002', number='002', tonnes='20')], **extra)

def test_one_derived_total_and_no_explanation_bypass():
    assert clean_report(report(), True)['tonnes'] == 30.5
    r = report(); r['tickets'][1]['tonnes'] = None; r['note'] = 'Not complete'
    assert clean_report(r)['tonnes'] is None
    with pytest.raises(HTTPException): clean_report(r, True)
    with pytest.raises(HTTPException): clean_report({**report(), 'shift_closed': False}, True)

@pytest.mark.asyncio
async def test_responsibility_shift_duplicate_and_verified_ticket_content(monkeypatch):
    db = AsyncMongoMockClient().test
    monkeypatch.setattr(routes, 'db', db)
    async def audit(*args): pass
    monkeypatch.setattr(routes, 'audit', audit)
    actor = dict(id='assigned', name='Test worker', role='employee')
    body = dict(opId='save-1', report=report(), submit=True)
    with pytest.raises(HTTPException) as exc:
        await routes.save('report-0001', body, actor)
    assert exc.value.status_code == 403
    await db.production_settings.insert_one(dict(id='main', responsible_ids=['assigned']))
    for i in (1, 2):
        await db.attachments.insert_one(dict(id=f'ticket-000{i}', owner_id=actor['id'], record_id='report-0001',
            name=f'{i}.jpg', sha256=f'verified-hash-{i}', is_deleted=False))
    first = await routes.save('report-0001', body, actor)
    assert first['tonnes'] == 30.5
    assert (await routes.save('report-0001', body, actor))['revision'] == 1
    with pytest.raises(HTTPException) as exc:
        await routes.save('report-0002', {**body, 'opId': 'other'}, actor)
    assert exc.value.status_code == 409
    # A second photograph with the same bytes must not count twice.
    await db.attachments.insert_one(dict(id='ticket-0003', owner_id=actor['id'], record_id='report-0003',
        name='duplicate.jpg', sha256='verified-hash-1', is_deleted=False))
    other = report(); other.update(site='Another site', tickets=[dict(attachment_id='ticket-0003', tonnes=5)])
    with pytest.raises(HTTPException) as exc:
        await routes.save('report-0003', dict(opId='other-photo', report=other, submit=True), actor)
    assert exc.value.status_code == 409
    assert await db.production_reports.count_documents({}) == 1
