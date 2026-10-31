// Attendance is a suggested employee shift, never evidence of machine running time.
const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function local(at) {
  if (!at || !Number.isFinite(Date.parse(at))) return null;
  const p = Object.fromEntries(parts.formatToParts(new Date(at)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function attendanceSuggestion(events, record, userId, records = []) {
  if (!record || !userId || (record.owner_id && record.owner_id !== userId)) return { intervals: [], reason: 'owner' };
  if (record.status === 'confirmed') return { intervals: [], reason: 'filled' };
  if (records.some(r => r.id !== record.id && r.date === record.date && (!r.owner_id || r.owner_id === userId) && (r.billing || []).some(x => x.start || x.end))) return { intervals: [], reason: 'multiple' };
  const day = (events || []).filter(e => e.employee_id === userId && local(e.effective_at)?.date === record.date && e.status !== 'rejected')
    .sort((a, b) => Date.parse(a.effective_at) - Date.parse(b.effective_at) || (a.sequence || 0) - (b.sequence || 0));
  if (!day.length) return { intervals: [], reason: 'missing' };
  if (day.some(e => !['verified', 'approved'].includes(e.status))) return { intervals: [], reason: 'unverified' };
  let start = null, travelling = false;
  const intervals = [];
  for (const e of day) {
    const time = local(e.effective_at).time;
    if (e.kind === 'arrival') {
      if (start && !travelling) return { intervals: [], reason: 'sequence' };
      if (!start) start = time;
      travelling = false;
    } else if (e.kind === 'departure') {
      if (!start || time <= start) return { intervals: [], reason: 'sequence' };
      intervals.push({ start, end: time }); start = null; travelling = false;
    } else if (e.kind === 'travel_start') {
      if (!start) return { intervals: [], reason: 'sequence' };
      travelling = true;
    } else if (!start) return { intervals: [], reason: 'sequence' };
  }
  const open = !!start;
  if (start) intervals.push({ start, end: '' });
  const entered = (record.billing || []).filter(x => x.start || x.end);
  // A second click may complete a matching start; it never replaces a changed time.
  if (entered.length && (entered.length !== intervals.length || entered.some((x,i) => x.start !== intervals[i].start || (x.end && x.end !== intervals[i].end)) || !entered.some((x,i) => !x.end && intervals[i].end))) return { intervals: [], reason: 'filled' };
  const first = day.find(e => e.kind === 'arrival');
  return { intervals, workplaceId: first?.workplace_id || '', site: first?.workplace_name || '', reason: open ? 'open' : '' };
}
export function recurringWork(records, record, userId) {
  if (!record?.machine) return [];
  const counts = new Map();
  for (const r of records || []) {
    if (r.id === record.id || r.machine !== record.machine || r.date > record.date || r.status !== 'confirmed' || (r.owner_id && r.owner_id !== userId)) continue;
    const work = r.work?.trim();
    if (work) counts.set(work, (counts.get(work) || 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]).map(([work]) => work);
  return [...new Set([...ranked, 'Obsluha linky', 'Odvoz od třídiče'])].slice(0, 6);
}
