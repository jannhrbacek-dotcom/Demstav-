"""Opt-in weekly preparation and in-app handover, using the existing MongoDB.
No schedule or recipients are assumed. WEEKLY_EXPORT_SCHEDULE is a JSON object.
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from core import db, iso_now, new_id

log = logging.getLogger('weekly_scheduler')
PRAGUE = ZoneInfo('Europe/Prague')


def configuration():
    raw = os.environ.get('WEEKLY_EXPORT_SCHEDULE', '')
    if not raw:
        return None
    value = json.loads(raw)
    if not isinstance(value, dict) or value.get('enabled') is not True:
        return None
    for key, maximum in (('weekday', 6), ('hour', 23), ('minute', 59)):
        if type(value.get(key)) is not int or not 0 <= value[key] <= maximum:
            raise ValueError('Schedule requires weekday 0–6, hour 0–23, minute 0–59.')
    recipients = value.get('recipients')
    if not isinstance(recipients, list) or not recipients or len(recipients) > 30 or any(not isinstance(i, str) or not i for i in recipients):
        raise ValueError('Schedule requires explicit recipient IDs.')
    return {k: value[k] for k in ('weekday', 'hour', 'minute', 'recipients')}


def due_week(now, config):
    now = now.astimezone(PRAGUE)
    due = now.date() - timedelta(days=(now.weekday() - config['weekday']) % 7)
    at = datetime.combine(due, datetime.min.time(), PRAGUE).replace(hour=config['hour'], minute=config['minute'])
    if now < at:
        due -= timedelta(days=7)
    monday = due - timedelta(days=due.weekday() + 7)
    return monday.isoformat()


async def run_once(now, config):
    from routes_data import generate_week, weekly_handover
    week = due_week(now, config)
    slot, token = 'weekly:' + week, new_id()
    timestamp = now.astimezone(ZoneInfo('UTC')).isoformat().replace('+00:00', 'Z')
    expiry = (now + timedelta(minutes=15)).astimezone(ZoneInfo('UTC')).isoformat().replace('+00:00', 'Z')
    try:
        await db.weekly_jobs.update_one({'slot': slot}, {'$setOnInsert': {'slot': slot, 'week': week, 'status': 'queued', 'attempts': 0}}, upsert=True)
    except DuplicateKeyError:
        pass
    job = await db.weekly_jobs.find_one_and_update({'slot': slot, 'status': {'$nin': ['done', 'blocked']},
        'attempts': {'$lt': 3}, '$or': [{'lease_until': {'$exists': False}}, {'lease_until': {'$lt': timestamp}}]},
        {'$set': {'status': 'running', 'token': token, 'lease_until': expiry, 'started_at': timestamp}, '$inc': {'attempts': 1}},
        return_document=ReturnDocument.AFTER)
    if not job:
        return
    query = {'slot': slot, 'token': token}
    try:
        package = await generate_week(week, 'Systém — týdenní plán', job_key=slot)
        await db.weekly_jobs.update_one(query, {'$set': {'export_id': package['export_id']}})
        if package.get('validation', {}).get('blockers'):
            await db.weekly_jobs.update_one(query, {'$set': {'status': 'blocked', 'finished_at': iso_now()}})
            try:
                from routes_push import send_push_to_users
                await send_push_to_users(config['recipients'], 'Týdenní výkazy vyžadují opravu podkladů',
                    f'Týden {week}', url='/exporty', tag='weekly-blocked-' + week)
            except Exception:
                log.exception('Weekly validation notification failed')
            return
        if package['status'] == 'draft':
            await weekly_handover(week, {'export_id': package['export_id'], 'action': 'submit', 'recipients': config['recipients']},
                {'id': 'system-weekly', 'name': 'Systém — týdenní plán', 'role': 'owner'})
        await db.weekly_jobs.update_one(query, {'$set': {'status': 'done', 'finished_at': iso_now()}})
    except Exception:
        log.exception('Weekly job failed for week %s', week)
        # Keep the lease as a backoff and permit recovery (at most three attempts).
        await db.weekly_jobs.update_one(query, {'$set': {'status': 'failed', 'failed_at': iso_now()}})


async def loop(config):
    while True:
        try:
            await db.weekly_scheduler_health.update_one({'id': 'weekly'}, {'$set': {'last_poll': iso_now()}}, upsert=True)
            await run_once(datetime.now(PRAGUE), config)
        except Exception:
            log.exception('Weekly scheduler poll failed')
        await asyncio.sleep(30)


async def start():
    config = configuration()
    if not config:
        return None
    await db.weekly_jobs.create_index('slot', unique=True)
    return asyncio.create_task(loop(config))
