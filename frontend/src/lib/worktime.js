// Port of lib/work-time.ts – identical rules to backend worktime.py.
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const m = (v) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
function raw(i) {
  if (!i || !TIME.test(i.start || "") || !TIME.test(i.end || "") || i.start === i.end) return null;
  const a = m(i.start); let b = m(i.end); if (b < a) b += 1440; return [a, b];
}
function merge(vals) {
  const res = [];
  for (const v of [...vals].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const last = res[res.length - 1];
    if (last && v[0] <= last[1]) last[1] = Math.max(last[1], v[1]); else res.push([...v]);
  }
  return res;
}
const len = (vals) => vals.reduce((s, [a, b]) => s + b - a, 0);
function workSpans(intervals) {
  const vals = (intervals || []).map(raw).filter(Boolean);
  const ov = vals.filter(([a, b]) => a > 0 && b >= 1440).map(([a]) => a);
  const anchor = ov.length ? Math.min(...ov) : 0;
  return merge(vals.map(([a, b]) => (ov.length && b <= anchor ? [a + 1440, b + 1440] : [a, b])));
}
function serviceSpans(intervals, work) {
  const res = [];
  for (const i of intervals || []) {
    const span = raw(i); if (!span) continue;
    if (!work.length) { res.push(span); continue; }
    let sel = span, best = -1, bd = Infinity;
    for (const off of [0, 1440]) {
      const c = [span[0] + off, span[1] + off];
      const ovl = work.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, c[1]) - Math.max(a, c[0])), 0);
      const dist = Math.min(...work.map(([a, b]) => Math.max(0, a - c[1], c[0] - b)));
      if (ovl > best || (ovl === best && dist < bd)) { sel = c; best = ovl; bd = dist; }
    }
    res.push(sel);
  }
  return merge(res);
}
function subtract(work, cut) {
  return work.flatMap(([s, e]) => {
    let parts = [[s, e]];
    for (const [a, b] of cut) parts = parts.flatMap(([c, d]) => (b <= c || a >= d ? [[c, d]] : [...(a > c ? [[c, Math.min(a, d)]] : []), ...(b < d ? [[Math.max(b, c), d]] : [])]));
    return parts;
  });
}
const inter = (a, b) => merge(a.flatMap(([s, e]) => b.flatMap(([c, d]) => (Math.max(s, c) < Math.min(e, d) ? [[Math.max(s, c), Math.min(e, d)]] : []))));
const clock = (v) => { const t = ((v % 1440) + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
const asIv = (sp) => sp.map(([a, b]) => ({ start: clock(a), end: clock(b) }));

export function timeBreakdown(r) {
  const shift = (r.workTimeMode || "shift") === "shift";
  const whole = workSpans(r.billing), service = serviceSpans(r.service, whole);
  const total = shift ? whole : merge([...whole, ...service]);
  const effService = shift ? inter(service, whole) : service;
  const downAll = serviceSpans(r.downtime || [], whole);
  const downtime = shift ? merge(subtract(inter(downAll, whole), effService)) : [];
  const productive = shift ? merge(subtract(whole, merge([...service, ...downtime]))) : whole;
  return {
    totalHours: len(total) / 60, workHours: len(productive) / 60, serviceHours: len(effService) / 60, downtimeHours: len(downtime) / 60,
    totalIntervals: asIv(total), workIntervals: asIv(productive), serviceIntervals: asIv(effService), downtimeIntervals: asIv(downtime),
    serviceOutsideShift: shift && len(subtract(service, whole)) > 0, downtimeOutsideShift: shift && len(subtract(downAll, whole)) > 0,
    ambiguousDay: total.length > 0 && total[total.length - 1][1] - total[0][0] >= 1440,
  };
}

export const fmtH = (h) => (Math.round((h || 0) * 100) / 100).toString().replace(".", ",");
export const fmtHM = (h) => { const mins = Math.round((h || 0) * 60); return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`; };
