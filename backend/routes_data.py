"""Datové exporty (XLSX/CSV), přehledy pro zaměstnance a automatické týdenní exporty šichtovnic."""
import csv
import hmac
import io
import logging
import os
from datetime import date as date_cls, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import Response
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from core import db, get_ready_user, is_manager, require_role, iso_now, ROLE_LABELS, POSITIONS, role_label
from routes_attendance import projection, day_bounds_ms, prague_date, KIND_LABELS, PRAGUE
from routes_leave import leaves_in_range, TYPES as LEAVE_TYPES, STATUS_LABELS as LEAVE_STATUS
from storage import put_object, get_object
from break_policy import hydrate_records, hydrate_events
from worktime import time_breakdown, fmt_hours, day_union
from journey import journey_text

log = logging.getLogger("data")
router = APIRouter()

STATUS_REC = {"confirmed": "Potvrzený", "draft": "Pracovní verze"}


def _h(v):
    return round(float(v or 0) + 1e-9, 2)


def _num(v):
    try:
        return float(str(v).replace(",", ".")) if str(v or "").strip() else None
    except ValueError:
        return None


def _ems(e):
    return datetime.fromisoformat(e["effective_at"].replace("Z", "+00:00")).timestamp() * 1000


def _hm(e):
    return datetime.fromisoformat(e["effective_at"].replace("Z", "+00:00")).astimezone(PRAGUE).strftime("%H:%M") if e else ""


def _dates(a: str, b: str):
    d1, d2 = date_cls.fromisoformat(a), date_cls.fromisoformat(b)
    return [date_cls.fromordinal(d1.toordinal() + i).isoformat() for i in range((d2 - d1).days + 1)]


async def _users_scope(user, employee_id="", position=""):
    q = {}
    if not is_manager(user):
        q["id"] = user["id"]
    elif employee_id:
        q["id"] = employee_id
    if position in POSITIONS:
        q["role"] = "employee"
        q["$or"] = [{"position": position}] + ([{"position": {"$in": [None, ""]}}, {"position": {"$exists": False}}] if position == "strojnik" else [])
    return await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(2000)


# ---------------- dataset: šichtovnice / deník ----------------
async def timesheet_rows(user, f: dict):
    users = {u["id"]: u for u in await _users_scope(user, f.get("employee_id", ""), f.get("position", ""))}
    q = {"owner_id": {"$in": list(users)}}
    if f.get("date_from") or f.get("date_to"):
        q["date"] = {k: v for k, v in (("$gte", f.get("date_from")), ("$lte", f.get("date_to"))) if v}
    if f.get("machine"):
        q["machine"] = f["machine"]
    if f.get("status") in STATUS_REC:
        q["status"] = f["status"]
    if f.get("workplace"):
        q["site"] = {"$regex": f["workplace"], "$options": "i"}
    recs = await db.records.find(q, {"_id": 0}).sort([("date", 1), ("owner_name", 1)]).to_list(20000)
    recs = await hydrate_records(recs)
    rows = []
    for r in recs:
        bd = time_breakdown(r)
        ms, me = _num(r.get("mthStart")), _num(r.get("mthEnd"))
        u = users.get(r["owner_id"], {})
        rows.append({
            "Datum": r["date"], "Zaměstnanec": u.get("name") or r.get("owner_name", ""), "Zařazení": role_label(u) if u else "",
            "Stroj": r.get("machine", ""), "Objednatel": r.get("customer", ""), "Pracoviště": r.get("site", ""), "Zakázka": r.get("job", ""),
            "Směna": r.get("shift", ""), "Pracovní doba": ", ".join(f"{i['start']}–{i['end']}" for i in bd["totalIntervals"]),
            "Jízda": journey_text(r), "SPZ na pracoviště": r.get("vehiclesTo", ""), "SPZ z pracoviště": r.get("vehiclesFrom", ""),
            "Řidič / spolujezdec": r.get("journeyRole", ""), "Čipování": "neověřeno",
            "Celkem h": _h(bd["totalHours"]), "Práce bez servisu h": _h(bd["workHours"]), "Servis h": _h(bd["serviceHours"]),
            "Prostoje h": _h(bd["downtimeHours"]), "Přejezdy h": _h(bd.get("travelHours")), "K fakturaci h": _h(bd.get("billableHours", bd["totalHours"])),
            "Přejezdy trasa": "; ".join(f"{t.get('from', '')} → {t.get('to', '')}" for t in r.get("travel") or []),
            "MTH začátek": ms, "MTH konec": me, "MTH celkem": round(me - ms, 1) if ms is not None and me is not None else None,
            "Nafta l": _num(r.get("diesel")), "AdBlue l": _num(r.get("adblue")),
            "Závady": "; ".join(f"{'STOP ' if x.get('severity') == 'stop' else ''}{x.get('description', '')}" for x in r.get("faults") or []),
            "Servis dle intervalu": "ano" if r.get("intervalService") else "",
            "Popis práce": r.get("work", ""), "Stav": STATUS_REC.get(r["status"], r["status"]), "Revize": r.get("revision"),
            "Otisk SHA-256": (r.get("integrity_hash") or "")[:16], "ID zápisu": r["id"],
        })
    return rows, recs, users


