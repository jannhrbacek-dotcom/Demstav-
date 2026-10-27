import BreakRequests from "@/components/BreakRequests";
import React, { useState } from "react";
import { toast } from "sonner";
import { History, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Field, Empty } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { AttendanceActions } from "@/components/AttendanceActions";
import { useCached } from "@/lib/data";
import { addAttendanceRequest, useSync } from "@/lib/sync";
import { newId, KIND_LABELS, REASON_LABELS, dateTime, pragueDate } from "@/lib/format";
import { fmtHM } from "@/lib/worktime";

export default function Attendance() {
  const s = useSync();
  const att = useCached("/attendance/me?days=31");
  const wps = useCached("/workplaces");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "arrival", date: pragueDate(), time: "", workplaceId: "", reason: "", eventId: "" });
  const queued = s.queue.filter((o) => o.type === "event");
  const openFix = (ev) => { setForm({ kind: ev?.kind || "arrival", date: ev ? pragueDate(new Date(ev.effective_at)) : pragueDate(), time: "", workplaceId: ev?.workplace_id || wps.data?.[0]?.id || "", reason: "", eventId: ev?.id || "" }); setOpen(true); };
  const submit = async () => {
    if (!form.time || !form.reason.trim() || !form.workplaceId) { toast.error("Doplňte čas, pracoviště a důvod."); return; }
    const at = new Date(`${form.date}T${form.time}:00`).toISOString();
    await addAttendanceRequest({ id: newId(), kind: form.kind, at, workplaceId: form.workplaceId, reason: form.reason.trim(), eventId: form.eventId || null });
    setOpen(false);
    toast.success("Žádost o opravu odeslána ke schválení");
    setTimeout(() => att.reload(), 800);
  };
  return (
    <div className="space-y-5">
      <PageHeader title="Docházka" subtitle="Příchod, přestávky a odchod. Příchod do práce není automatickým spuštěním stroje."
        actions={<Button variant="outline" className="h-12" onClick={() => openFix(null)} data-testid="attendance-manual-entry-button"><PencilLine className="mr-1 h-4 w-4" />Požádat o opravu</Button>} />
      <BreakRequests />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <AttendanceActions workplaces={wps.data} serverState={att.data?.projection?.state} onDone={() => att.reload()} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">Dnes</div>
          <div className="mt-1 grid grid-cols-3 gap-3">
            <div><div className="text-xs text-slate-600">Přítomnost</div><div className="font-heading text-2xl font-bold">{fmtHM(att.data?.today_projection?.presenceHours)}</div></div>
            <div><div className="text-xs text-slate-600">Přestávky</div><div className="font-heading text-2xl font-bold">{fmtHM(att.data?.today_projection?.breakHours)}</div></div>
            <div><div className="text-xs text-slate-600">Čistá doba</div><div className="font-heading text-2xl font-bold" data-testid="attendance-net-today">{fmtHM(att.data?.today_projection?.netHours)}</div></div>
          </div>
          <p className="mt-3 text-xs text-slate-600">Docházka eviduje přítomnost na pracovišti. Neověřené záznamy (offline, mimo okruh, ruční) se nevydávají za prokázanou přítomnost – schvaluje je vedoucí.</p>
          {(att.data?.projection?.issues || []).length > 0 && <div className="mt-2 rounded-lg bg-orange-50 p-2 text-xs text-orange-950">{att.data.projection.issues.join(" · ")}</div>}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 font-heading font-semibold"><History className="h-5 w-5" />Historie (31 dní)</div>
        {queued.map((o) => (
          <div key={o.opId} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-3" data-testid="attendance-history-item">
            <div><div className="font-semibold">{KIND_LABELS[o.payload.kind]} · {dateTime(o.payload.deviceAt)}</div><div className="text-xs text-slate-600">čas zařízení; {o.error || "zatím nepřijato serverem"}</div></div>
            <StatusBadge status={o.state === "needs_reason" ? "needs_reason" : o.state === "error" ? "error" : "queued"} />
          </div>))}
        {!att.loading && (att.data?.events || []).length === 0 && queued.length === 0 && <Empty title="Zatím žádné události" text="První záznam vytvoříte tlačítkem Příchod." />}
        {(att.data?.events || []).map((e) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-3" data-testid="attendance-history-item">
            <div className="min-w-0">
              <div className="font-semibold">{KIND_LABELS[e.kind]} · {dateTime(e.effective_at)} · {e.workplace_name}</div>
              <div className="text-xs text-slate-600">{e.verification_method === "gps" ? "Ověření GPS · " : e.verification_method === "qr" ? "Ověření QR · " : ""}zařízení {dateTime(e.device_at)} · server {dateTime(e.received_at)}{e.reasons?.length ? ` · ${e.reasons.map((r) => REASON_LABELS[r] || r).join(", ")}` : ""}{e.decision?.note ? ` · vedoucí: ${e.decision.note}` : ""}</div>
            </div>
            <div className="flex items-center gap-2"><StatusBadge status={e.status} /><Button variant="ghost" size="sm" onClick={() => openFix(e)} data-testid="attendance-fix-event">Oprava</Button></div>
          </div>))}
        {(att.data?.requests || []).length > 0 && <div className="mt-4"><div className="mb-2 text-sm font-semibold">Moje žádosti o opravu</div>{att.data.requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm" data-testid="attendance-request-item"><span>{KIND_LABELS[r.kind]} {dateTime(r.at)} – {r.reason}{r.decision?.note ? ` (vedoucí: ${r.decision.note})` : ""}</span><StatusBadge status={r.status} /></div>))}</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="attendance-request-dialog">
          <DialogHeader><DialogTitle className="font-heading">Žádost o opravu docházky</DialogTitle><DialogDescription>{form.eventId ? "Oprava času existující události." : "Doplnění chybějící události."} Schvaluje vedoucí; původní záznam zůstává v auditu.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Field label="Událost"><Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })} disabled={!!form.eventId}><SelectTrigger className="h-12" data-testid="request-kind-select"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(KIND_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Datum"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-12" data-testid="request-date-input" /></Field>
              <Field label="Skutečný čas"><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="h-12" data-testid="request-time-input" /></Field></div>
            <Field label="Pracoviště"><Select value={form.workplaceId} onValueChange={(v) => setForm({ ...form, workplaceId: v })}><SelectTrigger className="h-12" data-testid="request-workplace-select"><SelectValue placeholder="Vyberte" /></SelectTrigger><SelectContent>{(wps.data || []).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Důvod"><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-testid="request-reason-input" /></Field>
          </div>
          <DialogFooter><Button className="btn-primary h-12 w-full font-semibold" onClick={submit} data-testid="request-submit-button">Odeslat žádost</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
