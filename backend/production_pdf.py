"""Printable crew report followed by every weighing ticket."""
import fitz
from fastapi import HTTPException
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from exports import Pdf, GREY, dmy


def production_pdf(doc, files):
    p = Pdf()
    p.page(A4)
    p.logo(175, 30)
    p.txt(215, 30, 'VÝKAZ PRÁCE A TONÁŽE', 16, True)
    p.txt(215, 55, f"{dmy(doc['date'])} | Revize {doc['revision']}", 10)
    p.txt(215, 74, 'ODEVZDANÝ' if doc['status'] == 'submitted' else 'PRACOVNÍ VERZE', 10, True)
    y = 110
    for title, key in [('Odběratel', 'customer'), ('Pracoviště', 'site'), ('Stavba / akce', 'job'), ('Posádka', 'crew'), ('Stroje', 'machines'), ('Přídavné pracovní zařízení', 'equipment'), ('Popis práce', 'work')]:
        if y > 640:
            p.page(A4)
            y = 35
        p.txt(30, y, title, 9, True)
        lines = []
        for part in str(doc.get(key) or '-').split('\n'):
            lines.extend(simpleSplit(part, 'DV', 10, 380) or [''])
        for line in lines:
            if y > 670:
                p.page(A4)
                y = 35
                p.txt(30, y, title + ' (pokračování)', 9, True)
            p.txt(180, y, line, 10)
            y += 14
        y += 12
    if y > 620:
        p.page(A4)
        y = 35
    p.rect(30, y, 535, 50, GREY)
    p.txt(40, y + 8, f"Čas: {doc.get('start') or '-'} - {doc.get('end') or '-'}", 11, True)
    p.txt(40, y + 28, f"Hodiny: {doc.get('hours') if doc.get('hours') is not None else '-'}", 10)
    p.txt(300, y + 8, f"Celkem: {doc.get('tonnes') if doc.get('tonnes') is not None else '-'} t", 11, True)
    p.txt(300, y + 28, f"Součet lístků: {doc.get('ticket_total') if doc.get('ticket_total') is not None else '-'} t", 10)
    y += 68
    for text in [doc.get('tonnage_warning'), doc.get('note')]:
        if text:
            for part in text.split('\n'):
                for line in simpleSplit(part, 'DV', 9, 535) or ['']:
                    if y > 675:
                        p.page(A4)
                        y = 35
                    p.txt(30, y, line, 9)
                    y += 12
            y += 12
    if y > 660:
        p.page(A4)
        y = 35
    p.para(30, y, 535, 'Zpracoval: ' + doc['owner_name'], 10)
    p.para(30, y + 25, 535, 'Potvrzení odběratele - jméno: ' + (doc.get('customer_name') or '____________________________'), 10)
    p.txt(30, y + 65, 'Podpis odběratele: ____________________________________', 10)
    p.txt(30, 805, 'Společný výkaz posádky. Pracovní hodiny zaměstnanců se vedou samostatně.', 8)
    for ticket, data, ct in files:
        p.page(A4)
        p.para(30, 30, 535, f"Vážní lístek {ticket.get('number') or '-'} | {doc['date']} | {ticket.get('fraction') or 'frakce neuvedena'}", 11, True)
        if ct != 'application/pdf' and not p.image(data, 30, 80, 535, 720):
            raise HTTPException(422, 'Fotografii nelze vložit do PDF. Použijte JPG nebo PNG.')
        if ct == 'application/pdf':
            p.txt(30, 70, 'Doklad PDF následuje za touto stranou.', 10)
    # Keep each cover and its PDF attachment adjacent.
    base = fitz.open(stream=p.bytes(), filetype='pdf')
    cover_start = base.page_count - len(files)
    for i in reversed(range(len(files))):
        ticket, data, ct = files[i]
        if ct == 'application/pdf':
            try:
                att = fitz.open(stream=data, filetype='pdf')
                if not att.page_count or att.is_encrypted:
                    raise ValueError()
                base.insert_pdf(att, start_at=cover_start + i + 1)
            except Exception:
                raise HTTPException(422, 'Přiložený PDF lístek nelze otevřít.')
    return base.tobytes()
