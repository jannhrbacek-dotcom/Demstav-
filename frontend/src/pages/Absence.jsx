import React, { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, X, Loader2, Clock3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Field } from "@/components/Section";
import { useAuth, atLeast } from "@/lib/auth";
import { useCached } from "@/lib/data";
import { http, errText } from "@/lib/api";
import { dmy, newId, pragueDate } from "@/lib/format";
import { LEAVE_TYPES } from "@/lib/roles";
import { useLanguage } from "@/lib/language";

const TONE = { pending_manager: "bg-amber-100 text-amber-950", pending_director: "bg-amber-200 text-amber-950", approved: "bg-emerald-100 text-emerald-950", rejected: "bg-red-100 text-red-900", cancelled: "bg-slate-100 text-slate-700" };

function When({ r }) {
  if (r.type === "doctor") return <>{dmy(r.date_from)} {r.time_from}–{r.time_to}</>;
  return <>{dmy(r.date_from)}{r.date_to !== r.date_from && ` – ${dmy(r.date_to)}`}{r.half_day && " (půlden)"} · {String(r.days).replace(".", ",")} prac. dní</>;
}

function Item({ r, onDecide, onCancel, showName }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="leave-item">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{showName && <span>{r.user_name} · </span>}{r.type_label}</div>
          <div className="text-sm text-slate-700"><When r={r} /></div>
          {r.note && <div className="mt-1 text-sm text-slate-600">{r.note}</div>}
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${TONE[r.status]}`} data-testid="leave-status">{r.status_label}</span>
      </div>
      {(r.history || []).length > 1 && <ol className="mt-2 space-y-0.5 text-xs text-slate-600">{r.history.slice(1).map((h, i) => <li key={i}>{h.action === "approve" ? "Schválil(a)" : h.action === "reject" ? "Zamítl(a)" : "Zrušeno"}: {h.by_name} ({h.role}) {h.at?.slice(0, 16).replace("T", " ")}{h.note && ` – ${h.note}`}</li>)}</ol>}
      {(r.can_decide || r.can_cancel) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.can_decide && <Button className="btn-primary h-11 font-semibold" onClick={() => onDecide(r, "approve")} data-testid="leave-approve-button"><Check className="mr-1 h-4 w-4" />{r.status === "pending_manager" && r.type === "vacation" ? "Schválit (posláno jednateli)" : "Schválit"}</Button>}
          {r.can_decide && <Button variant="outline" className="h-11 text-red-700" onClick={() => onDecide(r, "reject")} data-testid="leave-reject-button"><X className="mr-1 h-4 w-4" />{t("Zamítnout")}</Button>}
          {r.can_cancel && <Button variant="outline" className="h-11" onClick={() => onCancel(r)} data-testid="leave-cancel-button">{t("Zrušit žádost")}</Button>}
        </div>
      )}
    </div>
  );
}

export default function Absence() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const mgr = atLeast(user, "manager") && user.role !== "admin";
  const mine = useCached("/leave?mine=1");
  const todo = useCached("/leave?status=to_decide", { enabled: mgr });
  const allQ = useCached("/leave", { enabled: atLeast(user, "manager") });
  const [summaryFilter, setSummaryFilter] = useState({from: pragueDate(), to: pragueDate(new Date(Date.now() + 30 * 86400000)), status: "", type: "", employee: ""});
  const summary = useCached(`/leave/overview?${new URLSearchParams({date_from: summaryFilter.from, date_to: summaryFilter.to, status: summaryFilter.status, type: summaryFilter.type, employee_id: summaryFilter.employee})}`, {enabled: atLeast(user, "manager")});
  const filter = (key, value) => setSummaryFilter(f => ({...f, [key]: value}));

  const myEx = useCached("/exceptions?mine=1");
  const allEx = useCached("/exceptions", { enabled: atLeast(user, "manager") });
  const today = pragueDate();
  const [f, setF] = useState({ type: "vacation", date_from: today, date_to: today, half_day: false, time_from: "08:00", time_to: "10:00", note: "" });
  const [busy, setBusy] = useState(false);
  const [rej, setRej] = useState(null);
  const [note, setNote] = useState("");
  const [ex, setEx] = useState({ kind: "late_arrival", date: today, time_from: "09:00", time_to: "15:00", reason: "", share_with_team: false });
  const [exBusy, setExBusy] = useState(false);
  const reload = () => { mine.reload(); todo.reload?.(); allQ.reload?.(); summary.reload?.(); };
  const reloadEx = () => { myEx.reload(); allEx.reload?.(); };
  const t = LEAVE_TYPES.find((x) => x.value === f.type);

  const submit = async () => {
    setBusy(true);
    try {
      await http.post("/leave", { ...f, id: newId(), date_to: f.type === "doctor" ? f.date_from : f.date_to });
      toast.success(f.type === "sick" ? "Nemoc ohlášena vedoucímu výroby" : "Žádost odeslána ke schválení");
      setF({ ...f, note: "" }); reload();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const decide = async (r, action, n = "") => {
    if (action === "reject" && !n) { setRej(r); return; }
    try { await http.post(`/leave/${r.id}/decision`, { action, note: n }); toast.success(action === "approve" ? "Schváleno" : "Zamítnuto"); setRej(null); setNote(""); reload(); } catch (e) { toast.error(errText(e)); }
  };
  const cancel = async (r) => { if (!window.confirm("Zrušit tuto žádost?")) return; try { await http.post(`/leave/${r.id}/cancel`); toast.success("Žádost zrušena"); reload(); } catch (e) { toast.error(errText(e)); } };
  const submitEx = async () => {
    setExBusy(true);
    try {
      const payload = { id: newId(), kind: ex.kind, date: ex.date, reason: ex.reason, share_with_team: ex.share_with_team };
      if (ex.kind === "late_arrival") payload.time_from = ex.time_from;
      else if (ex.kind === "early_departure") payload.time_to = ex.time_to;
      else { payload.time_from = ex.time_from; payload.time_to = ex.time_to; }
      await http.post("/exceptions", payload);
      toast.success("Výjimka oznámena vedení");
      setEx({ ...ex, reason: "" }); reloadEx();
    } catch (e) { toast.error(errText(e)); } finally { setExBusy(false); }
  };
  const delEx = async (r) => { if (!window.confirm("Smazat tuto výjimku?")) return; try { await http.delete(`/exceptions/${r.id}`); toast.success("Smazáno"); reloadEx(); } catch (e) { toast.error(errText(e)); } };

  return (
    <div className="space-y-5">
      <PageHeader title={t("Dovolená a nepřítomnost")} subtitle={t("Dovolenou schvaluje vedoucí výroby a pak jednatel. Neplacené volno, lékaře a nemoc schvaluje vedoucí výroby. Plánovanou výjimku (pozdě / dřív) stačí oznámit.")} />

      {mgr && (todo.data || []).length > 0 && (
        <section className="space-y-2" data-testid="leave-to-decide">
          <h2 className="font-heading text-lg font-semibold">Ke schválení ({todo.data.length})</h2>
          {todo.data.map((r) => <Item key={r.id} r={r} showName onDecide={decide} onCancel={cancel} />)}
        </section>
      )}

      {atLeast(user, "manager") && <section className="space-y-3 rounded-xl border bg-white p-4" data-testid="absence-overview">
        <h2 className="text-lg font-bold">{t("Přehled nepřítomností zaměstnanců")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Období od"><Input type="date" value={summaryFilter.from} onChange={e => filter('from', e.target.value)} /></Field>
          <Field label="Období do"><Input type="date" value={summaryFilter.to} onChange={e => filter('to', e.target.value)} /></Field>
          <Field label="Zaměstnanec"><select className="h-12 w-full rounded border px-3" value={summaryFilter.employee} onChange={e => filter('employee', e.target.value)}><option value="">{t("Všichni")}</option>{[...new Map((allQ.data || []).map(r => [r.user_id, r.user_name])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field>
          <Field label="Stav"><select className="h-12 w-full rounded border px-3" value={summaryFilter.status} onChange={e => filter('status', e.target.value)}><option value="">{t("Čekající a schválené")}</option><option value="approved">{t("Schváleno")}</option><option value="pending_manager">{t("Čeká na vedoucího")}</option><option value="pending_director">{t("Čeká na jednatele")}</option><option value="rejected">{t("Zamítnuto")}</option><option value="cancelled">{t("Zrušeno")}</option></select></Field>
          <Field label="Typ"><select className="h-12 w-full rounded border px-3" value={summaryFilter.type} onChange={e => filter('type', e.target.value)}><option value="">{t("Všechny typy")}</option>{LEAVE_TYPES.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}</select></Field>
        </div>
        {summary.loading && <p>{t("Načítám přehled…")}</p>}
        {summary.error && <p role="alert" className="text-red-700">Přehled nelze načíst. Zkontrolujte období a připojení.</p>}
        {!summary.loading && !summary.error && !(summary.data || []).length && <p>Pro zvolený filtr nejsou žádné nepřítomnosti.</p>}
        {(summary.data || []).map(a => <article key={a.id} className="rounded-lg border p-3 text-sm"><b>{a.user_name}</b> · {a.type_label}<br />{a.date_from} – {a.date_to} · <b>{a.status_label}</b>{a.half_day ? ' · půlden' : ''}</article>)}
      </section>}
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="leave-form">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><CalendarPlus className="h-5 w-5" />{t("Nová žádost")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LEAVE_TYPES.map((x) => (
            <button key={x.value} type="button" onClick={() => setF({ ...f, type: x.value })} data-testid={`leave-type-${x.value}`}
              className={`min-h-[56px] rounded-xl border-2 px-3 text-sm font-semibold transition-colors ${f.type === x.value ? "border-[#E6BD00] bg-[#FFD200] text-slate-900" : "border-slate-200 bg-white hover:bg-slate-50"}`}>{x.label}</button>
          ))}
        </div>
        <p className="text-xs text-slate-600">{t?.hint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={f.type === "doctor" ? "Datum" : "Od"}><Input type="date" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value, date_to: e.target.value > f.date_to ? e.target.value : f.date_to })} className="h-12" data-testid="leave-date-from" /></Field>
          {f.type !== "doctor" && <Field label="Do"><Input type="date" value={f.date_to} min={f.date_from} onChange={(e) => setF({ ...f, date_to: e.target.value })} className="h-12" data-testid="leave-date-to" /></Field>}
          {f.type === "doctor" && <div className="grid grid-cols-2 gap-2"><Field label="Čas od"><Input type="time" value={f.time_from} onChange={(e) => setF({ ...f, time_from: e.target.value })} className="h-12" data-testid="leave-time-from" /></Field><Field label="Čas do"><Input type="time" value={f.time_to} onChange={(e) => setF({ ...f, time_to: e.target.value })} className="h-12" data-testid="leave-time-to" /></Field></div>}
        </div>
        {["vacation", "unpaid"].includes(f.type) && f.date_from === f.date_to && <label className="flex items-center gap-3"><Switch checked={f.half_day} onCheckedChange={(v) => setF({ ...f, half_day: v })} data-testid="leave-half-day" /><span className="text-sm font-medium">Jen půlden</span></label>}
        <Field label="Poznámka (nepovinné)"><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={f.type === "sick" ? "Např. neschopenka od lékaře, předpokládaný návrat…" : ""} data-testid="leave-note" /></Field>
        <Button className="btn-primary h-14 w-full text-base font-semibold" disabled={busy} onClick={submit} data-testid="leave-submit">{busy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}{t(f.type === "sick" ? "Ohlásit nemoc" : "Odeslat žádost")}</Button>
      </section>

      <section className="space-y-2" data-testid="leave-mine">
        <h2 className="font-heading text-lg font-semibold">{t("Moje žádosti")}</h2>
        {(mine.data || []).length === 0 && <p className="text-sm text-slate-600">Zatím žádné žádosti.</p>}
        {(mine.data || []).map((r) => <Item key={r.id} r={r} onDecide={decide} onCancel={cancel} />)}
      </section>

      {atLeast(user, "manager") && (
        <section className="space-y-2" data-testid="leave-all">
          <h2 className="font-heading text-lg font-semibold">{t("Všechny žádosti zaměstnanců")}</h2>
          {(allQ.data || []).filter((r) => r.user_id !== user.id).slice(0, 60).map((r) => <Item key={r.id} r={r} showName onDecide={decide} onCancel={cancel} />)}
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="exception-form">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Clock3 className="h-5 w-5" />{t("Plánovaná výjimka / zkrácená směna")}</h2>
        <p className="text-xs text-slate-600">Rychlé oznámení pro vedení – pozdní příchod, dřívější odchod nebo jiný důvod. Neschvaluje se, slouží jako informace, aby s tím vedení počítalo.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[["late_arrival", "Přijdu později"], ["early_departure", "Odejdu dřív"], ["other", "Jiná výjimka"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setEx({ ...ex, kind: v })} data-testid={`exception-kind-${v}`}
              className={`min-h-[56px] rounded-xl border-2 px-3 text-sm font-semibold transition-colors ${ex.kind === v ? "border-[#E6BD00] bg-[#FFD200] text-slate-900" : "border-slate-200 bg-white hover:bg-slate-50"}`}>{l}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Datum"><Input type="date" value={ex.date} onChange={(e) => setEx({ ...ex, date: e.target.value })} className="h-12" data-testid="exception-date" /></Field>
          {ex.kind === "late_arrival" && <Field label="Orientační čas příchodu"><Input type="time" value={ex.time_from} onChange={(e) => setEx({ ...ex, time_from: e.target.value })} className="h-12" data-testid="exception-time-from" /></Field>}
          {ex.kind === "early_departure" && <Field label="Orientační čas odchodu"><Input type="time" value={ex.time_to} onChange={(e) => setEx({ ...ex, time_to: e.target.value })} className="h-12" data-testid="exception-time-to" /></Field>}
          {ex.kind === "other" && <>
            <Field label="Od (nepovinné)"><Input type="time" value={ex.time_from} onChange={(e) => setEx({ ...ex, time_from: e.target.value })} className="h-12" data-testid="exception-time-from" /></Field>
            <Field label="Do (nepovinné)"><Input type="time" value={ex.time_to} onChange={(e) => setEx({ ...ex, time_to: e.target.value })} className="h-12" data-testid="exception-time-to" /></Field>
          </>}
        </div>
        <Field label="Důvod (dítě, úřad, zubař…)"><Textarea value={ex.reason} onChange={(e) => setEx({ ...ex, reason: e.target.value })} placeholder="Krátce popište, proč potřebujete výjimku." data-testid="exception-reason" /></Field>
        <label className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3 text-sm"><input type="checkbox" checked={!!ex.share_with_team} onChange={e => setEx({ ...ex, share_with_team: e.target.checked })} className="h-5 w-5" />Sdílet text důvodu i se strojníky v týmovém kalendáři (jinak vidí jen typ a čas)</label>
        <Button className="btn-primary h-14 w-full text-base font-semibold" disabled={exBusy || !ex.reason.trim()} onClick={submitEx} data-testid="exception-submit">{exBusy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}Oznámit vedení</Button>
      </section>

      <section className="space-y-2" data-testid="exception-mine">
        <h2 className="font-heading text-lg font-semibold">{t("Moje plánované výjimky")}</h2>
        {(myEx.data || []).length === 0 && <p className="text-sm text-slate-600">Zatím žádné výjimky.</p>}
        {(myEx.data || []).map((r) => (
          <div key={r.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" data-testid="exception-item">
            <div className="min-w-0">
              <div className="font-semibold">{r.kind_label} · {dmy(r.date)}{r.time_from && ` · od ${r.time_from}`}{r.time_to && ` · do ${r.time_to}`}</div>
              <div className="text-sm text-slate-700">{r.reason}</div>
              <div className="mt-1 text-xs text-slate-500">Oznámeno {r.created_at?.slice(0, 16).replace("T", " ")}</div>
            </div>
            {r.can_delete && <Button variant="outline" size="sm" className="h-10 text-red-700" onClick={() => delEx(r)} data-testid="exception-delete"><Trash2 className="mr-1 h-4 w-4" />{t("Smazat")}</Button>}
          </div>
        ))}
      </section>

      {atLeast(user, "manager") && (
        <section className="space-y-2" data-testid="exception-all">
          <h2 className="font-heading text-lg font-semibold">{t("Výjimky zaměstnanců")}</h2>
          {(allEx.data || []).filter((r) => r.user_id !== user.id).length === 0 && <p className="text-sm text-slate-600">Žádné výjimky zaměstnanců.</p>}
          {(allEx.data || []).filter((r) => r.user_id !== user.id).slice(0, 100).map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" data-testid="exception-item-mgr">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{r.user_name} <span className="text-sm font-normal text-slate-500">({r.role_label})</span> · {r.kind_label}</div>
                  <div className="text-sm text-slate-700">{dmy(r.date)}{r.time_from && ` · od ${r.time_from}`}{r.time_to && ` · do ${r.time_to}`} — {r.reason}</div>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Oznámení</span>
              </div>
            </div>
          ))}
        </section>
      )}

      <Dialog open={!!rej} onOpenChange={(o) => !o && setRej(null)}>
        <DialogContent className="max-w-md" data-testid="leave-reject-dialog">
          <DialogHeader><DialogTitle className="font-heading">{t("Zamítnout žádost")}</DialogTitle><DialogDescription>{rej?.user_name} · {rej?.type_label}. Uveďte důvod – zaměstnanec ho uvidí.</DialogDescription></DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} data-testid="leave-reject-note" />
          <DialogFooter><Button className="h-12 w-full font-semibold" variant="outline" disabled={!note.trim()} onClick={() => decide(rej, "reject", note.trim())} data-testid="leave-reject-submit">{t("Zamítnout")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
