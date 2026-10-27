"""PDF exports matching the company templates (DEMSTAV šichtovnice + provozní deník).
Exports use the same stored records and the same time calculation (worktime.py) as the screens."""
import io
import os
from datetime import date as date_cls, datetime
from zoneinfo import ZoneInfo

import fitz  # pymupdf, used only to append PDF attachments
from reportlab.lib.colors import HexColor, black
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
import base64

from worktime import time_breakdown, day_union, fmt_hours

FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
pdfmetrics.registerFont(TTFont("DV", os.path.join(FONT_DIR, "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DVB", os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf")))
GREY = HexColor("#EDEDED")
RED = HexColor("#7A1010")
YELLOW = HexColor("#F2C200")
MUTED = HexColor("#555555")
TITLE = os.environ.get("TIMESHEET_TITLE", "Týdenní výkaz strojníka střediska 002 - MECHANIZACE")
SERVICE_PHONE = os.environ.get("SERVICE_PHONE", "602 786 464")
SERVICE_PHONE_2 = os.environ.get("SERVICE_PHONE_2", "602 736 583")
SERVICE_BY = {"operator": "servis - strojník", "workshop": "servis - dílna výjezd", "external": "servis - cizí"}
KIND_LABEL = {"vehicleFuel": "Doklad o tankování vozidla", "machineFuel": "Doklad o tankování stroje", "invoice": "Podklad pro fakturaci",
              "photo": "Fotografie", "other": "Ostatní"}
ROWS_PER_SHEET = 9
SECTION_TITLE = {"timesheet": "PŘÍLOHA - FOTO K ŠICHTOVNICI", "service": "PŘÍLOHA - FOTO ZE SERVISU", "general": "PŘÍLOHA - DOKLAD"}
SECTION_ORDER = {"timesheet": 0, "general": 1, "service": 2}


def dmy(d: str, year=True) -> str:
    y, m, dd = d.split("-")
    return f"{dd}.{m}.{y}" if year else f"{dd}.{m}."


def ivs(items) -> str:
    return "\n".join(f"{i['start']}-{i['end']}" for i in items if i.get("start") and i.get("end"))


def export_stamp() -> str:
    n = datetime.now(ZoneInfo("Europe/Prague"))
    return f"{n.day}. {n.month}. {n.year}"


class Pdf:
    def __init__(self):
        self.buf = io.BytesIO()
        self.c = canvas.Canvas(self.buf, pagesize=landscape(A4))
        self.c.setTitle("DEMSTAV export")
        self.c.setAuthor("DEMSTAV OPERATIONS")
        self.h = landscape(A4)[1]
        self.started = False

    def page(self, size):
        if self.started:
            self.c.showPage()
        self.started = True
        self.c.setPageSize(size)
        self.h = size[1]

    # helpers use top-left coordinates
    def txt(self, x, y, s, size=8, bold=False, color=black, align="left"):
        c = self.c
        c.setFillColor(color)
        c.setFont("DVB" if bold else "DV", size)
        yy = self.h - y - size
        if align == "center":
            c.drawCentredString(x, yy, s)
        elif align == "right":
            c.drawRightString(x, yy, s)
        else:
            c.drawString(x, yy, s)
        c.setFillColor(black)

    def para(self, x, y, w, s, size=8, bold=False, lead=None, max_lines=None, color=black, align="left"):
        lead = lead or size * 1.25
        lines = []
        for part in (s or "").split("\n"):
            lines += simpleSplit(part, "DVB" if bold else "DV", size, w) or [""]
        if max_lines and len(lines) > max_lines:
            lines = lines[:max_lines]
            lines[-1] = lines[-1][: max(0, len(lines[-1]) - 1)] + "…"
        for i, ln in enumerate(lines):
            self.txt(x + (w / 2 if align == "center" else 0), y + i * lead, ln, size, bold, color, align)
        return len(lines) * lead

    def rect(self, x, y, w, h, fill=None, lw=0.8):
        c = self.c
        c.setLineWidth(lw)
        if fill:
            c.setFillColor(fill)
        c.rect(x, self.h - y - h, w, h, stroke=1, fill=1 if fill else 0)
        c.setFillColor(black)

    def line(self, x1, y1, x2, y2, lw=0.8, color=black):
        self.c.setStrokeColor(color)
        self.c.setLineWidth(lw)
        self.c.line(x1, self.h - y1, x2, self.h - y2)
        self.c.setStrokeColor(black)

    def image(self, data: bytes, x, y, w, h):
        try:
            img = ImageReader(io.BytesIO(data))
            iw, ih = img.getSize()
            s = min(w / iw, h / ih)
            dw, dh = iw * s, ih * s
            self.c.drawImage(img, x + (w - dw) / 2, self.h - y - (h + dh) / 2, dw, dh, mask="auto")
            return True
        except Exception:
            return False

    def logo(self, right_x, top):
        self.txt(right_x - 72, top, "DEMSTAV", 21, True, align="center")
        self.txt(right_x - 72, top + 22, "G R O U P", 6.5, True, align="center")
        self.line(right_x - 144, top + 32, right_x, top + 32, 2.2, YELLOW)

    def bytes(self):
        self.c.save()
        return self.buf.getvalue()


def _sig(data_url: str):
    if not data_url or "," not in data_url:
        return None
    try:
        return base64.b64decode(data_url.split(",", 1)[1])
    except Exception:
        return None


def _append_pdf_attachments(base: bytes, pdf_atts: list) -> bytes:
    if not pdf_atts:
        return base
    doc = fitz.open(stream=base, filetype="pdf")
    for data in pdf_atts:
        try:
            att = fitz.open(stream=data, filetype="pdf")
            doc.insert_pdf(att)
        except Exception:
            continue
    return doc.tobytes()


# ============================== ŠICHTOVNICE ==============================
COLS_PX = [70, 93, 164, 99, 44, 87, 95, 96, 95, 73, 96, 97, 101]
HEADERS = ["Datum", "Stroj", "Objednatel", "Pracoviště/\ndílna", "Jízda\n*", "SPZ vozidla\n(na\npracoviště)", "Pracovní\nhodiny\ncelkem",
           "Údržba/\nservis, oprava", "SPZ vozidla\n(z pracoviště)", "Ubytování\nANO/NE", "MTH začátek", "MTH konec", "Zakázka"]


def _week_key(d: str) -> str:
    dt = date_cls.fromisoformat(d)
    return date_cls.fromordinal(dt.toordinal() - dt.weekday()).isoformat()


def timesheet_pdf(groups: list, attachment_loader) -> bytes:
    """groups: [{employee_name, records:[...]}]; attachment_loader(att)->bytes|None"""
    pdf = Pdf()
    pdf_atts = []
    if not any(g["records"] for g in groups):
        pdf.page(landscape(A4))
        pdf.txt(40, 60, "Pro zvolený filtr nejsou žádné záznamy.", 12, True)
        return pdf.bytes()
    for g in groups:
        weeks = {}
        for r in sorted(g["records"], key=lambda r: (r["date"], r.get("updatedAt", ""))):
            weeks.setdefault(_week_key(r["date"]), []).append(r)
        for wk, recs in sorted(weeks.items()):
            ws = date_cls.fromisoformat(wk)
            we = date_cls.fromordinal(ws.toordinal() + 6)
            sheets = [recs[i:i + ROWS_PER_SHEET] for i in range(0, len(recs), ROWS_PER_SHEET)]
            supplement = []  # (title, lines)
            for si, sheet in enumerate(sheets, 1):
                _ts_sheet(pdf, g["employee_name"], ws, we, si, sheet, recs)
                _ts_service(pdf, g["employee_name"], si, len(sheets), sheet, supplement, recs)
            for r in recs:
                bd = time_breakdown(r)
                lines = [f"Pracovní doba celkem: {ivs(bd['totalIntervals']) or '—'} ({fmt_hours(bd['totalHours'])} h)",
                         f"Práce bez servisu{' a prostojů' if bd['downtimeHours'] else ''}: {ivs(bd['workIntervals']) or 'žádná'} ({fmt_hours(bd['workHours'])} h)",
                         f"Servis (součást pracovní doby): {ivs(bd['serviceIntervals']) or 'žádný'} ({fmt_hours(bd['serviceHours'])} h)"]
                if bd["downtimeHours"]:
                    lines.append(f"Prostoje (součást pracovní doby): {ivs(bd['downtimeIntervals'])} ({fmt_hours(bd['downtimeHours'])} h)"
                                 + (f" – {r['downtimeReason']}" if r.get("downtimeReason") else ""))
                lines.append("Servis i prostoje jsou již zahrnuty v celkové pracovní době; časy se nesčítají podruhé.")
                if r.get("work"):
                    lines.append(f"Popis práce: {r['work']}")
                if r.get("drive"):
                    lines.append(f"Jízda *: {r['drive']}")
                lines.append(f"Stav zápisu: {'Potvrzený' if r['status'] == 'confirmed' else 'Pracovní verze'}; revize {r['revision']}")
                if r.get("confirmedAt"):
                    lines.append(f"Potvrzeno: {r['confirmedAt']} (účet {r.get('author_name', '')})")
                if r.get("correctionReason"):
                    lines.append(f"Důvod opravy: {r['correctionReason']}")
                lines.append(f"ID zápisu: {r['id']}")
                supplement.append((f"{dmy(r['date'])} | {r.get('machine', '')} | {r.get('operator', '')} | revize {r['revision']}", lines))
            by_day = {}
            for r in recs:
                by_day.setdefault(r["date"], []).append(r)
            for d, rs in sorted(by_day.items()):
                u = day_union(rs)
                if u["overlapHours"] > 0.001:
                    supplement.append((f"Upozornění – překryv časů {dmy(d)}", [
                        f"Zápisy tohoto dne se časově překrývají o {fmt_hours(u['overlapHours'])} h (např. střídání strojů).",
                        "V součtech výkazu je každá minuta zaměstnance započtena pouze jednou."]))
            _ts_supplement(pdf, supplement)
            for r in recs:
                for a in sorted(r.get("attachments") or [], key=lambda a: SECTION_ORDER.get(a.get("section") or "general", 9)):
                    data = attachment_loader(a)
                    pdf.page(A4)
                    pdf.txt(25, 30, SECTION_TITLE.get(a.get("section") or "general", "PŘÍLOHA - DOKLAD"), 14, True)
                    pdf.txt(25, 52, f"{dmy(r['date'])} | {r.get('machine', '')} | {KIND_LABEL.get(a.get('kind'), 'Ostatní')} | {a.get('name', '')}"
                            + (f" | stav km {a['km']}" if a.get("km") else ""), 8)
                    ok = False
                    if data and a.get("type", "").startswith("image/"):
                        ok = pdf.image(data, 25, 70, 545, 700)
                    if data and a.get("type") == "application/pdf":
                        pdf_atts.append(data)
                        pdf.txt(25, 80, "Dokument PDF je připojen na konec tohoto exportu.", 9)
                        ok = True
                    if not ok:
                        pdf.txt(25, 80, "Soubor nelze zobrazit v PDF (formát nebo dostupnost); je uložen v aplikaci.", 9, color=RED)
                    pdf.txt(25, 790, f"Doklad přiložen k zápisu {r['id']}" + (f" | SHA-256 souboru {a['sha256'][:16]}…" if a.get("sha256") else ""), 7, color=MUTED)
    return _append_pdf_attachments(pdf.bytes(), pdf_atts)


def _ts_sheet(pdf: Pdf, name, ws, we, list_no, sheet, all_recs):
    pdf.page(landscape(A4))
    pdf.txt(70, 36, TITLE, 12.5, True)
    pdf.txt(25, 60, f"{ws.strftime('%d.%m.%Y')} - {we.strftime('%d.%m.%Y')} | list {list_no}", 7.5)
    pdf.logo(812, 30)
    pdf.rect(25, 80, 796, 50)
    pdf.line(244, 80, 244, 130)
    pdf.txt(29, 85, "Jméno:", 8, True)
    pdf.txt(29, 100, name, 12)
    pdf.para(248, 84, 568, "SPZ vozidla, kterým se dopravujete „na“ a „z“ pracoviště, uvádějte ke každému dni do sloupce. Pokud jedete více vozidly, uveďte jejich SPZ.\n"
             "NEZAPOMEŇTE SE VE VOZIDLE ČIPOVAT COBY SPOLUJEZDCI! Pokud neuvedete všechny SPZ vozidel a současně se zapomenete ve vozidle načipovat, ať již jako řidič či spolujezdec, nelze proplatit stravné.", 6.6, True)
    scale = 796 / sum(COLS_PX)
    widths = [w * scale for w in COLS_PX]
    top, hh, rh = 136, 32, 29
    x = 25
    for i, w in enumerate(widths):
        pdf.rect(x, top, w, hh, GREY)
        pdf.para(x + 2, top + 4, w - 4, HEADERS[i], 6.2 if i in (5, 6, 7, 8, 9) else 6.8, True, align="center")
        x += w
    for ri in range(ROWS_PER_SHEET):
        r = sheet[ri] if ri < len(sheet) else None
        y = top + hh + ri * rh
        x = 25
        vals = [""] * 13
        if r:
            bd = time_breakdown(r)
            vals = [dmy(r["date"], False), r.get("machine", ""), r.get("customer", ""), r.get("site", ""), r.get("drive", ""),
                    r.get("vehiclesTo", ""), ivs(bd["totalIntervals"]), ivs(bd["serviceIntervals"]), r.get("vehiclesFrom", ""),
                    {"yes": "ANO", "no": "NE"}.get(r.get("accommodation"), ""), r.get("mthStart", ""), r.get("mthEnd", ""), r.get("job", "")]
        for i, w in enumerate(widths):
            pdf.rect(x, y, w, rh)
            if vals[i]:
                pdf.para(x + 4, y + 4, w - 6, vals[i], 7.2, max_lines=3, lead=8.6)
            x += w
    y = top + hh + ROWS_PER_SHEET * rh
    pdf.rect(25, y, 796, 28)
    pdf.para(30, y + 5, 786, "POKUD JSTE PROVÁDĚLI NA STROJI SERVIS ČI OPRAVU, JE VAŠÍ POVINNOSTÍ UVÁDĚT NA DRUHOU STRANU TISKOPISU POPIS PRÁCE. POKUD SI UVEDETE DO VÝKAZU HODINY ZA SERVIS ČI OPRAVY STROJE A NEUVEDETE POPIS, CO JSTE NA STROJI PROVEDLI, NEMŮŽE VÁM BÝT TENTO ČAS PRÁCE ZAPOČÍTÁN DO MZDY.", 6.2, True, align="center")
    pdf.rect(25, y + 28, 796, 25)
    pdf.txt(423, y + 35, "Povinná příloha: DOKLAD O TANKOVÁNÍ vč. stavu km (OD 1. 8. 2022 JE POVINNOSTÍ TANKOVAT VOZIDLA VŽDY DOPLNA PO AUTOMATICKÉ VYPNUTÍ PISTOLE)", 6.2, True, align="center")
    pdf.txt(421, y + 64, "POVINNOST PSÁT ZAČÁTEK A KONEC MTH!!!", 15, True, RED, "center")
    pdf.txt(421, y + 89, "S týdenním výkazem odevzdávejte vždy všechny doklady související s uvedenými daty v tomto výkazu - doklad o tankování, podklad pro fakturaci aj.", 6.8, True, align="center")
    pdf.txt(421, y + 99, "NA DOKLAD O TANKOVÁNÍ UVÁDĚJTE VŽDY STAV KM PŘI TANKOVÁNÍ!!!", 6.8, True, align="center")
    if any(r["status"] != "confirmed" for r in sheet):
        pdf.txt(25, 563, "PRACOVNÍ VERZE - obsahuje nepotvrzené zápisy", 7.5, True, RED)
    by_day = {}
    for r in all_recs:
        by_day.setdefault(r["date"], []).append(r)
    tot = {"totalHours": 0, "workHours": 0, "serviceHours": 0, "downtimeHours": 0}
    for rs in by_day.values():
        u = day_union(rs)
        for k in tot:
            tot[k] += u[k]
    foot = f"DEMSTAV | Pracovní doba celkem {fmt_hours(tot['totalHours'])} h | Práce bez servisu{' a prostojů' if tot['downtimeHours'] else ''} {fmt_hours(tot['workHours'])} h | Servis {fmt_hours(tot['serviceHours'])} h (zahrnut v celku)"
    if tot["downtimeHours"]:
        foot += f" | Prostoje {fmt_hours(tot['downtimeHours'])} h (zahrnuty v celku)"
    foot += f" | týden celkem, export {export_stamp()}"
    pdf.txt(25, 577, foot, 6.3, color=MUTED)


def _ts_service(pdf: Pdf, name, list_no, list_total, sheet, supplement, all_recs):
    pdf.page(landscape(A4))
    pdf.txt(27, 28, "POPIS SERVISŮ / ZÁVAD STROJE:", 13.5, True)
    pdf.txt(25, 49, f"Týdenní výkaz list {list_no} | {name} | servisní příloha {list_no}", 6.8)
    scale = 796 / 1210
    widths = [w * scale for w in (72, 99, 504, 432, 103)]
    heads = ["Datum", "Čas odstranění\nod-do", "Popis SERVISU nebo ZÁVADY stroje", "Popis odstranění ZÁVADY (oprava prováděná strojníkem)", "podpis dílny"]
    top, hh, rh = 62, 25, 22
    x = 25
    for i, w in enumerate(widths):
        pdf.rect(x, top, w, hh, GREY)
        pdf.para(x + 2, top + 4, w - 4, heads[i], 6.6, True, align="center")
        x += w
    rows = []
    for r in sheet:
        bd = time_breakdown(r)
        if bd["serviceHours"] > 0 or r.get("serviceDescription") or r.get("repairDescription"):
            n = len(supplement) + 1
            desc_lines = [r.get("machine", ""), r.get("serviceDescription") or "—"]
            if r.get("repairDescription"):
                desc_lines.append("Oprava: " + r["repairDescription"])
            by = SERVICE_BY.get(r.get("serviceBy"), "")
            if r.get("serviceBy") == "external" and r.get("externalCompany"):
                by += f" ({r['externalCompany']})"
            if by:
                desc_lines.append(by)
            supplement.append((f"Servisy list {list_no}/{list_total} / řádek {len(rows) + 1} / Popis SERVISU nebo ZÁVADY stroje", desc_lines))
            rows.append((dmy(r["date"]), ivs(bd["serviceIntervals"]), f"Viz doplnění {n}", "", r.get("workshopSignature")))
        for f in r.get("faults") or []:
            if f.get("resolved"):
                rows.append((dmy(f.get("date") or r["date"]), f.get("time", ""), ("STOP: " if f["severity"] == "stop" else "") + f["description"], f.get("resolution", ""), None))
    nrows = max(7, len(rows))
    for ri in range(nrows):
        y = top + hh + ri * rh
        x = 25
        row = rows[ri] if ri < len(rows) else ("", "", "", "", None)
        for i, w in enumerate(widths):
            pdf.rect(x, y, w, rh)
            if i == 4 and row[4]:
                sig = _sig(row[4])
                if sig:
                    pdf.image(sig, x + 2, y + 1, w - 4, rh - 2)
            elif row[i]:
                pdf.para(x + 3, y + 4, w - 6, row[i], 6.4 if i != 1 else 8, max_lines=2, lead=7.6)
            x += w
    y = top + hh + nrows * rh
    pdf.rect(25, y, 796, 19)
    pdf.txt(29, y + 5, "Do popisu servisu provedeného v místě zakázky uvádějte také informaci: servis - strojník, servis - dílna výjezd, servis - cizí (uveďte název firmy) - uveďte vždy jednu z variant.", 6.4)
    y += 30
    pdf.txt(27, y, "POPIS NAHLÁŠENÝCH ZÁVAD STROJE (VOZIDLA) NA DÍLNU:", 13.5, True)
    y += 22
    widths2 = [72 * scale, 99 * scale, 1039 * scale]
    heads2 = ["Datum", "Čas", f"NAHLÁŠENÉ ZÁVADY vedoucímu servisu (TEL {SERVICE_PHONE})"]
    x = 25
    for i, w in enumerate(widths2):
        pdf.rect(x, y, w, 19, GREY)
        pdf.txt(x + w / 2, y + 5, heads2[i], 6.6, True, align="center")
        x += w
    reported = [(dmy(f.get("date") or r["date"]), f.get("time", ""), ("STOP – " if f["severity"] == "stop" else "") + f"{r.get('machine', '')}: {f['description']}")
                for r in sheet for f in (r.get("faults") or []) if not f.get("resolved") or f.get("reportedToWorkshop")]
    nrep = max(5, len(reported))
    rh2 = 24 if nrep <= 5 else max(12, 120 / nrep)
    for ri in range(nrep):
        yy = y + 19 + ri * rh2
        x = 25
        row = reported[ri] if ri < len(reported) else ("", "", "")
        for i, w in enumerate(widths2):
            pdf.rect(x, yy, w, rh2)
            if row[i]:
                pdf.para(x + 3, yy + 4, w - 6, row[i], 7, max_lines=2, lead=8)
            x += w
    y = y + 19 + nrep * rh2
    box_h = max(60, 555 - y)
    pdf.rect(25, y, 796, box_h)
    pdf.txt(29, y + 7, "Poučení pro hlášení závad na strojích a vozidlech:", 10.5, True)
    pdf.para(29, y + 25, 786, f"V případě závažné poruchy stroje kontaktujte ihned telefonicky vedoucího servisu tel. {SERVICE_PHONE}!\n"
             "Závady stroje, požadavky na ND či servis zapište v okamžiku zjištění do předepsaného tiskopisu.\n"
             f"Vyplněný tiskopis vyfoťte a odešlete na tel. č. {SERVICE_PHONE} a tel. č. {SERVICE_PHONE_2}.\n"
             "Písemně se oznamují veškeré závady či požadavky na servis, přestože jste závadu nahlásili osobně či telefonicky!\n"
             "Originál a 1 kopii předávejte zaměstnanci, který rozváží PHM, případně osobně vhoďte do schránky umístěné na mobilní kancelářské buňce autoservisu.\n"
             "1 kopii ponechávejte ve stroji pro kontrolu, co již bylo nahlášeno.", 6.8, max_lines=8)
    if any(r["status"] != "confirmed" for r in sheet):
        pdf.txt(25, 563, "PRACOVNÍ VERZE - obsahuje nepotvrzené zápisy", 7.5, True, RED)
    pdf.txt(25, 577, "DEMSTAV | Pokyny a kontakty přepsány z dodaného firemního vzoru; export sám závadu neodesílá.", 6.3, color=MUTED)


def _ts_supplement(pdf: Pdf, items):
    if not items:
        return
    page_no = 1
    pdf.page(A4)
    pdf.txt(25, 28, "DOPLNĚNÍ VÝKAZU", 14, True)
    pdf.txt(25, 48, f"DEMSTAV | Textové doplnění | {page_no}", 7, color=MUTED)
    y = 68
    for n, (title, lines) in enumerate(items, 1):
        need = 14 + sum(10 * max(1, len(simpleSplit(ln, "DV", 8, 530))) for ln in lines) + 8
        if y + need > 810:
            page_no += 1
            pdf.page(A4)
            pdf.txt(25, 28, "DOPLNĚNÍ VÝKAZU", 14, True)
            pdf.txt(25, 48, f"DEMSTAV | Textové doplnění | {page_no}", 7, color=MUTED)
            y = 68
        pdf.para(25, y, 545, f"{n}. {title}", 8.5, True)
        y += 13
        for ln in lines:
            y += pdf.para(35, y, 530, ln, 8, lead=10)
        y += 8


# ============================== PROVOZNÍ DENÍK ==============================
def diary_pdf(records: list, attachment_loader=None) -> bytes:
    pdf = Pdf()
    recs = sorted(records, key=lambda r: (r.get("machine", ""), r["date"], r.get("updatedAt", "")))
    if not recs:
        pdf.page(A4)
        pdf.txt(40, 60, "Pro zvolený filtr nejsou žádné záznamy.", 12, True)
        return pdf.bytes()
    overflow = []
    sheet = 0
    for i in range(0, len(recs), 2):
        sheet += 1
        pdf.page(A4)
        _diary_block(pdf, recs[i], 18, overflow)
        if i + 1 < len(recs):
            _diary_block(pdf, recs[i + 1], 405, overflow)
        pdf.txt(25, 778, "Mth - motohodiny: provozní hodiny stroje, údaj o době běhu motoru pro stanovení pravidelné údržby.", 6.3)
        marks = " / ".join(f"{x['id'][:8]} r{x.get('revision', '')} {x['integrity_hash'][:12]}" for x in recs[i:i + 2] if x.get("integrity_hash"))
        pdf.txt(25, 822, f"DEMSTAV | Provozní deník | list {sheet} | datum exportu {export_stamp()}" + (f" | otisk SHA-256: {marks}" if marks else ""), 6.3, color=MUTED)
    if overflow:
        pdf.page(A4)
        pdf.txt(25, 28, "DOPLNĚNÍ PROVOZNÍHO DENÍKU", 14, True)
        y = 56
        for title, lines in overflow:
            if y > 760:
                pdf.page(A4)
                y = 30
            y += pdf.para(25, y, 545, title, 8.5, True) + 2
            for ln in lines:
                y += pdf.para(35, y, 530, ln, 8, lead=10)
            y += 8
    pdf_atts = []
    if attachment_loader:
        for r in recs:
            for a in [a for a in (r.get("attachments") or []) if a.get("section") == "service"]:
                data = attachment_loader(a)
                pdf.page(A4)
                pdf.txt(25, 30, "PŘÍLOHA - FOTO ZE SERVISU", 14, True)
                pdf.txt(25, 52, f"{dmy(r['date'])} | {r.get('machine', '')} | {r.get('operator', '')} | {a.get('name', '')}", 8)
                ok = False
                if data and a.get("type", "").startswith("image/"):
                    ok = pdf.image(data, 25, 70, 545, 700)
                if data and a.get("type") == "application/pdf":
                    pdf_atts.append(data)
                    pdf.txt(25, 80, "Dokument PDF je připojen na konec tohoto exportu.", 9)
                    ok = True
                if not ok:
                    pdf.txt(25, 80, "Soubor nelze zobrazit v PDF (formát nebo dostupnost); je uložen v aplikaci.", 9, color=RED)
                pdf.txt(25, 790, f"Příloha k zápisu {r['id']}" + (f" | SHA-256 souboru {a['sha256'][:16]}…" if a.get("sha256") else ""), 7, color=MUTED)
    return _append_pdf_attachments(pdf.bytes(), pdf_atts)


def _check(pdf, x, y, on):
    pdf.rect(x, y, 8.5, 8.5, lw=0.6)
    if on:
        pdf.line(x, y, x + 8.5, y + 8.5, 0.6)
        pdf.line(x + 8.5, y, x, y + 8.5, 0.6)


def _diary_block(pdf: Pdf, r: dict, top: float, overflow: list):
    s = 595 / 910
    X = lambda px: px * s
    L, R = X(38), X(871)
    W = R - L
    bd = time_breakdown(r)
    y = top
    pdf.rect(L, y, W, 18)
    pdf.txt(L + 4, y + 5, f"STROJ: {r.get('machine', '')}", 8, True)
    if r["status"] != "confirmed":
        pdf.txt(R - 4, y + 5, "PRACOVNÍ VERZE – zápis není potvrzený", 7, True, RED, "right")
    y += 18
    cols = [X(38), X(143), X(248), X(580), X(871)]
    heads = ["Datum", "Směna", "Jméno posádky (hůlk. písm.)", "Stavba"]
    crew = ", ".join([v for v in (r.get("operator", ""), r.get("crew", "")) if v])
    vals = [dmy(r["date"]), r.get("shift", ""), crew, r.get("site", "")]
    for i in range(4):
        pdf.rect(cols[i], y, cols[i + 1] - cols[i], 17, GREY)
        pdf.txt(cols[i] + 4, y + 5, heads[i], 6.3)
        pdf.rect(cols[i], y + 17, cols[i + 1] - cols[i], 25)
        pdf.para(cols[i] + 4, y + 24, cols[i + 1] - cols[i] - 8, vals[i], 8, max_lines=2, lead=9)
    y += 42
    pdf.rect(L, y, W, 56)
    pdf.txt(L + 4, y + 14, "Provedena denní kontrola a údržba stroje:", 7)
    _check(pdf, X(436), y + 13, r.get("dailyCheck"))
    pdf.txt(X(596), y + 14, "příslušenství stroje:", 7)
    _check(pdf, X(848), y + 13, r.get("accessoryCheck"))
    pdf.txt(L + 4, y + 36, "a vybavení stroje:", 7)
    _check(pdf, X(238), y + 35, r.get("equipmentCheck"))
    pdf.txt(X(373), y + 36, "Stroj je provozuschopný, bez zjevných závad:", 7)
    _check(pdf, X(848), y + 35, r.get("fit") == "yes")
    if r.get("fit") == "no":
        pdf.txt(X(700), y + 36, "NE", 7, True, RED)
    y += 56
    pdf.rect(L, y, W, 17, GREY)
    pdf.txt(L + 4, y + 5, "Další provozní záznamy: údržba, opravy, předání pracoviště, předání stroje:", 6.5)
    y += 17
    first = f"Čas celkem {fmt_hours(bd['totalHours'])} h; práce bez servisu{' a prostojů' if bd['downtimeHours'] else ''} {fmt_hours(bd['workHours'])} h; servis {fmt_hours(bd['serviceHours'])} h"
    first += f"; prostoje {fmt_hours(bd['downtimeHours'])} h." if bd["downtimeHours"] else "."
    lines = [first]
    if r.get("work"):
        lines.append("Práce: " + r["work"])
    if r.get("serviceDescription"):
        lines.append("Servis: " + r["serviceDescription"] + (f" ({SERVICE_BY.get(r.get('serviceBy'), '')})" if r.get("serviceBy") else ""))
    if r.get("intervalService"):
        lines.append(f"Proveden pravidelný servis dle intervalu při stavu {r.get('mthEnd', '')} mth.")
    if r.get("repairDescription"):
        lines.append("Oprava: " + r["repairDescription"])
    for f in r.get("faults") or []:
        t = f"Závada {f.get('time', '')}{' (STOP – vážná)' if f['severity'] == 'stop' else ''}: {f['description']}"
        t += f" – odstraněno: {f['resolution']}" if f.get("resolved") else " – neodstraněno"
        if f.get("acknowledged"):
            t += "; střídající obsluha seznámena"
        lines.append(t)
    if bd["downtimeHours"] and r.get("downtimeReason"):
        lines.append("Prostoj: " + r["downtimeReason"])
    if r.get("notes"):
        lines.append("Poznámka: " + r["notes"])
    if r.get("correctionReason"):
        lines.append(f"Oprava zápisu (revize {r['revision']}): {r['correctionReason']}")
    wrapped = []
    for ln in lines:
        wrapped += simpleSplit(ln, "DV", 7.6, W - 8)
    if len(wrapped) > 4:
        overflow.append((f"{dmy(r['date'])} | {r.get('machine', '')} | {r.get('operator', '')} | zápis {r['id']}", lines))
        wrapped = wrapped[:3] + ["Pokračování viz Doplnění provozního deníku na konci exportu."]
    for i in range(4):
        pdf.rect(L, y + i * 20, W, 20)
        if i < len(wrapped):
            pdf.txt(L + 4, y + i * 20 + 6, wrapped[i], 7.6)
    y += 80
    pdf.rect(L, y, W, 69)
    pdf.txt(L + 4, y + 8, "Pracoviště předal (popis, jméno hůlk. písm. a podpis):", 7)
    ho = " – ".join([v for v in (r.get("handover", ""), r.get("handoverName", "").upper()) if v])
    pdf.para(L + 4, y + 22, W - 150, ho, 7.5, max_lines=4, lead=9)
    hs = _sig(r.get("handoverSignature"))
    if hs:
        pdf.image(hs, R - 140, y + 18, 130, 46)
    y += 69
    lx, c1, c2, c3, c4, sx = X(38), X(188), X(355), X(521), X(688), X(871)
    pdf.rect(lx, y, c1 - lx, 45, GREY)
    pdf.para(lx + 4, y + 6, c1 - lx - 8, "Stav počítadla\nMth*:", 7.5, lead=8.5)
    try:
        diff = float(r["mthEnd"].replace(",", ".")) - float(r["mthStart"].replace(",", "."))
        diff_s = (f"{diff:.3f}".rstrip("0").rstrip(".")).replace(".", ",")
    except Exception:
        diff_s = ""
    for (a, b, lab, val) in ((c1, c2, "Počáteční:", r.get("mthStart", "")), (c2, c3, "Konečný:", r.get("mthEnd", "")), (c3, c4, "Rozdíl:", diff_s)):
        pdf.rect(a, y, b - a, 18, GREY)
        pdf.txt(a + 4, y + 5, lab, 7.5)
        pdf.rect(a, y + 18, b - a, 27)
        pdf.txt(a + 4, y + 25, val, 10.5)
    pdf.rect(c4, y, sx - c4, 89)
    pdf.txt(c4 + 5, y + 6, "Podpis", 7.5)
    sig = _sig(r.get("operatorSignature"))
    if sig:
        pdf.image(sig, c4 + 8, y + 18, sx - c4 - 16, 62)
    y += 45
    pdf.rect(lx, y, c1 - lx, 44, GREY)
    pdf.para(lx + 4, y + 6, c1 - lx - 8, "Doplnění\nprov. kapalin:", 7.5, lead=8.5)
    f1, f2, f3 = X(313), X(438), X(563)
    for (a, b, lab, val) in ((c1, f1, "Nafta:", r.get("diesel", "")), (f1, f2, "Hydr. olej:", r.get("hydraulic", "")),
                             (f2, f3, "Mot. olej:", r.get("oil", "")), (f3, c4, "Jiné", r.get("otherFluid", ""))):
        pdf.rect(a, y, b - a, 17, GREY)
        pdf.txt(a + 4, y + 5, lab, 6.5)
        pdf.rect(a, y + 17, b - a, 27)
        pdf.para(a + 4, y + 23, b - a - 8, val, 7.5, max_lines=2, lead=8.5)
