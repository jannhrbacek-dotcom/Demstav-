"""Conservative extraction of labeled fields from a photographed machine diary.

OCR is a proposal only: this module never writes a timesheet or infers a missing value.
"""
import re
from datetime import date

LABELS = {
    "date": "Datum",
    "machine": "Stroj",
    "site": "Pracoviště",
    "work": "Provedená práce",
    "mthStart": "MTH začátek",
    "mthEnd": "MTH konec",
    "start": "Začátek směny",
    "end": "Konec směny",
}

def _search(lines, patterns):
    for line in lines:
        for pat in patterns:
            match = re.search(pat, line, re.IGNORECASE)
            if match:
                return match.group(1).strip(" :;.-")
    return ""

def _date(value):
    parts = re.match(r"^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$", value)
    if parts:
        try:
            return date(int(parts[3]), int(parts[2]), int(parts[1])).isoformat()
        except ValueError:
            pass
    if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError:
            pass
    return ""

def _mth(value):
    if not re.fullmatch(r"\d{1,6}(?:[.,]\d{1,2})?", value):
        return ""
    return value.replace(",", ".")

def extract_fields(text: str) -> list:
    lines = [re.sub(r"\s+", " ", v).strip() for v in text.splitlines() if v.strip()]
    found = {}
    day = _search(lines, [r"\bDatum\s*[:=]\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})",
                           r"\bDatum\s*[:=]\s*(\d{4}-\d{2}-\d{2})"])
    if _date(day):
        found["date"] = _date(day)
    machine = _search(lines, [r"\b(?:Stroj|Mechanismus)\s*[:=]\s*([\w\s./-]{2,32})"])
    if machine:
        found["machine"] = machine[:32]
    site = _search(lines, [r"\b(?:Pracoviště|Stavba)\s*[:=]\s*(.{2,80})"])
    if site:
        found["site"] = site[:80]
    work = _search(lines, [r"\b(?:Popis práce|Provedená práce|Činnost)\s*[:=]\s*(.{3,240})"])
    if work:
        found["work"] = work[:240]
    begin = _search(lines, [r"\b(?:MTH\s*(?:začátek|od|počáteční)|Počáteční\s*(?:stav\s*)?MTH)\s*[:=]\s*(\d{1,6}(?:[.,]\d{1,2})?)"])
    finish = _search(lines, [r"\b(?:MTH\s*(?:konec|do|koncový)|Konečný\s*(?:stav\s*)?MTH)\s*[:=]\s*(\d{1,6}(?:[.,]\d{1,2})?)"])
    if _mth(begin):
        found["mthStart"] = _mth(begin)
    if _mth(finish):
        found["mthEnd"] = _mth(finish)
    start = _search(lines, [r"\b(?:Směna\s*od|Práce\s*od|Začátek\s*směny)\s*[:=]\s*([0-2]?\d:[0-5]\d)"])
    end = _search(lines, [r"\b(?:Směna\s*do|Práce\s*do|Konec\s*směny)\s*[:=]\s*([0-2]?\d:[0-5]\d)"])
    for key, val in [("start", start), ("end", end)]:
        if re.fullmatch(r"(?:[01]?\d|2[0-3]):[0-5]\d", val):
            found[key] = val.zfill(5)
    return [{"key": k, "label": LABELS[k], "value": found[k]} for k in LABELS if k in found]