# ---------------- dataset: docházka a směny ----------------
async def attendance_rows(user, f: dict):
    today = prague_date()
    df = f.get("date_from") or (date_cls.fromisoformat(today) - timedelta(days=30)).isoformat()
    dt = f.get("date_to") or today
    if (date_cls.fromisoformat(dt) - date_cls.fromisoformat(df)).days > 400:
        raise HTTPException(status_code=400, detail="Vyberte období nejvýše 400 dní.")
    users = await _users_scope(user, f.get("employee_id", ""), f.get("position", ""))
    wps = {w["id"]: w["name"] for w in await db.workplaces.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(2000)}
    leaves = await leaves_in_range(df, dt, [u["id"] for u in users], statuses=("approved", "pending_manager", "pending_director"))
    rows = []
    for u in sorted(users, key=lambda x: x.get("name", "")):
        evs = await db.attendance_events.find({"employee_id": u["id"]}, {"_id": 0}).sort("sequence", 1).to_list(50000)
        evs = await hydrate_events(evs, u["id"])
        my_leaves = [lv for lv in leaves if lv["user_id"] == u["id"]]
        for d in _dates(df, dt):
            fr, to = day_bounds_ms(d)
            day_evs = [e for e in evs if e.get("effective_at") and fr <= _ems(e) < to]
            lv = [x for x in my_leaves if x["date_from"] <= d <= x["date_to"]]
            if not day_evs and not lv:
                continue
            p = projection(evs, frm=fr, to=to)
            if p["presenceHours"] <= 0 and not lv and not day_evs:
                continue
            wp_ids = []
            for s in p["segments"]:
                if s.get("workplace_id") and s["workplace_id"] not in wp_ids:
                    wp_ids.append(s["workplace_id"])
            if f.get("workplace_id") and f["workplace_id"] not in wp_ids:
                continue
            arr = [e for e in day_evs if e["kind"] == "arrival" and e["status"] != "rejected"]
            dep = [e for e in day_evs if e["kind"] == "departure" and e["status"] != "rejected"]
            pend = sum(1 for e in day_evs if e["status"] == "pending_review")

            travel_evs = [e for e in day_evs if e["kind"] == "travel_start"]
            status = "výjimka ke schválení" if pend else ("v pořádku" if day_evs else "")
            if f.get("status") == "pending" and not pend:
                continue
            rows.append({
                "Datum": d, "Zaměstnanec": u.get("name", ""), "Zařazení": role_label(u),
                "Pracoviště": ", ".join(wps.get(w, "") for w in wp_ids), "Příchod": _hm(arr[0]) if arr else "", "Odchod": _hm(dep[-1]) if dep else "",
                "Přítomnost h": _h(p["presenceHours"]), "Přestávky h": _h(p["breakHours"]), "Přejezdy h": _h(p.get("travelHours")),
                "Odpracováno h": _h(p["netHours"]),
                "Přejezdy trasa": "; ".join(f"{e.get('travel_from') or wps.get(e.get('workplace_id'), '')} → {e.get('travel_to', '')}" for e in travel_evs),
                "Nepřítomnost": "; ".join(f"{LEAVE_TYPES[x['type']]}{' (půlden)' if x.get('half_day') else ''}{' ' + x['time_from'] + '–' + x['time_to'] if x.get('time_from') else ''} – {LEAVE_STATUS[x['status']]}" for x in lv),
                "Události": ", ".join(f"{KIND_LABELS.get(e['kind'], e['kind'])} {_hm(e)}" for e in day_evs),
                "Stav": status, "Výjimky": pend,
            })
    return rows


