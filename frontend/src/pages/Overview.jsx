import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Users, FileWarning, ShieldAlert, OctagonAlert, Scale } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/Section";
import { ServiceAlerts } from "@/components/ServiceAlerts";
import { StatusBadge } from "@/components/StatusBadge";
import { useCached } from "@/lib/data";
import { pragueDate, dmy, STATE_LABELS, timeOf } from "@/lib/format";
import { fmtH } from "@/lib/worktime";

function Card({ title, icon: I, value, tone = "slate", children, testid, to }) {
  const tones = { slate: "border-slate-200", amber: "border-amber-300", red: "border-black", blue: "border-blue-200" };
  const body = (
    <div className={`h-full rounded-xl border-2 bg-white p-4 shadow-sm ${tones[tone]}`} data-testid={testid}>
      <div className="flex items-center justify-between"><div className="flex items-center gap-2 font-heading font-semibold"><I className="h-5 w-5" />{title}</div><div className="font-heading text-3xl font-bold" data-testid={`${testid}-value`}>{value}</div></div>
      <div className="mt-3 space-y-1.5 text-sm">{children}</div>
    </div>);
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

export default function Overview() {
  const [day, setDay] = useState(pragueDate());
  const o = useCached(`/overview?date=${day}&days=7`);
  const d = o.data;
  return (
    <div className="space-y-5">
      <PageHeader title="Přehled vedení" subtitle="Zápisy a docházka zaměstnanců po přijetí serverem – bez ručního posílání PDF."
        actions={<Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-11 w-44" data-testid="overview-date-input" />} />
      {o.fromCache && <p className="text-xs font-medium text-amber-800">Offline – poslední stažený stav.</p>}
      {!d ? <p className="text-slate-600">Načítám…</p> : (<>
        {(d.service_alerts || []).length > 0 && <ServiceAlerts alerts={d.service_alerts} />}
        {d.pending_leave > 0 && <Link to="/nepritomnost" className="flex items-center justify-between rounded-xl border-2 border-[#E6BD00] bg-amber-50 p-4 font-semibold text-amber-950 hover:bg-amber-100" data-testid="manager-pending-leave">Žádosti o dovolenou / nepřítomnost ke schválení: {d.pending_leave}<span className="underline">Otevřít →</span></Link>}
        {(d.upcoming_exceptions || []).length > 0 && (
          <Link to="/nepritomnost" className="block rounded-xl border-2 border-slate-300 bg-slate-50 p-4 hover:bg-slate-100" data-testid="manager-upcoming-exceptions">
            <div className="mb-1 font-heading text-sm font-semibold uppercase tracking-wide text-slate-700">Nahlášené plánované výjimky (nejbližší týden)</div>
            <ul className="space-y-0.5 text-sm text-slate-900">
              {d.upcoming_exceptions.slice(0, 8).map((e) => (
                <li key={e.id}><b>{e.user_name}</b> · {dmy(e.date)} · {e.kind_label}{e.time_from && ` · od ${e.time_from}`}{e.time_to && ` · do ${e.time_to}`} — {e.reason}</li>
              ))}
            </ul>
          </Link>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Přítomní teď" icon={Users} value={d.present.length} testid="manager-present-now-card">
            {d.present.length === 0 && <div className="text-slate-600">Nikdo nemá otevřenou směnu.</div>}
            {d.present.slice(0, 6).map((p) => <div key={p.id} className="flex justify-between"><span className="font-medium">{p.name}</span><span className="text-slate-600">{STATE_LABELS[p.state]} · {p.workplace} · od {timeOf(p.since)}</span></div>)}
          </Card>
          <Card title="Chybí šichtovnice" icon={FileWarning} value={d.missing.length + d.open_drafts.length} tone={d.missing.length ? "amber" : "slate"} testid="manager-missing-timesheets-card">
            {d.missing.slice(0, 5).map((m, i) => <div key={i} className="flex justify-between"><span className="font-medium">{m.name}</span><span className="text-slate-600">{dmy(m.date)} · docházka {fmtH(m.attendance_net)} h</span></div>)}
            {d.open_drafts.slice(0, 4).map((r) => <Link key={r.id} to={`/detail/${r.id}`} className="flex justify-between hover:underline"><span className="font-medium">{r.owner_name}</span><span className="text-slate-600">nepotvrzený koncept {dmy(r.date)}</span></Link>)}
            {d.missing.length + d.open_drafts.length === 0 && <div className="text-slate-600">Vše doplněno.</div>}
          </Card>
          <Card title="Výjimky ke schválení" icon={ShieldAlert} value={d.pending_events + d.pending_requests} tone={d.pending_events + d.pending_requests ? "amber" : "slate"} testid="manager-pending-card" to="/kontrola">
            <div className="text-slate-700">Události docházky: <b>{d.pending_events}</b></div><div className="text-slate-700">Žádosti o opravu: <b>{d.pending_requests}</b></div><div className="font-semibold text-slate-900 underline">Otevřít kontrolu →</div>
          </Card>
          <Card title="Otevřené závady" icon={OctagonAlert} value={d.faults.length} tone={d.faults.some((f) => f.severity === "stop") ? "red" : "slate"} testid="manager-stop-faults-card">
            {d.faults.length === 0 && <div className="text-slate-600">Žádná neodstraněná závada.</div>}
            {d.faults.slice(0, 5).map((f) => <Link key={f.record_id + f.id} to={`/detail/${f.record_id}`} className="flex items-start gap-2 hover:underline" data-testid="manager-fault-item">{f.severity === "stop" && <StatusBadge status="stop" />}<span><b>{f.machine}</b> – {f.description} <span className="text-slate-600">({f.employee}, {dmy(f.date)})</span></span></Link>)}
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-3" data-testid="manager-comparison-table">
            <div className="mb-3 flex items-center gap-2 font-heading font-semibold"><Scale className="h-5 w-5" />Docházka vs. šichtovnice · {dmy(day)}</div>
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Zaměstnanec</TableHead><TableHead className="text-right">Docházka čistá</TableHead><TableHead className="text-right">Výkaz celkem</TableHead><TableHead className="text-right">Servis</TableHead><TableHead className="text-right">Prostoje</TableHead><TableHead className="text-right">Rozdíl</TableHead></TableRow></TableHeader>
              <TableBody>{d.comparison.length === 0 && <TableRow><TableCell colSpan={6} className="text-slate-600">Pro tento den nejsou data.</TableCell></TableRow>}
                {d.comparison.map((c) => { const diff = c.timesheet_total - c.attendance_net; return (
                  <TableRow key={c.id} data-testid="manager-comparison-row"><TableCell className="font-medium">{c.name}{c.drafts ? <span className="ml-2 text-xs text-amber-800">({c.drafts} koncept)</span> : null}{c.overlap > 0 && <div className="text-xs text-orange-800">překryv zápisů {fmtH(c.overlap)} h – započteno jednou</div>}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtH(c.attendance_net)} h</TableCell><TableCell className="text-right tabular-nums">{fmtH(c.timesheet_total)} h</TableCell><TableCell className="text-right tabular-nums">{fmtH(c.service)} h</TableCell><TableCell className="text-right tabular-nums">{fmtH(c.downtime)} h</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${Math.abs(diff) > 0.5 ? "text-red-700" : "text-emerald-800"}`}>{diff > 0 ? "+" : ""}{fmtH(diff)} h</TableCell></TableRow>); })}</TableBody></Table></div>
            <p className="mt-2 text-xs text-slate-600">Přítomnost na pracovišti není totéž co evidence pracovní doby; rozdíl nad 0,5 h je zvýrazněn ke kontrole. Docházkový přehled není úplným mzdovým podkladem.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
            <div className="mb-3 font-heading font-semibold">Posledních 7 dní (hodiny všech zaměstnanců)</div>
            <div className="h-64" data-testid="manager-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={d.chart.map((c) => ({ ...c, den: dmy(c.date).slice(0, 6) }))}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="den" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
              <Bar dataKey="attendance" name="Docházka" fill="#0B0F14" radius={[4, 4, 0, 0]} /><Bar dataKey="timesheet" name="Šichtovnice" fill="#FFD200" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </div>
        </div>
      </>)}
    </div>
  );
}
