import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCached } from "@/lib/data";
import { useAuth } from "@/lib/auth";

const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const dateKey = d => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
const formatMonth = d => d.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
export default function TeamCalendar() {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const start = dateKey(month);
  const end = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const events = useCached(`/team-calendar?date_from=${start}&date_to=${end}`);
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const dayShift = (first.getDay() + 6) % 7;
    const size = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(dayShift).fill(null), ...Array.from({ length: size }, (_, i) => dateKey(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  }, [month]);
  const all = events.data || [];
  const dayEvents = day => all.filter(e => day >= e.date_from && day <= e.date_to);
  const changeMonth = n => {
    const m = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(m); setSelected(dateKey(m));
  };
  return <main className="space-y-5" data-testid="team-calendar">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="font-heading text-2xl font-bold">Kalendář týmu</h1>
        <p className="text-sm text-slate-600">Společný plán příchodů, odchodů a schváleného volna. Přístupný všem zaměstnancům.</p></div>
      <Link to="/nepritomnost" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#FFD200] px-4 font-semibold text-slate-900"><Plus className="h-5 w-5" />Oznámit změnu</Link>
    </div>
    <section className="rounded-xl border bg-white p-3 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Předchozí měsíc" className="flex h-12 w-12 items-center justify-center rounded-lg border"><ChevronLeft /></button>
        <h2 className="font-heading text-xl font-bold capitalize">{formatMonth(month)}</h2>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Následující měsíc" className="flex h-12 w-12 items-center justify-center rounded-lg border"><ChevronRight /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold">{DAYS.map(d => <div key={d} className="py-2">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">{cells.map((d, i) => d ?
        <button type="button" key={d} aria-pressed={selected === d} data-testid={`calendar-day-${d}`}
          onClick={() => setSelected(d)} className={`relative min-h-[56px] rounded-lg border text-sm font-semibold sm:min-h-[76px] ${selected === d ? "border-slate-900 bg-[#FFD200]" : "border-slate-200 bg-slate-50"}`}>
          <span>{Number(d.slice(-2))}</span>
          {dayEvents(d).length > 0 && <span className="mx-auto mt-1 block w-fit rounded-full bg-slate-900 px-1.5 text-[10px] text-white" aria-label={`${dayEvents(d).length} událostí`}>{dayEvents(d).length}</span>}
        </button> : <div key={`blank-${i}`} />)}
      </div>
    </section>
    <section className="rounded-xl border bg-white p-4 shadow-sm" data-testid="calendar-day-events">
      <h2 className="mb-3 font-heading text-lg font-bold">Plán na {selected.split("-").reverse().join(". ")}</h2>
      {events.loading && <p>Načítám kalendář…</p>}
      {events.error && <p role="alert" className="text-red-700">Kalendář není dostupný. Zkontrolujte připojení.</p>}
      {!events.loading && !dayEvents(selected).length && <p className="text-sm text-slate-600">Pro tento den nejsou oznámené změny.</p>}
      <div className="space-y-2">{dayEvents(selected).map(e => <article key={e.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="font-semibold">{e.user_name} · {e.title} {e.user_id === user?.id && <span className="text-xs text-slate-500">(moje)</span>}</div>
        {(e.time_from || e.time_to) && <div className="text-sm">Čas: {e.time_from || "?"}{e.time_to ? " až " + e.time_to : ""}</div>}
        {e.note && <div className="text-sm text-slate-700">{e.note}</div>}
      </article>)}</div>
    </section>
    <p className="text-xs text-slate-600">Plánované výjimky jsou oznámení, ne potvrzení docházky. Důvod vidí kolegové jen po výslovném sdílení.</p>
  </main>;
}