DATASETS = {"timesheet": "sichtovnice", "attendance": "dochazka", "machine_log": "stavebni_denik_stroje"}


def _bool(v):
    return "ano" if v else ""


def _machine_log_header():
    return [
        "Datum", "Směna", "Zaměstnanec", "Objednatel", "Pracoviště", "Zakázka",
        "SPZ na pracoviště", "SPZ z pracoviště", "Ubytování", "Posádka",
        "Pracovní doba (úseky)", "Celkem h", "Práce h", "Servis h", "Prostoje h", "Přejezdy h", "K fakturaci h",
        "Přejezdy – trasa", "Důvod prostoje", "Popis práce",
        "MTH začátek", "MTH konec", "MTH celkem",
        "Denní kontrola", "Kontrola příslušenství", "Kontrola vybavení", "Provozuschopný",
        "Závady (shrnutí)", "STOP závady",
        "Servis provedl", "Externí firma", "Popis servisu", "Popis opravy", "Pravidelný servis (interval)",
        "Nafta l", "Hydr. olej l", "Mot. olej l", "Jiná kapalina",
        "Předal (jméno)", "Poznámky",
        "Stav zápisu", "Revize", "Důvod opravy", "Autor", "ID zápisu", "Otisk SHA-256",
    ]


def _machine_log_row(r, bd, users):
    ms, me = _num(r.get("mthStart")), _num(r.get("mthEnd"))
    faults = r.get("faults") or []
    stops = [f for f in faults if f.get("severity") == "stop"]
    service_actor = {"operator": "Strojník", "operator_workshop": "Strojník + dílna",
                     "workshop": "Dílna – výjezd", "external": "Externí servis"}.get(r.get("serviceBy", ""), "")
    author = users.get(r.get("owner_id", ""), {}).get("name") or r.get("owner_name", "")
    rev = r.get("revisions") or []
    last_reason = rev[-1].get("reason", "") if rev else ""
    return [
        r.get("date", ""), r.get("shift", ""), r.get("operator", ""), r.get("customer", ""), r.get("site", ""), r.get("job", ""),
        r.get("vehiclesTo", ""), r.get("vehiclesFrom", ""), r.get("accommodation", ""), r.get("crew", ""),
        ", ".join(f"{i['start']}–{i['end']}" for i in bd["totalIntervals"]),
        _h(bd["totalHours"]), _h(bd["workHours"]), _h(bd["serviceHours"]), _h(bd["downtimeHours"]),
        _h(bd.get("travelHours")), _h(bd.get("billableHours", bd["totalHours"])),
        "; ".join(f"{t.get('from', '')} → {t.get('to', '')}" for t in r.get("travel") or []),
        r.get("downtimeReason", ""), r.get("work", ""),
        ms, me, round(me - ms, 1) if ms is not None and me is not None else None,
        _bool(r.get("dailyCheck")), _bool(r.get("accessoryCheck")), _bool(r.get("equipmentCheck")),
        {"yes": "ano", "no": "ne", "unknown": "nevím"}.get(r.get("fit", ""), ""),
        "; ".join(f"{'STOP ' if f.get('severity') == 'stop' else ''}{f.get('description', '')}"
                  + (" → " + f.get("resolution", "") if f.get("resolved") else " [neopraveno]") for f in faults),
        "; ".join(f.get("description", "") for f in stops),
        service_actor, r.get("externalCompany", ""), r.get("serviceDescription", ""), r.get("repairDescription", ""),
        _bool(r.get("intervalService")),
        _num(r.get("diesel")), _num(r.get("hydraulic")), _num(r.get("oil")), r.get("otherFluid", ""),
        r.get("handoverName", ""), r.get("notes", ""),
        STATUS_REC.get(r.get("status", ""), r.get("status", "")), r.get("revision"), last_reason,
        author, r.get("id", ""), (r.get("integrity_hash") or "")[:16],
    ]


