import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Info } from "lucide-react";
import { useAuth, atLeast } from "@/lib/auth";
import { useCached, mergedRecords } from "@/lib/data";
import { useSync } from "@/lib/sync";
import { AttendanceActions, useShiftState } from "@/components/AttendanceActions";
import { StatusBadge } from "@/components/StatusBadge";
import { WeatherWidget } from "@/components/WeatherWidget";
import { pragueDate, STATE_LABELS, timeOf, KIND_LABELS } from "@/lib/format";
import { pracovniPozdrav } from "@/lib/greeting";
import { useLanguage } from "@/lib/language";
import { timeBreakdown, dayUnion, fmtHM, fmtH } from "@/lib/worktime";

const STATE_CLS = { away: "bg-slate-200 text-slate-900", working: "bg-emerald-600 text-white", break: "bg-amber-400 text-slate-900" };

export default function Today() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const s = useSync();
  const att = useCached("/attendance/me?days=2");
  const wps = useCached("/workplaces");
  const productionSettings = useCached("/production/settings");
  const productionAssigned = atLeast(user, "manager") || (productionSettings.data?.responsible_ids || []).includes(user.id);
  const recs = useCached("/records?mine=1&limit=60");
  const today = pragueDate();
  const { state, pending } = useShiftState(att.data?.projection?.state);
  const todays = useMemo(() => mergedRecords(recs.data, s.records).filter((x) => x.record.date === today), [recs.data, s.records, today]);
  const dailyTotal = dayUnion(todays.map(x => x.record));
  const ts = { t: dailyTotal.totalHours, s: dailyTotal.serviceHours };
  const net = att.data?.today_projection?.netHours || 0;
  const lastEvents = (att.data?.events || []).filter((e) => (e.effective_at || "").startsWith(today) || pragueDate(new Date(e.effective_at)) === today).slice(0, 6);
  // Pracoviště, kde zaměstnanec aktuálně je, dostává přednost při vykreslení počasí.
  const currentWorkplaceId = att.data?.projection?.workplace_id || "";

  const [sharedAnswer, setSharedAnswer] = useState(() => localStorage.getItem(`demstav:shared:${user?.id}:${today}`) || "");
  const markNo = () => { localStorage.setItem(`demstav:shared:${user?.id}:${today}`, "no"); setSharedAnswer("no"); };
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-600">{new Date().toLocaleDateString(language === "uk" ? "uk-UA" : "cs-CZ", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Prague" })}</p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900" data-testid="today-greeting">{language === "uk" ? `Вітаємо, ${user?.name || ""}!` : pracovniPozdrav(user?.name)}</h1>
      </div>
      <WeatherWidget workplaces={wps.data} preferredWorkplaceId={currentWorkplaceId} />
      <Link to="/zapis/novy" className="flex min-h-[92px] items-center justify-between gap-3 rounded-2xl border-2 border-[#E6BD00] bg-[#FFD200] px-4 py-3 text-slate-900 shadow-sm hover:bg-[#FFC400]" data-testid="today-new-record-button">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#0B0F14] text-[#FFD200]"><Plus className="h-9 w-9" /></div>
          <div><div className="font-heading text-lg font-black sm:text-xl">{t("Nový denní zápis")}</div><p className="text-xs text-slate-800 sm:text-sm">{t("Stroj · práce · motohodiny · šichtovnice")}</p></div>
        </div>
        <span className="shrink-0 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-center text-xs font-semibold" data-testid="today-records-count"><b className="block font-heading text-2xl tabular-nums">{todays.length}</b>{t("zápisů dnes")}</span>
      </Link>

      <section className="space-y-3 rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm" data-testid="today-attendance-primary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t("Docházka")}</p>
            <div className={`mt-1 inline-flex rounded-lg px-3 py-1.5 font-heading text-lg font-semibold ${STATE_CLS[state]}`} data-testid="today-shift-state">{t(STATE_LABELS[state])}</div>
            {pending.length > 0 && <p className="mt-1 text-xs text-amber-800">{t("Čeká na server:")} {pending.length} {t("událostí")}</p>}
          </div>
          <div className="text-right"><p className="text-xs font-semibold text-slate-600">{t("Čistá doba dnes")}</p><p className="font-heading text-3xl font-bold tabular-nums" data-testid="today-hours-total">{fmtHM(net)}</p></div>
        </div>
        <AttendanceActions workplaces={wps.data} serverState={att.data?.projection?.state} onDone={() => att.reload()} />
        {lastEvents.length > 0 && <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" data-testid="today-attendance-info"><summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-700"><Info className="h-4 w-4 text-sky-700" />{t("Poslední události docházky")}</summary><div className="space-y-1 border-t pt-2">{lastEvents.slice(0, 2).map((e) =>
          <div key={e.id} className="flex justify-between gap-2 text-sm"><span>{timeOf(e.effective_at)} · {t(KIND_LABELS[e.kind])}</span><StatusBadge status={e.status} /></div>
         )}</div></details>}
      </section>
      {productionAssigned && <section className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="today-shared-report">
        <p className="text-sm font-semibold">{t("Po směně: společný výkaz práce a tonáže")}</p>
        <p className="text-xs text-slate-600">{t("Jen pověřený zaměstnanec vyplňuje společný výkaz a vážní lístky.")}</p>
        <div className="mt-2 flex gap-2">
          <Link to="/vykazy-vazeni" onClick={() => { localStorage.setItem(`demstav:shared:${user?.id}:${today}`, "yes"); setSharedAnswer("yes"); }}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-lg border-2 text-sm font-bold ${sharedAnswer === "yes" ? "border-emerald-600 bg-emerald-100" : "border-slate-300 bg-white"}`} data-testid="shared-report-yes">{t("ANO · otevřít výkaz")}</Link>
          <button type="button" onClick={markNo} className={`min-h-11 flex-1 rounded-lg border-2 text-sm font-bold ${sharedAnswer === "no" ? "border-slate-600 bg-slate-200" : "border-slate-300 bg-white"}`} data-testid="shared-report-no">{t("NE")}</button>
        </div>
      </section>}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-heading text-lg font-bold">{t("Dnešní zápisy")}</h2><span className="text-sm text-slate-600">{fmtH(ts.t)} h · servis {fmtH(ts.s)} h</span></div>
        {todays.length === 0 && <p className="text-sm text-slate-600" data-testid="today-no-records">{t("Zatím žádný zápis.")}</p>}
        <div className="space-y-2">{todays.map((x) => <Link key={x.record.id} to={`/zapis/${x.record.id}`} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-3" data-testid="today-record-item">
          <div><div className="font-semibold">{x.record.machine || t("Bez stroje")}</div><div className="text-xs text-slate-600">{x.record.site} · {fmtH(timeBreakdown(x.record).totalHours)} h</div></div><StatusBadge status={x.state} />
        </Link>)}</div>
        {state === "away" && net > 0 && !todays.length && <p className="mt-2 text-sm text-amber-800" data-testid="today-missing-timesheet">{t("Máte docházku bez zápisu šichtovnice.")}</p>}
      </section>

    </div>
  );
}
