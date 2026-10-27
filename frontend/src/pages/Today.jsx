import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, CloudUpload, WifiOff, AlertTriangle, ChevronRight, ClipboardList, Clock3, FileDown, CalendarDays, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCached, mergedRecords } from "@/lib/data";
import { useSync } from "@/lib/sync";
import { AttendanceActions, useShiftState } from "@/components/AttendanceActions";
import { StatusBadge } from "@/components/StatusBadge";
import { ServiceAlerts } from "@/components/ServiceAlerts";
import { WeatherWidget } from "@/components/WeatherWidget";
import { pragueDate, STATE_LABELS, timeOf, KIND_LABELS } from "@/lib/format";
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
  const recs = useCached("/records?mine=1&limit=60");
  const today = pragueDate();
  const { state, pending } = useShiftState(att.data?.projection?.state);
  const todays = useMemo(() => mergedRecords(recs.data, s.records).filter((x) => x.record.date === today), [recs.data, s.records, today]);
  const ts = todays.reduce((acc, x) => { const b = timeBreakdown(x.record); return { t: acc.t + b.totalHours, s: acc.s + b.serviceHours }; }, { t: 0, s: 0 });
  const net = att.data?.today_projection?.netHours || 0;
  const lastEvents = (att.data?.events || []).filter((e) => (e.effective_at || "").startsWith(today) || pragueDate(new Date(e.effective_at)) === today).slice(0, 6);
  // Pracoviště, kde zaměstnanec aktuálně je, dostává přednost při vykreslení počasí.
  const currentWorkplaceId = att.data?.projection?.workplace_id || "";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-600">{new Date().toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Prague" })}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-slate-900">Dobrý den, {user?.name?.split(" ")[0]}</h1>
      </div>

      {(!s.online || s.queue.length > 0) && (
        <Link to="/fronta" className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 ${!s.online ? "border-amber-400 bg-amber-50" : "border-amber-300 bg-amber-50"}`} data-testid="today-unsent-banner">
          {!s.online ? <WifiOff className="h-6 w-6 text-amber-800" /> : <CloudUpload className="h-6 w-6 text-amber-800" />}
          <div className="min-w-0 flex-1"><div className="font-semibold text-amber-950">{!s.online ? "Jste offline. Položky se odešlou automaticky po připojení." : "Některé položky ještě nejsou na serveru"}</div>
            <div className="text-sm text-amber-900">Neodeslané: <span data-testid="today-unsent-count">{s.queue.length}</span></div></div>
          <ChevronRight className="h-5 w-5 shrink-0 text-amber-800" />
        </Link>
      )}

      {/* Widget počasí – 4denní předpověď podle pracoviště (nebo polohy zařízení). */}
      <WeatherWidget workplaces={wps.data} preferredWorkplaceId={currentWorkplaceId} />

      <ServiceAlerts />
      <Link to="/vykazy-vazeni" className="block rounded-xl border bg-white p-4 hover:bg-slate-50"><div className="font-semibold">Vedete dnes společný výkaz práce a tonáže?</div><div className="text-sm text-slate-600">Pouze pověřený člen posádky: vyplnit výkaz a přiložit vážní lístky →</div></Link>

      {simpleMode ? (
        /* Jednoduchý režim – velké dlaždice, minimum textu. */
        <section className="space-y-4" data-testid="simple-dashboard">
          <h2 className="font-heading text-xl font-semibold">Co chcete udělat?</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Tile to="/dochazka" icon={Clock3} label="Docházka" hint="Příchod · pauza · odchod" accent testid="tile-attendance" />
            <Tile to="/zapis/novy" icon={Plus} label="Nový zápis" hint="Deník + šichtovnice" accent testid="tile-new-record" />
            <Tile to="/zapisy" icon={ClipboardList} label="Moje zápisy" testid="tile-records" />
            <Tile to="/fronta" icon={CloudUpload} label={`Fronta${s.queue.length ? " · " + s.queue.length : ""}`} hint={s.queue.length ? "Nejsou odeslané" : "Vše odesláno"} testid="tile-queue" />
            <Tile to="/nepritomnost" icon={CalendarDays} label="Volno · nemoc" testid="tile-absence" />
            <Tile to="/prehledy" icon={BarChart3} label="Moje přehledy" testid="tile-overview" />
            <Tile to="/exporty" icon={FileDown} label="Exporty" testid="tile-exports" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="simple-shift-card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">Stav směny</div>
              <div className={`inline-flex rounded-lg px-3 py-1.5 font-heading text-lg font-semibold ${STATE_CLS[state]}`} data-testid="today-shift-state">{STATE_LABELS[state]}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">Odpracováno</div>
              <div className="font-heading text-3xl font-bold tabular-nums text-slate-900" data-testid="today-hours-total">{fmtHM(net)}</div>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">Stav směny</div>
                <div className={`mt-1 inline-flex rounded-lg px-3 py-1.5 font-heading text-xl font-semibold ${STATE_CLS[state]}`} data-testid="today-shift-state">{STATE_LABELS[state]}</div>
                {pending.length > 0 && <div className="mt-1 text-xs font-medium text-amber-800">včetně {pending.length} událostí čekajících v telefonu</div>}
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">Přítomnost dnes (bez přestávek)</div>
                <div className="font-heading text-4xl font-bold tabular-nums text-slate-900" data-testid="today-hours-total">{fmtHM(net)}</div>
                {att.fromCache && <div className="text-xs text-slate-500">poslední známý stav serveru</div>}
              </div>
            </div>
            <AttendanceActions workplaces={wps.data} serverState={att.data?.projection?.state} onDone={() => att.reload()} />
            {lastEvents.length > 0 && <div className="space-y-1 border-t border-slate-100 pt-3">{lastEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate font-medium">{timeOf(e.effective_at)} · {KIND_LABELS[e.kind]} · {e.workplace_name}</span><StatusBadge status={e.status} /></div>))}</div>}
          </div>

          <div className="min-w-0 space-y-3 lg:col-span-2">
            <Link to="/zapis/novy" className="flex min-h-[84px] items-center gap-4 rounded-xl border-2 border-[#E6BD00] bg-[#FFD200] px-5 text-slate-900 transition-colors duration-150 hover:bg-[#FFC400]" data-testid="today-new-record-button">
              <Plus className="h-8 w-8 shrink-0" /><div className="min-w-0"><div className="font-heading text-lg font-semibold">Nový denní zápis</div><div className="text-sm">Deník stroje + šichtovnice v jednom</div></div>
            </Link>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2"><div className="font-heading font-semibold">Dnešní zápisy</div><div className="shrink-0 text-sm text-slate-600">{fmtH(ts.t)} h, servis {fmtH(ts.s)} h</div></div>
              {todays.length === 0 && <p className="text-sm text-slate-600" data-testid="today-no-records">Zatím žádný zápis. Po příchodu vyberte stroj a zapište směnu.</p>}
              <div className="space-y-2">{todays.map((x) => (
                <Link key={x.record.id} to={`/zapis/${x.record.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-3 hover:bg-slate-50" data-testid="today-record-item">
                  <div className="min-w-0"><div className="truncate font-semibold">{x.record.machine || "Bez stroje"}</div><div className="truncate text-xs text-slate-600">{x.record.site} · {fmtH(timeBreakdown(x.record).totalHours)} h</div></div>
                  <StatusBadge status={x.state} />
                </Link>))}</div>
            </div>
            {state === "away" && net > 0 && todays.length === 0 && <div className="flex items-start gap-2 rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950" data-testid="today-missing-timesheet"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Máte dnešní docházku, ale chybí zápis šichtovnice.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
