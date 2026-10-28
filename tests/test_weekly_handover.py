import os
import sys
import io
from pathlib import Path
os.environ.setdefault('MONGO_URL', 'mongodb://localhost:27017')
os.environ.setdefault('DB_NAME', 'isolated_weekly')
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import pytest
import pytest_asyncio
import fitz
from fastapi import HTTPException
from mongomock_motor import AsyncMongoMockClient
import core
import routes_data as routes
import routes_leave
import routes_push
import weekly_scheduler
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

@pytest_asyncio.fixture
async def db(monkeypatch, tmp_path):
    db = AsyncMongoMockClient().test
    for module in (core, routes, routes_leave, routes_push, weekly_scheduler): monkeypatch.setattr(module, 'db', db)
    monkeypatch.setenv('STORAGE_BACKEND', 'local'); monkeypatch.setenv('STORAGE_LOCAL_ROOT', str(tmp_path))
    async def send(*args, **kwargs): return 0
    monkeypatch.setattr(routes_push, 'send_push_to_users', send)
    await db.weekly_counters.create_index('week', unique=True)
    await db.weekly_export_versions.create_index('export_id', unique=True)
    await db.weekly_export_versions.create_index('job_key', unique=True, sparse=True)
    await db.weekly_jobs.create_index('slot', unique=True)
    await db.users.insert_many([dict(id='worker', name='Test worker', role='employee', active=True),
        dict(id='sender', name='Test manager', role='manager', active=True),
        dict(id='recipient', name='Test owner', role='owner', active=True)])
    await db.records.insert_one(dict(id='record-1', owner_id='worker', owner_name='Test worker', operator='Test worker',
        date='2026-10-27', status='confirmed', revision=1, integrity_hash='synthetic-hash',
        machine='TEST-2', mthStart='14000', mthEnd='14002', driveMinutes=0,
        billing=[dict(start='06:00', end='15:00')], service=[], downtime=[], travel=[], faults=[], attachments=[]))
    return db

@pytest.mark.asyncio
async def test_versions_remain_downloadable_and_only_recipient_accepts(db):
    first = await routes.generate_week('2026-10-26', 'Test manager')
    second = await routes.generate_week('2026-10-26', 'Test manager')
    assert first['version'] == 1 and second['version'] == 2
    assert first['files']['pdf']['path'] != second['files']['pdf']['path']
    assert not first['validation']['blockers']
    sender = dict(id='sender', name='Test manager', role='manager')
    receiver = dict(id='recipient', name='Test owner', role='owner')
    await routes.weekly_handover(first['week'], dict(export_id=first['export_id'], action='submit', recipients=['recipient']), sender)
    with pytest.raises(HTTPException) as exc:
        await routes.weekly_handover(first['week'], dict(export_id=first['export_id'], action='accept'), sender)
    assert exc.value.status_code == 403
    result = await routes.weekly_handover(first['week'], dict(export_id=first['export_id'], action='accept'), receiver)
    assert result['status'] == 'accepted'
    pdf = await routes.get_weekly(first['week'], 'pdf', version=first['export_id'], user=receiver)
    assert pdf.body.startswith(b'%PDF')
    latest = await db.weekly_exports.find_one(dict(week=first['week']))
    assert latest['export_id'] == second['export_id'] and latest['status'] == 'draft'
    await db.records.update_one(dict(id='record-1'), {'$set': dict(revision=2, integrity_hash='changed')})
    with pytest.raises(HTTPException) as exc:
        await routes.weekly_handover(second['week'], dict(export_id=second['export_id'], action='submit', recipients=['recipient']), sender)
    assert exc.value.status_code == 409

@pytest.mark.asyncio
async def test_drafts_block_handover_and_absence_only_employee_gets_pdf(db):
    await db.users.insert_one(dict(id='absent', name='Absent test worker', role='employee', active=True))
    await db.leave_requests.insert_one(dict(id='leave-1', user_id='absent', user_name='Absent test worker', type='vacation',
        date_from='2026-10-26', date_to='2026-10-30', status='approved', note='PRIVATE'))
    await db.records.update_one(dict(id='record-1'), {'$set': dict(status='draft')})
    doc = await routes.generate_week('2026-10-26')
    assert any(p['code'] == 'draft' for p in doc['validation']['blockers'])
    pdf = await routes.get_weekly(doc['week'], 'pdf', version=doc['export_id'], user=dict(role='owner'))
    text = '\n'.join(page.get_text() for page in fitz.open(stream=pdf.body, filetype='pdf'))
    assert 'Absent test worker' in text and 'Dovolená' in text and 'PRIVATE' not in text
    with pytest.raises(HTTPException) as exc:
        await routes.weekly_handover(doc['week'], dict(export_id=doc['export_id'], action='submit', recipients=['recipient']),
            dict(id='sender', name='Test manager', role='manager'))
    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_scheduler_disabled_by_default_and_recovers_lease_without_duplicate_package(db, monkeypatch):
    monkeypatch.delenv('WEEKLY_EXPORT_SCHEDULE', raising=False)
    assert weekly_scheduler.configuration() is None
    config = dict(weekday=0, hour=5, minute=0, recipients=['recipient'])
    now = datetime(2026, 11, 2, 5, 1, tzinfo=ZoneInfo('Europe/Prague'))
    assert weekly_scheduler.due_week(now, config) == '2026-10-26'
    # Simulate a process that committed the package, then died before handover.
    package = await routes.generate_week('2026-10-26', job_key='weekly:2026-10-26')
    await db.weekly_jobs.insert_one(dict(slot='weekly:2026-10-26', week='2026-10-26', status='running', attempts=1,
        lease_until='2026-11-02T03:00:00Z', token='dead-process'))
    await weekly_scheduler.run_once(now, config)
    await weekly_scheduler.run_once(now + timedelta(minutes=1), config)
    assert await db.weekly_export_versions.count_documents({}) == 1
    job = await db.weekly_jobs.find_one(dict(slot='weekly:2026-10-26'))
    assert job['status'] == 'done' and job['attempts'] == 2, job
    current = await db.weekly_export_versions.find_one(dict(export_id=package['export_id']))
    assert current['status'] == 'submitted'
    assert len(current['history']) == 1
