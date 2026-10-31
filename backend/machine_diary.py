"""Machine-only views of revisioned records. No employee time/commute projection.

The journal hash chain detects inconsistency; it is not a qualified signature
or protection against an administrator rewriting the whole database.
"""
from copy import deepcopy
import hashlib
import json
from fastapi import HTTPException
from record_integrity import CHAIN_GENESIS, canonical, chain_hash

DIARY_FIELDS = frozenset({
    'id', 'date', 'shift', 'status', 'revision', 'machine', 'operator', 'crew', 'site',
    'work', 'mthStart', 'mthEnd', 'dailyCheck', 'accessoryCheck', 'equipmentCheck',
    'fit', 'faults', 'serviceDescription', 'repairDescription', 'serviceBy',
    'externalCompany', 'intervalService', 'diesel', 'hydraulic', 'oil', 'otherFluid',
    'handover', 'handoverName', 'handoverSignature', 'operatorSignature', 'workshopSignature',
    'author_name', 'updatedAt', 'confirmedAt', 'integrity_hash', 'prev_hash',
})


def diary_projection(record):
    """Allowlist matching machine diary, never employee shift or generic notes."""
    result = {key: deepcopy(value) for key, value in record.items() if key in DIARY_FIELDS}
    result['attachments'] = [deepcopy(a) for a in record.get('attachments', []) if a.get('section') == 'service']
    return result


async def verified_diary_records(database, records):
    """Read-only, fail-closed journal validation before official diary export.

    Also compares the full materialized record with the journal payload. Merely
    retaining its old hash after editing a projection must not pass verification.
    Legacy records without history require an explicit reviewed reconciliation.
    """
    result = []
    for record in records:
        rid = record['id']
        def invalid():
            return HTTPException(409, f'Zápis {rid}: nelze ověřit historii nebo obsah. Export zastaven; správce musí prověřit revize. Původní zápis nepřepisujte.')
        versions = await database.record_versions.find({'record_id': rid}, {'_id': 0}).sort('revision', 1).to_list(10001)
        if not versions or len(versions) > 10000 or versions[0].get('revision') != 1:
            raise invalid()
        prev = CHAIN_GENESIS
        previous_revision = None
        for version in versions:
            payload = version.get('payload') or {}
            revision = version.get('revision')
            if payload.get('id') != rid or payload.get('revision') != revision:
                raise invalid()
            if previous_revision is not None and revision != previous_revision + 1:
                raise invalid()
            if version.get('chain') == 1:
                if version.get('prev_hash') != prev or chain_hash(prev, payload) != version.get('hash'):
                    raise invalid()
            else:
                expected = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()
                if expected != version.get('hash'):
                    raise invalid()
            prev = version['hash']
            previous_revision = revision
        latest = versions[-1]
        projection = {k: v for k, v in record.items() if k not in ('_id', 'integrity_hash', 'prev_hash')}
        if (record.get('revision') != latest['revision'] or record.get('integrity_hash') != latest['hash']
                or canonical(projection) != canonical(latest['payload'])):
            raise invalid()
        if latest.get('chain') == 1 and record.get('prev_hash') != latest.get('prev_hash'):
            raise invalid()
        result.append(diary_projection({**latest['payload'], 'integrity_hash': latest['hash'], 'prev_hash': latest.get('prev_hash')}))
    return result


def verified_diary_attachment(attachment, document, storage_loader):
    expected = attachment.get('sha256')
    if not document or not expected:
        raise HTTPException(409, 'Přílohu deníku nelze ověřit proti původní revizi.')
    try:
        data = storage_loader(document['storage_path'])[0]
    except Exception as exc:
        raise HTTPException(503, 'Příloha deníku není dostupná; export nebyl dokončen.') from exc
    if hashlib.sha256(data).hexdigest() != expected:
        raise HTTPException(409, 'Obsah přílohy neodpovídá otisku v revizi deníku; export zastaven.')
    return data
