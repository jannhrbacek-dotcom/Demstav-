"""Personal journey is a duration, never an additional working-hours category.
Legacy integer values are preserved but are not interpreted as minutes.
"""
import re


def duration_minutes(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{1,2}:[0-5]\d", value):
        return None
    hours, minutes = map(int, value.split(":"))
    total = hours * 60 + minutes
    return total if total <= 1440 else None


def journey_text(record):
    value = record.get("driveMinutes")
    if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 1440:
        return f"{value // 60}:{value % 60:02d}"
    raw = str(record.get("drive") or "")
    value = duration_minutes(raw)
    if value is not None:
        return f"{value // 60}:{value % 60:02d}"
    return "neověřeno" if raw else ""
