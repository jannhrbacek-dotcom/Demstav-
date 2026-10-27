import os
os.environ.setdefault('MONGO_URL', 'mongodb://localhost:27017')
os.environ.setdefault('DB_NAME', 'demstav_unit')
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import asyncio
import copy
import io
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from PIL import Image
from production import clean_report
from production_pdf import production_pdf
import routes_production as routes


def raw():
    return dict(date='2026-10-26', customer='JEKAER a.s.', site='Struskárna', crew='Schmidt, Hynčicová, Hrbáček', machines='METSO S4.9, L546/4', work='Třídění strusky', start='16:30', end='18:00', tonnes='183,45', note='Zbývající lístky budou doplněny.', tickets=[dict(attachment_id='ticket-123', number='206', fraction='25-35', tonnes='31,35')])


def test_hours_and_tonnage_independent():
    d = clean_report(raw(), True)
    assert d['hours'] == 1.5 and d['tonnes'] == 183.45 and d['ticket_total'] == 31.35
    assert d['tonnage_warning']


@pytest.mark.parametrize('value', ['-1', 'NaN', 'Infinity', 'abc', '1000001'])
def test_invalid_tonnes(value):
    r = raw(); r['tonnes'] = value
    with pytest.raises(HTTPException): clean_report(r)


def test_required_photo_only_on_submission():
    r = raw(); r['tickets'] = []
    assert clean_report(r)['status'] == 'draft'
    with pytest.raises(HTTPException): clean_report(r, True)


def test_mismatch_explanation_required():
    r = raw(); r['note'] = ''
    with pytest.raises(HTTPException): clean_report(r, True)
    r['tonnes'] = '31.35'
    assert not clean_report(r, True)['tonnage_warning']


def test_duplicate_photo_rejected():
    r = raw(); r['tickets'] *= 2
    with pytest.raises(HTTPException): clean_report(r)


class Reports:
    def __init__(self, doc=None): self.doc = doc
    async def find_one(self, *a, **kw): return copy.deepcopy(self.doc)
    async def insert_one(self, doc): self.doc = copy.deepcopy(doc)
    async def find_one_and_replace(self, q, doc, **kw):
        if self.doc['revision'] != q['revision']: return None
        self.doc = copy.deepcopy(doc)
        return doc


class Attachments:
    async def find_one(self, *a, **kw): return {'name': 'listek.jpg'}


def setup(monkeypatch, doc=None):
    reports = Reports(doc)
    monkeypatch.setattr(routes, 'db', SimpleNamespace(production_reports=reports, attachments=Attachments()))
    async def audit(*args): pass
    monkeypatch.setattr(routes, 'audit', audit)
    return reports


def test_ownership_idempotency_and_revision(monkeypatch):
    setup(monkeypatch)
    u = dict(id='marcel', name='Marcel Schmidt', role='employee')
    body = dict(opId='op-123', baseRevision=0, report=raw(), submit=True)
    d = asyncio.run(routes.save('report-123', body, u))
    assert d['revision'] == 1
    assert asyncio.run(routes.save('report-123', body, u))['revision'] == 1
    with pytest.raises(HTTPException) as e:
        asyncio.run(routes.save('report-123', {**body, 'opId': 'op-456'}, u))
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        asyncio.run(routes.accessible('report-123', dict(id='other', role='employee')))
    assert e.value.status_code == 404
    assert asyncio.run(routes.accessible('report-123', dict(id='boss', role='manager')))


def test_pdf_all_attachments_in_order():
    import fitz
    r = clean_report(raw(), True)
    r.update(revision=1, owner_name='Marcel Schmidt')
    img = Image.new('RGB', (100, 200), 'white'); b = io.BytesIO(); img.save(b, format='PNG')
    def ticket_pdf(text):
        doc = fitz.open(); page = doc.new_page(); page.insert_text((30, 30), text); return doc.tobytes()
    files = [(r['tickets'][0], ticket_pdf('ticket-A'), 'application/pdf'), (r['tickets'][0], b.getvalue(), 'image/png'), (r['tickets'][0], ticket_pdf('ticket-B'), 'application/pdf')]
    pdf = fitz.open(stream=production_pdf(r, files), filetype='pdf')
    assert pdf.page_count == 6
    assert 'ticket-A' in pdf[2].get_text() and 'ticket-B' in pdf[5].get_text()
    assert '183.45' in pdf[0].get_text()


def test_pdf_long_work_stays_on_page():
    import fitz
    r = clean_report(raw()); r.update(revision=1, owner_name='Hana Hynčicová', work='Třídění materiálu a kontrola pracoviště. ' * 100)
    doc = fitz.open(stream=production_pdf(r, []), filetype='pdf')
    assert doc.page_count > 1
    for page in doc:
        for block in page.get_text('blocks'):
            assert block[3] < page.rect.height
