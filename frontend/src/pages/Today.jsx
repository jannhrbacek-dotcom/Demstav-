import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, CloudUpload, ClipboardList, Clock3, FileDown, CalendarDays, BarChart3 } from "lucide-react";
import { useAuth, atLeast } from "@/lib/auth";
import { useCached, mergedRecords } from "@/lib/data";
import { useSync } from "@/lib/sync";
import { AttendanceActions, useShiftState } from "@/components/AttendanceActions";
import { StatusBadge } from "@/components/StatusBadge";
import { ServiceAlerts } from "@/components/ServiceAlerts";
import { WeatherWidget } from "@/components/WeatherWidget";
import { pragueDate, STATE_LABELS, timeOf, KIND_LABELS } from "@/lib/format";
import { pracovniPozdrav } from "@/lib/greeting";
import { timeBreakdown, fmtHM, fmtH } from "@/lib/worktime";

const STATE_CLS = { away: "bg-slate-200 text-slate-900", working: "bg-emerald-600 text-white", break: "bg-amber-400 text-slate-900" };

/** Dlaždice pro jednoduchý režim – velká, jednoznačná akce s ikonou. */
function Tile({ to, icon: I, label, hint, accent = false, testid }) {
  const base = "flex min-h-[128px] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-5 text-center shadow-sm transition-colors";
  const cls = accent
    ? "border-[#E6BD00] bg-[#FFD200] text-slate-900 hover:bg-[#FFC400]"
    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50";
  return (
    <Link to={to} data-testid={testid} className={`${base} ${cls}`}>
      <I className="h-10 w-10" strokeWidth={1.75} />
      <div className="font-heading text-lg font-bold leading-tight">{label}</div>
      {hint && <div className="text-xs text-slate-700">{hint}</div>}
    </Link>
  );
}

