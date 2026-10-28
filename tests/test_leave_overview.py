import os
import sys
from pathlib import Path
os.environ.setdefault('MONGO_URL', 'mongodb://localhost:27017')
os.environ.setdefault('DB_NAME', 'isolated_leave')
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import pytest
import httpx
from fastapi import FastAPI, HTTPException
from mongomock_motor import AsyncMongoMockClient
import core
import routes_leave as routes
import routes_exceptions
import routes_push

@pytest.fixture
def db(monkeypatch):
    db = AsyncMongoMockClient().test
    for module in (core, routes, routes_exceptions, routes_push): monkeypatch.setattr(module, 'db', db)
    return db

@pytest.mark.asyncio
async def test_director_transition_notifies_once_and_hides_private_notes(db, monkeypatch):
    sent, role_sent = [], []
    async def send(*args, **kwargs): sent.append((args, kwargs)); return 1
    async def notify(*args, **kwargs): role_sent.append((args, kwargs)); return 1
    monkeypatch.setattr(routes_push, 'send_push_to_users', send)
    monkeypatch.setattr(routes_push, 'notify_users_by_role', notify)
    employee = dict(id='employee', name='Test worker', role='employee')
    manager = dict(id='manager', name='Test manager', role='manager')
    owner = dict(id='owner', name='Test owner', role='owner')
    saved = await routes.create_leave(dict(type='vacation', date_from='2026-11-02', date_to='2026-11-03', note='PRIVATE'), employee)
    rid = saved['request']['id']
    result = await routes.decide(rid, dict(action='approve', note='PRIVATE DECISION'), manager)
    assert result['status'] == 'pending_director'
    assert len(role_sent) == 2
    assert role_sent[-1][0][0] == ['owner', 'operations_manager']
    assert role_sent[-1][1]['tag'] == f'leave-director-{rid}'
    with pytest.raises(HTTPException): await routes.decide(rid, dict(action='approve'), manager)
    assert len(role_sent) == 2
    await routes.decide(rid, dict(action='approve', note='PRIVATE FINAL'), owner)
    assert 'PRIVATE' not in str(sent)
    rows = await routes.absence_overview('2026-11-01', '2026-11-10', user=manager)
    assert len(rows) == 1 and rows[0]['status'] == 'approved'
    assert 'note' not in rows[0] and 'history' not in rows[0]

@pytest.mark.asyncio
async def test_overview_api_denies_employee_and_calendar_scopes_pending(db):
    employee = dict(id='employee', name='Test worker', role='employee')
    manager = dict(id='manager', name='Test manager', role='manager')
    await db.leave_requests.insert_one(dict(id='pending', user_id='other', user_name='Colleague', type='sick',
        date_from='2026-11-02', date_to='2026-11-03', status='pending_manager', note='PRIVATE'))
    app = FastAPI(); app.include_router(routes.router)
    app.dependency_overrides[core.get_ready_user] = lambda: employee
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='https://test') as client:
        assert (await client.get('/leave/overview?date_from=2026-11-01&date_to=2026-11-10')).status_code == 403
    assert not await routes_exceptions.team_calendar('2026-11-01', '2026-11-10', employee)
    events = await routes_exceptions.team_calendar('2026-11-01', '2026-11-10', manager)
    assert events[0]['status'] == 'pending_manager'
    assert events[0]['title'] == 'Nepřítomnost' and events[0]['note'] == ''
    with pytest.raises(HTTPException) as exc:
        await routes.create_leave(dict(type='vacation', date_from='2026-02-31'), employee)
    assert exc.value.status_code == 400
