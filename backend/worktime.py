"""Port of lib/work-time.ts (DEMSTAV OPERATIONS).

Shift mode: `billing` stores the complete work period. Service inside the shift is part of
work time (never added twice). Downtime is a separate category; the part overlapping
service is assigned to service. productive (other work) = whole - service - downtime.
"""
import re
from math import inf

TIME = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def _m(v: str) -> int:
    return int(v[:2]) * 60 + int(v[3:])


def _raw(i):
    if not isinstance(i, dict):
        return None
    s, e = i.get("start") or "", i.get("end") or ""
    if not TIME.match(s) or not TIME.match(e) or s == e:
        return None
    a, b = _m(s), _m(e)
    if b < a:
        b += 1440
    return [a, b]


def merge(vals):
    res = []
    for v in sorted(vals, key=lambda x: (x[0], x[1])):
        if res and v[0] <= res[-1][1]:
            res[-1][1] = max(res[-1][1], v[1])
        else:
            res.append([v[0], v[1]])
    return res


def length(vals) -> int:
    return sum(b - a for a, b in vals)


def work_spans(intervals):
    vals = [s for s in (_raw(i) for i in intervals or []) if s]
    ov = [a for a, b in vals if a > 0 and b >= 1440]
    anchor = min(ov) if ov else 0
    return merge([[a + 1440, b + 1440] if ov and b <= anchor else [a, b] for a, b in vals])


def service_spans(intervals, work):
    res = []
    for i in intervals or []:
        span = _raw(i)
        if not span:
            continue
        if not work:
            res.append(span)
            continue
        sel, best, bd = span, -1, inf
        for off in (0, 1440):
            c = [span[0] + off, span[1] + off]
            ovl = sum(max(0, min(e, c[1]) - max(s, c[0])) for s, e in work)
            dist = min(max(0, s - c[1], c[0] - e) for s, e in work)
            if ovl > best or (ovl == best and dist < bd):
                sel, best, bd = c, ovl, dist
        res.append(sel)
    return merge(res)


def subtract(work, cut):
    out = []
    for s, e in work:
        parts = [[s, e]]
        for a, b in cut:
            nxt = []
            for c, d in parts:
                if b <= c or a >= d:
                    nxt.append([c, d])
                else:
                    if a > c:
                        nxt.append([c, min(a, d)])
                    if b < d:
                        nxt.append([max(b, c), d])
            parts = nxt
        out += parts
    return out


def intersection(a, b):
    return merge([[max(s, c), min(e, d)] for s, e in a for c, d in b if max(s, c) < min(e, d)])


def clock(v: int) -> str:
    t = ((v % 1440) + 1440) % 1440
    return f"{t // 60:02d}:{t % 60:02d}"


def as_intervals(spans):
    return [{"start": clock(a), "end": clock(b)} for a, b in spans]


def spans_detail(record: dict):
    shift = record.get("workTimeMode", "shift") == "shift"
    whole = work_spans(record.get("billing") or [])
    service = service_spans(record.get("service") or [], whole)
    total = whole if shift else merge(whole + service)
    eff_service = intersection(service, whole) if shift else service
    down_all = service_spans(record.get("downtime") or [], whole)
    downtime = subtract(intersection(down_all, whole), eff_service) if shift else []
    # Přejezd mezi zakázkami (A → B): je součástí pracovní doby, ale nefakturuje se zákazníkovi.
    travel_all = service_spans(record.get("travel") or [], whole)
    travel = subtract(intersection(travel_all, whole), merge(eff_service + downtime)) if shift else []
    productive = subtract(whole, merge(service + downtime + travel)) if shift else whole
    return {"total": total, "service": eff_service, "downtime": merge(downtime), "productive": merge(productive), "travel": merge(travel),
            "travel_outside": shift and length(subtract(travel_all, whole)) > 0,
            "service_outside": shift and length(subtract(service, whole)) > 0,
            "downtime_outside": shift and length(subtract(down_all, whole)) > 0}


def time_breakdown(record: dict) -> dict:
    d = spans_detail(record)
    total = d["total"]
    ambiguous = bool(total) and total[-1][1] - total[0][0] >= 1440
    return {
        "totalHours": length(total) / 60, "workHours": length(d["productive"]) / 60,
        "serviceHours": length(d["service"]) / 60, "downtimeHours": length(d["downtime"]) / 60,
        "totalIntervals": as_intervals(total), "workIntervals": as_intervals(d["productive"]),
        "serviceIntervals": as_intervals(d["service"]), "downtimeIntervals": as_intervals(d["downtime"]),
        "travelHours": length(d["travel"]) / 60, "travelIntervals": as_intervals(d["travel"]),
        "billableHours": (length(total) - length(d["travel"])) / 60, "travelOutsideShift": d["travel_outside"],
        "serviceOutsideShift": d["service_outside"], "downtimeOutsideShift": d["downtime_outside"],
        "ambiguousDay": ambiguous,
    }


def day_union(records: list) -> dict:
    """Totals for one employee and one date across several records/machines.
    The same minute is never counted twice."""
    tot, srv, dwn, trv = [], [], [], []
    for r in records:
        d = spans_detail(r)
        tot += d["total"]
        srv += d["service"]
        dwn += d["downtime"]
        trv += d["travel"]
    tot, srv = merge(tot), merge(srv)
    dwn = merge(subtract(merge(dwn), srv))
    trv = merge(subtract(merge(trv), merge(srv + dwn)))
    prod = merge(subtract(tot, merge(srv + dwn + trv)))
    raw_sum = sum(length(spans_detail(r)["total"]) for r in records)
    return {"totalHours": length(tot) / 60, "workHours": length(prod) / 60, "serviceHours": length(srv) / 60,
            "downtimeHours": length(dwn) / 60, "travelHours": length(trv) / 60, "overlapHours": (raw_sum - length(tot)) / 60}


def fmt_hours(h: float) -> str:
    s = f"{round(h + 1e-9, 2):.2f}".rstrip("0").rstrip(".")
    return s.replace(".", ",")