export default function Today() {
  const { user, simpleMode } = useAuth();
  const s = useSync();
  const att = useCached("/attendance/me?days=2");
  const wps = useCached("/workplaces");
  const productionSettings = useCached("/production/settings");
  const productionAssigned = atLeast(user, "manager") || (productionSettings.data?.responsible_ids || []).includes(user.id);
  const recs = useCached("/records?mine=1&limit=60");
  const today = pragueDate();
  const { state, pending } = useShiftState(att.data?.projection?.state);
  const todays = useMemo(() => mergedRecords(recs.data, s.records).filter((x) => x.record.date === today), [recs.data, s.records, today]);
  const ts = todays.reduce((acc, x) => { const b = timeBreakdown(x.record); return { t: acc.t + b.totalHours, s: acc.s + b.serviceHours }; }, { t: 0, s: 0 });
  const net = att.data?.today_projection?.netHours || 0;
  const lastEvents = (att.data?.events || []).filter((e) => (e.effective_at || "").startsWith(today) || pragueDate(new Date(e.effective_at)) === today).slice(0, 6);
  // Pracoviště, kde zaměstnanec aktuálně je, dostává přednost při vykreslení počasí.
  const currentWorkplaceId = att.data?.projection?.workplace_id || "";

  const [sharedAnswer, setSharedAnswer] = useState(() => localStorage.getItem(`demstav:shared:${user?.id}:${today}`) || "");
  const markNo = () => { localStorage.setItem(`demstav:shared:${user?.id}:${today}`, "no"); setSharedAnswer("no"); };
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-600">{new Date().toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Prague" })}</p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900" data-testid="today-greeting">{pracovniPozdrav(user?.name)}</h1>
      </div>
      <WeatherWidget workplaces={wps.data} preferredWorkplaceId={currentWorkplaceId} />
      <section className="space-y-3 rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm" data-testid="today-attendance-primary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Příchod / odchod</p>
            <div className={`mt-1 inline-flex rounded-lg px-3 py-1.5 font-heading text-lg font-semibold ${STATE_CLS[state]}`} data-testid="today-shift-state">{STATE_LABELS[state]}</div>
            {pending.length > 0 && <p className="mt-1 text-xs text-amber-800">Čeká na server: {pending.length} událostí</p>}
          </div>
          <div className="text-right"><p className="text-xs font-semibold text-slate-600">Čistá doba dnes</p><p className="font-heading text-3xl font-bold tabular-nums" data-testid="today-hours-total">{fmtHM(net)}</p></div>
        </div>
        <AttendanceActions workplaces={wps.data} serverState={att.data?.projection?.state} onDone={() => att.reload()} />
        {lastEvents.length > 0 && !simpleMode && <div className="space-y-1 border-t pt-2">{lastEvents.slice(0, 2).map((e) =>
          <div key={e.id} className="flex justify-between gap-2 text-sm"><span>{timeOf(e.effective_at)} · {KIND_LABELS[e.kind]}</span><StatusBadge status={e.status} /></div>
        )}</div>}
      </section>
      <Link to="/zapis/novy" className="flex min-h-[86px] items-center gap-4 rounded-xl border-2 border-[#E6BD00] bg-[#FFD200] px-5 text-slate-900 shadow-sm hover:bg-[#FFC400]" data-testid="today-new-record-button">
        <Plus className="h-9 w-9 shrink-0" /><div><div className="font-heading text-xl font-bold">Nový denní zápis</div><p className="text-sm">Stroj · práce · motohodiny · šichtovnice</p></div>
      </Link>
      {productionAssigned && <section className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="today-shared-report">
        <p className="text-sm font-semibold">Po směně: společný výkaz práce a tonáže</p>
        <p className="text-xs text-slate-600">Jen pověřený zaměstnanec vyplňuje společný výkaz a vážní lístky.</p>
        <div className="mt-2 flex gap-2">
          <Link to="/vykazy-vazeni" onClick={() => { localStorage.setItem(`demstav:shared:${user?.id}:${today}`, "yes"); setSharedAnswer("yes"); }}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-lg border-2 text-sm font-bold ${sharedAnswer === "yes" ? "border-emerald-600 bg-emerald-100" : "border-slate-300 bg-white"}`} data-testid="shared-report-yes">ANO · otevřít výkaz</Link>
          <button type="button" onClick={markNo} className={`min-h-11 flex-1 rounded-lg border-2 text-sm font-bold ${sharedAnswer === "no" ? "border-slate-600 bg-slate-200" : "border-slate-300 bg-white"}`} data-testid="shared-report-no">NE</button>
        </div>
      </section>}
      <ServiceAlerts />
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-heading text-lg font-bold">Dnešní zápisy</h2><span className="text-sm text-slate-600">{fmtH(ts.t)} h · servis {fmtH(ts.s)} h</span></div>
        {todays.length === 0 && <p className="text-sm text-slate-600" data-testid="today-no-records">Zatím žádný zápis.</p>}
        <div className="space-y-2">{todays.map((x) => <Link key={x.record.id} to={`/zapis/${x.record.id}`} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-3" data-testid="today-record-item">
          <div><div className="font-semibold">{x.record.machine || "Bez stroje"}</div><div className="text-xs text-slate-600">{x.record.site} · {fmtH(timeBreakdown(x.record).totalHours)} h</div></div><StatusBadge status={x.state} />
        </Link>)}</div>
        {state === "away" && net > 0 && !todays.length && <p className="mt-2 text-sm text-amber-800" data-testid="today-missing-timesheet">Máte docházku bez zápisu šichtovnice.</p>}
      </section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile to="/nepritomnost" icon={CalendarDays} label="Volno, nemoc a výjimky" />
        <Tile to="/kalendar" icon={Clock3} label="Kalendář týmu" />
        <Tile to="/zapisy" icon={ClipboardList} label="Moje zápisy" />
        <Tile to="/prehledy" icon={BarChart3} label="Přehledy" />
        <Tile to="/exporty" icon={FileDown} label="Exporty" />
        {s.queue.length > 0 && <Tile to="/fronta" icon={CloudUpload} label={`Fronta · ${s.queue.length}`} hint="Čeká na odeslání" testid="tile-queue" />}
      </div>
    </div>
  );
}