def _style_header(ws, cols):
    for c in ws[1]:
        c.font = Font(bold=True, color="0F172A")
        c.fill = PatternFill("solid", fgColor="FFD200")
        c.alignment = Alignment(vertical="center", wrap_text=True, horizontal="center")
    ws.row_dimensions[1].height = 32
    for i, _ in enumerate(cols, 1):
        ws.column_dimensions[get_column_letter(i)].width = 18
    ws.freeze_panes = "A2"


import re as _re

_INVALID_SHEET_CHARS = _re.compile(r"[\\/\*\?:\[\]]")


def _safe_sheet_name(name: str) -> str:
    return _INVALID_SHEET_CHARS.sub("-", (name or "Bez stroje").strip())[:28] or "Bez stroje"


def machine_logs_xlsx(records_by_machine: dict, users: dict, machines: dict, meta: dict) -> bytes:
    """Vygeneruje XLSX stavební deník stroje – jeden list na každý stroj.

    `records_by_machine`: {machine_label: [záznamy seřazené podle data]}.
    `machines`: {label: machine_doc} pro doplnění metadat (interní číslo, aktuální MTH apod.).
    """
    wb = Workbook()
    # Souhrnný list jako první.
    overview = wb.active
    overview.title = "Přehled"
    overview.append(["DEMSTAV OPERATIONS – Stavební deník stroje"])
    overview["A1"].font = Font(bold=True, size=14)
    overview.append([f"Období: {meta.get('date_from', '')} – {meta.get('date_to', '')}"])
    overview.append([f"Vygeneroval: {meta.get('generated_by', '')} ({meta.get('generated_at', '')})"])
    overview.append([])
    overview.append(["Stroj", "Interní č.", "Počet záznamů", "Hodiny celkem", "MTH celkem", "List"])
    for c in overview[5]:
        c.font = Font(bold=True)
        c.fill = PatternFill("solid", fgColor="FFD200")

    header = _machine_log_header()
    for label in sorted(records_by_machine.keys(), key=lambda x: x.lower()):
        rows = records_by_machine[label]
        m = machines.get(label.lower(), {})
        sheet_name = _safe_sheet_name(label)
        base = sheet_name
        suffix = 1
        while sheet_name in wb.sheetnames:
            suffix += 1
            sheet_name = _safe_sheet_name(base[:26] + f" {suffix}")
        ws = wb.create_sheet(title=sheet_name)
        ws.append([f"Stavební deník stroje – {label}"])
        ws["A1"].font = Font(bold=True, size=12)
        info = []
        if m.get("internal_number"): info.append(f"interní č. {m['internal_number']}")
        if m.get("manufacturer"): info.append(m["manufacturer"])
        if m.get("vin"): info.append(f"VIN {m['vin']}")
        ws.append([" · ".join(info) if info else ""])
        ws.append([])
        ws.append(header)
        hdr_row = ws.max_row
        total_h = 0.0
        mth_total = 0.0
        for r in sorted(rows, key=lambda x: x.get("date", "")):
            bd = time_breakdown(r)
            ws.append(_machine_log_row(r, bd, users))
            total_h += bd["totalHours"]
            ms, me = _num(r.get("mthStart")), _num(r.get("mthEnd"))
            if ms is not None and me is not None and me >= ms: mth_total += me - ms
        # Styly záhlaví
        for c in ws[hdr_row]:
            c.font = Font(bold=True, color="0F172A")
            c.fill = PatternFill("solid", fgColor="FFD200")
            c.alignment = Alignment(vertical="center", wrap_text=True, horizontal="center")
        ws.row_dimensions[hdr_row].height = 32
        for i, _ in enumerate(header, 1):
            # Dynamická šířka pro čitelné sloupce (max 42).
            col = get_column_letter(i)
            maxlen = max([len(str(header[i - 1]))] + [len(str(ws.cell(row=rr, column=i).value or "")) for rr in range(hdr_row + 1, ws.max_row + 1)])
            ws.column_dimensions[col].width = min(max(maxlen + 2, 12), 42)
        ws.freeze_panes = f"A{hdr_row + 1}"
        if ws.max_row > hdr_row:
            ws.auto_filter.ref = f"A{hdr_row}:{get_column_letter(len(header))}{ws.max_row}"
        overview.append([label, m.get("internal_number", ""), len(rows), round(total_h, 2), round(mth_total, 1), sheet_name])
    for i in range(1, 7):
        overview.column_dimensions[get_column_letter(i)].width = [34, 12, 16, 16, 14, 24][i - 1]
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


