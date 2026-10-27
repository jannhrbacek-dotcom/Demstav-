from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from core import db, get_ready_user, require_role, is_manager, iso_now, audit
from production import clean_report
from storage import get_object

router = APIRouter()


@router.get('/production/settings')
async def settings(user=Depends(get_ready_user)):
    doc = await db.production_settings.find_one({'id': 'main'}, {'_id': 0}) or {'responsible_ids': []}
    people = await db.users.find({'active': True}, {'_id': 0, 'id': 1, 'name': 1}).to_list(2000)
    return {'responsible_ids': doc['responsible_ids'], 'people': people if is_manager(user) else [p for p in people if p['id'] in doc['responsible_ids']]}


@router.put('/production/settings')
async def set_settings(body: dict, user=Depends(require_role('manager'))):
    ids = body.get('responsible_ids')
    if not isinstance(ids, list) or len(ids) > 200 or any(not isinstance(i, str) for i in ids):
        raise HTTPException(400, 'Neplatný seznam pověřených osob.')
    ids = list(set(ids))
    if await db.users.count_documents({'id': {'$in': ids}, 'active': True}) != len(ids):
        raise HTTPException(400, 'Vyberte aktivní účty.')
    await db.production_settings.update_one({'id': 'main'}, {'$set': {'responsible_ids': ids}}, upsert=True)
    await audit(user, 'production_responsibility_changed', {'responsible_ids': ids})
    return {'responsible_ids': ids}


@router.get('/production')
async def reports(user=Depends(get_ready_user)):
    q = {} if is_manager(user) else {'owner_id': user['id']}
    return await db.production_reports.find(q, {'_id': 0}).sort('date', -1).to_list(500)


async def accessible(rid, user):
    doc = await db.production_reports.find_one({'id': rid}, {'_id': 0})
    if doc and doc['owner_id'] != user['id'] and not is_manager(user):
        raise HTTPException(404, 'Výkaz nenalezen.')
    return doc


@router.put('/production/{rid}')
async def save(rid: str, body: dict, user=Depends(get_ready_user)):
    import re
    if not re.fullmatch(r'[a-zA-Z0-9_-]{8,100}', rid):
        raise HTTPException(400, 'Neplatné ID výkazu.')
    old = await accessible(rid, user)
    op = str(body.get('opId') or '')[:100]
    if not op:
        raise HTTPException(400, 'Chybí ID operace.')
    if old and old.get('op_id') == op:
        return old
    base = body.get('baseRevision', 0)
    if not isinstance(base, int) or isinstance(base, bool) or base < 0:
        raise HTTPException(400, 'Neplatná revize výkazu.')
    if (old or {}).get('revision', 0) != base:
        raise HTTPException(409, 'Výkaz mezitím změnil jiný uživatel. Obnovte seznam; vaše verze zůstává ve frontě.')
    raw = body.get('report')
    if not isinstance(raw, dict):
        raise HTTPException(400, 'Neplatný výkaz.')
    doc = clean_report(raw, bool(body.get('submit')))
    if old and old['status'] == 'submitted' and not doc['note']:
        raise HTTPException(422, 'U opravy odevzdaného výkazu uveďte důvod v poznámce.')
    owner = old['owner_id'] if old else user['id']
    for ticket in doc['tickets']:
        att = await db.attachments.find_one({'id': ticket['attachment_id'], 'is_deleted': False, 'record_id': rid, 'owner_id': {'$in': [owner, user['id']]}}, {'_id': 0})
        if not att:
            raise HTTPException(422, {'code': 'attachments_missing', 'message': 'Fotografie lístku ještě není na serveru.'})
        ticket['name'] = att['name']
    doc.update(id=rid, owner_id=owner, owner_name=old['owner_name'] if old else user['name'], revision=base + 1, op_id=op, updated_at=iso_now(), updated_by=user['name'])
    try:
        if old:
            saved = await db.production_reports.find_one_and_replace({'id': rid, 'revision': base}, doc, return_document=ReturnDocument.AFTER, projection={'_id': 0})
            if not saved:
                raise HTTPException(409, 'Výkaz byl souběžně změněn. Obnovte seznam.')
        else:
            await db.production_reports.insert_one(dict(doc))
    except DuplicateKeyError:
        raise HTTPException(409, 'Výkaz byl souběžně uložen. Obnovte seznam.')
    await audit(user, 'production_saved', {'report': doc, 'previous_revision': old})
    return doc


@router.get('/production/{rid}/pdf')
async def pdf(rid: str, user=Depends(get_ready_user)):
    doc = await accessible(rid, user)
    if not doc:
        raise HTTPException(404, 'Výkaz nenalezen.')
    from production_pdf import production_pdf
    files = []
    for ticket in doc['tickets']:
        att = await db.attachments.find_one({'id': ticket['attachment_id'], 'record_id': rid, 'is_deleted': False}, {'_id': 0})
        if not att:
            raise HTTPException(503, 'Příloha chybí. Export nebyl vytvořen.')
        try:
            data, _ = get_object(att['storage_path'])
            files.append((ticket, data, att['type']))
        except Exception:
            raise HTTPException(503, 'Přílohu nelze stáhnout. Zkuste export znovu.')
    return Response(production_pdf(doc, files), media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename="DEMSTAV_vykaz_{doc["date"]}.pdf"'})
