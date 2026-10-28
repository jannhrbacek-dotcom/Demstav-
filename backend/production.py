"""Shared crew output, deliberately separate from employees' working hours."""
import re
from datetime import date, datetime
from zoneinfo import ZoneInfo
from decimal import Decimal, InvalidOperation
from fastapi import HTTPException


def clean_report(raw, submitted=False):
    def txt(key, limit=1000):
        value = str(raw.get(key) or '').strip()
        if len(value) > limit:
            raise HTTPException(400, f'Pole {key} je příliš dlouhé.')
        return value
    result = {k: txt(k, n) for k, n in [('date', 10), ('customer', 300), ('site', 300), ('job', 100), ('crew', 1000), ('machines', 1000), ('equipment', 1000), ('work', 4000), ('customer_name', 300), ('note', 2000)]}
    try:
        date.fromisoformat(result['date'])
    except ValueError:
        raise HTTPException(400, 'Vyberte platné datum.')
    for k in ('start', 'end'):
        result[k] = txt(k, 5)
        if result[k] and not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', result[k]):
            raise HTTPException(400, 'Čas musí mít formát HH:MM.')
    result['hours'] = None
    if result['start'] and result['end']:
        def minutes(s):
            h, m = map(int, s.split(':'))
            return h * 60 + m
        delta = minutes(result['end']) - minutes(result['start'])
        if delta <= 0:
            raise HTTPException(400, 'Konec musí být po začátku. Noční práci rozdělte o půlnoci.')
        result['hours'] = round(delta / 60, 2)
    def tonnes(v):
        if v in ('', None):
            return None
        try:
            n = Decimal(str(v).replace(',', '.'))
            if not n.is_finite() or n < 0 or n > 1000000:
                raise InvalidOperation
            return float(n.quantize(Decimal('.01')))
        except (InvalidOperation, ValueError):
            raise HTTPException(400, 'Hmotnost musí být nezáporné číslo v tunách.')
    result['shift'] = txt('shift', 100) or 'Denní'
    result['shift_closed'] = raw.get('shift_closed') is True
    tickets = raw.get('tickets') or []
    if not isinstance(tickets, list) or len(tickets) > 50:
        raise HTTPException(400, 'Nejvýše 50 vážních lístků.')
    result['tickets'] = []
    for ticket in tickets:
        if not isinstance(ticket, dict):
            raise HTTPException(400, 'Neplatný vážní lístek.')
        aid = str(ticket.get('attachment_id') or '')
        if not re.fullmatch(r'[a-zA-Z0-9_-]{8,100}', aid):
            raise HTTPException(400, 'K lístku přiložte fotografii nebo PDF.')
        result['tickets'].append({'attachment_id': aid, 'number': str(ticket.get('number') or '')[:100], 'fraction': str(ticket.get('fraction') or '')[:100], 'tonnes': tonnes(ticket.get('tonnes'))})
    ids = [t['attachment_id'] for t in result['tickets']]
    if len(ids) != len(set(ids)):
        raise HTTPException(400, 'Stejná příloha je ve výkazu vícekrát.')
    known = [Decimal(str(t['tonnes'])) for t in result['tickets'] if t['tonnes'] is not None]
    result['ticket_total'] = float(sum(known)) if known else None
    complete = bool(tickets) and len(known) == len(tickets)
    result['tonnes'] = result['ticket_total'] if complete else None
    result['tonnage_warning'] = ''
    if not complete:
        result['tonnage_warning'] = 'Součet lístků není úplný. Zkontrolujte fotografie a doplňte celkové hmotnosti lístků.'
    if submitted:
        if not result['shift_closed']:
            raise HTTPException(422, 'Výkaz se odevzdává až po skončení směny a sesbírání všech lístků.')
        if not all(result[k] for k in ('customer', 'site', 'crew', 'machines', 'work', 'start', 'end')) or result['tonnes'] is None:
            raise HTTPException(422, 'Doplňte odběratele, pracoviště, posádku, stroje, práci, čas a tonáž.')
        if not tickets:
            raise HTTPException(422, 'K odevzdání přiložte alespoň jeden vážní lístek.')
        if not complete:
            raise HTTPException(422, 'Doplňte hmotnost každého lístku. Neúplný součet lze uložit pouze jako koncept.')
        end = datetime.fromisoformat(result['date'] + 'T' + result['end']).replace(tzinfo=ZoneInfo('Europe/Prague'))
        if end > datetime.now(ZoneInfo('Europe/Prague')):
            raise HTTPException(422, 'Směna podle uvedeného konce ještě neskončila.')
    result['status'] = 'submitted' if submitted else 'draft'
    return result