async def machine_log_data(user, f: dict):
    """Načte potvrzené i draft záznamy a seskupí je podle stroje."""
    users = {u["id"]: u for u in await _users_scope(user, f.get("employee_id", ""), f.get("position", ""))}
    q = {"owner_id": {"$in": list(users)}}
    if f.get("date_from") or f.get("date_to"):
        q["date"] = {k: v for k, v in (("$gte", f.get("date_from")), ("$lte", f.get("date_to"))) if v}
    if f.get("machine"):
        q["machine"] = f["machine"]
    if not f.get("include_drafts"):
        q["status"] = "confirmed"
    recs = await db.records.find(q, {"_id": 0}).sort([("machine", 1), ("date", 1)]).to_list(50000)
    recs = await hydrate_records(recs)
    by_machine: dict = {}
    for r in recs:
        label = (r.get("machine") or "Bez stroje").strip() or "Bez stroje"
        by_machine.setdefault(label, []).append(r)
    machines = {}
    for m in await db.machines.find({}, {"_id": 0}).to_list(500):
        machines[(m.get("label") or "").strip().lower()] = m
    return by_machine, users, machines


def to_xlsx(rows: list, title: str) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = title[:31]
    if not rows:
        ws.append(["Pro zvolený filtr nejsou žádná data."])
    else:
        head = list(rows[0].keys())
        ws.append(head)
        for c in ws[1]:
            c.font = Font(bold=True, color="0F172A")
            c.fill = PatternFill("solid", fgColor="FFD200")
            c.alignment = Alignment(vertical="center", wrap_text=True)
        for r in rows:
            ws.append([r.get(k) for k in head])
        for i, k in enumerate(head, 1):
            width = min(max(len(str(k)), *(len(str(r.get(k) or "")) for r in rows[:500])) + 2, 60)
            ws.column_dimensions[get_column_letter(i)].width = width
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def to_csv(rows: list) -> bytes:
    out = io.StringIO()
    if rows:
        w = csv.DictWriter(out, fieldnames=list(rows[0].keys()), delimiter=";", extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: (str(v).replace(".", ",") if isinstance(v, float) else ("" if v is None else v)) for k, v in r.items()})
    return ("\ufeff" + out.getvalue()).encode("utf-8")  # BOM – Excel otevře češtinu správně


@router.get("/exports/data")
async def export_data(dataset: str = "attendance", format: str = "xlsx", employee_id: str = "", date_from: str = "", date_to: str = "",
                      machine: str = "", workplace_id: str = "", workplace: str = "", status: str = "", position: str = "",
                      include_drafts: int = 0, user: dict = Depends(get_ready_user)):
    if dataset not in DATASETS or format not in ("xlsx", "csv"):
        raise HTTPException(status_code=400, detail="Neznámý typ exportu.")
    f = {"employee_id": employee_id, "date_from": date_from, "date_to": date_to, "machine": machine, "workplace_id": workplace_id,
         "workplace": workplace, "status": status, "position": position, "include_drafts": bool(include_drafts)}
    name = f"DEMSTAV_{DATASETS[dataset]}_{date_from or 'zacatek'}_{date_to or 'dnes'}.{format}"
    if dataset == "machine_log":
        if format != "xlsx":
            raise HTTPException(status_code=400, detail="Stavební deník stroje se exportuje jen jako XLSX.")
        by_machine, users, machines = await machine_log_data(user, f)
        meta = {"date_from": date_from or "začátek", "date_to": date_to or prague_date(),
                "generated_by": user.get("name", ""), "generated_at": iso_now()[:16].replace("T", " ")}
        data = machine_logs_xlsx(by_machine, users, machines, meta)
        mt = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        return Response(content=data, media_type=mt, headers={"Content-Disposition": f'attachment; filename="{name}"'})
    rows = (await timesheet_rows(user, f))[0] if dataset == "timesheet" else await attendance_rows(user, f)
    if format == "xlsx":
        data, mt = to_xlsx(rows, "Šichtovnice" if dataset == "timesheet" else "Docházka"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        data, mt = to_csv(rows), "text/csv; charset=utf-8"
    return Response(content=data, media_type=mt, headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ---------------- přehledy zaměstnance ----------------
@router.get("/my/summary")
async def my_summary(date_from: str = "", date_to: str = "", employee_id: str = "", user: dict = Depends(get_ready_user)):
    today = prague_date()
    if not date_to:
        date_to = today
    if not date_from:
        d = date_cls.fromisoformat(date_to)
        date_from = (d - timedelta(days=d.weekday())).isoformat()
    target = employee_id if (employee_id and is_manager(user)) else user["id"]
    f = {"employee_id": target, "date_from": date_from, "date_to": date_to}
    scope_user = user if target == user["id"] else {**user}
    ts, recs, _ = await timesheet_rows(scope_user if is_manager(user) else user, f)
    att = await attendance_rows(scope_user if is_manager(user) else user, f)
    by_day = {}
    for r in recs:
        by_day.setdefault(r["date"], []).append(r)
    tot = {"totalHours": 0, "workHours": 0, "serviceHours": 0, "downtimeHours": 0, "travelHours": 0}
    for rs in by_day.values():
        u = day_union(rs)
        for k in tot:
            tot[k] += u.get(k, 0)
    leaves = await leaves_in_range(date_from, date_to, [target], statuses=("approved", "pending_manager", "pending_director"))
    return {"date_from": date_from, "date_to": date_to, "timesheet": ts, "attendance": att,
            "totals": {**{k: _h(v) for k, v in tot.items()}, "attendanceNet": _h(sum(a["Odpracováno h"] for a in att)),
                       "mth": round(sum(r["MTH celkem"] or 0 for r in ts), 1)},
            "leaves": [{**lv, "type_label": LEAVE_TYPES[lv["type"]], "status_label": LEAVE_STATUS[lv["status"]]} for lv in leaves]}


# ---------------- týdenní exporty ----------------
def week_bounds(d: date_cls):
    ws = d - timedelta(days=d.weekday())
    return ws, ws + timedelta(days=6)


async def generate_week(week_start: str, actor_name: str = "automaticky"):
    from exports import timesheet_pdf
    ws = date_cls.fromisoformat(week_start)
    ws, we = week_bounds(ws)
    sys_user = {"id": "system", "name": "Systém", "role": "owner"}
    f = {"date_from": ws.isoformat(), "date_to": we.isoformat()}
    rows, recs, users = await timesheet_rows(sys_user, f)
    att_rows = await attendance_rows(sys_user, f)
    groups = {}
    for r in recs:
        groups.setdefault(r["owner_id"], {"employee_name": users.get(r["owner_id"], {}).get("name") or r.get("owner_name", ""), "records": []})["records"].append(r)
    att_ids = [a["id"] for r in recs for a in (r.get("attachments") or [])]
    atts = {a["id"]: a for a in await db.attachments.find({"id": {"$in": att_ids}, "is_deleted": False}, {"_id": 0}).to_list(5000)}

    def loader(a):
        doc = atts.get(a["id"])
        try:
            return get_object(doc["storage_path"])[0] if doc else None
        except Exception:
            return None
    pdf = timesheet_pdf(sorted(groups.values(), key=lambda g: g["employee_name"]) or [{"employee_name": "—", "records": []}], loader, duplex=True)
    wb = Workbook()
    wb.remove(wb.active)
    for title, data in (("Šichtovnice", rows), ("Docházka", att_rows)):
        tmp = to_xlsx(data, title)
        from openpyxl import load_workbook
        src = load_workbook(io.BytesIO(tmp)).active
        dst = wb.create_sheet(title)
        for row in src.iter_rows(values_only=True):
            dst.append(row)
        for c in dst[1]:
            c.font = Font(bold=True)
            c.fill = PatternFill("solid", fgColor="FFD200")
        for k, dim in src.column_dimensions.items():
            dst.column_dimensions[k].width = dim.width
        dst.freeze_panes = "A2"
    xb = io.BytesIO()
    wb.save(xb)
    key = ws.isoformat()
    files = {}
    for fmt, data, ct in (("pdf", pdf, "application/pdf"), ("xlsx", xb.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                          ("csv", to_csv(rows), "text/csv")):
        res = put_object(f"demstav/weekly/{key}/DEMSTAV_sichtovnice_tyden_{key}.{fmt}", data, ct)
        files[fmt] = {"path": res["path"], "size": len(data)}
    doc = {"week": key, "week_end": we.isoformat(), "files": files, "records": len(recs), "employees": len(groups),
           "generated_at": iso_now(), "generated_by": actor_name}
    await db.weekly_exports.update_one({"week": key}, {"$set": doc}, upsert=True)
    return doc


@router.get("/exports/weekly")
async def list_weekly(user: dict = Depends(require_role("manager"))):
    return await db.weekly_exports.find({}, {"_id": 0}).sort("week", -1).to_list(200)


@router.post("/exports/weekly/generate")
async def gen_weekly(b: dict, user: dict = Depends(require_role("manager"))):
    wk = str(b.get("week") or "")
    if not wk:
        wk = week_bounds(date_cls.fromisoformat(prague_date()) - timedelta(days=7))[0].isoformat()
    try:
        date_cls.fromisoformat(wk)
    except ValueError:
        raise HTTPException(status_code=400, detail="Neplatný týden.")
    return await generate_week(wk, user["name"])


@router.get("/exports/weekly/{week}/{fmt}")
async def get_weekly(week: str, fmt: str, user: dict = Depends(require_role("manager"))):
    doc = await db.weekly_exports.find_one({"week": week}, {"_id": 0})
    if not doc or fmt not in doc["files"]:
        raise HTTPException(status_code=404, detail="Export nenalezen.")
    data, ct = get_object(doc["files"][fmt]["path"])
    mt = {"pdf": "application/pdf", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "csv": "text/csv; charset=utf-8"}[fmt]
    return Response(content=data, media_type=mt, headers={"Content-Disposition": f'attachment; filename="DEMSTAV_sichtovnice_tyden_{week}.{fmt}"'})


async def _cron_weekly_job(run_id: str):
    try:
        wk = week_bounds(date_cls.fromisoformat(prague_date()) - timedelta(days=7))[0].isoformat()
        await generate_week(wk, "automaticky (týdenní plán)")
        await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"status": "done", "week": wk, "finished_at": iso_now()}})
    except Exception as e:  # noqa: BLE001
        log.exception("weekly export failed")
        await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"status": "failed", "error": str(e)[:500]}})


@router.post("/cron/weekly-exports")
async def cron_weekly(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("Authorization", "")
    if not secret or not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if body is not None and not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="invalid body")
    run_id = request.headers.get("X-Webhook-Id") or (body or {}).get("run_id") or iso_now()
    if await db.cron_runs.find_one({"run_id": run_id}):
        return {"status": "duplicate"}
    await db.cron_runs.insert_one({"run_id": run_id, "job": "weekly-exports", "status": "queued", "at": iso_now()})
    background.add_task(_cron_weekly_job, run_id)
    return {"status": "accepted"}
