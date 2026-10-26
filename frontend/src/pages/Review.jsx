import React, { useState } from "react";
import { toast } from "sonner";
import { Check, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Empty } from "@/components/Section";
import { useCached } from "@/lib/data";
import { http, errText } from "@/lib/api";
import { KIND_LABELS, REASON_LABELS, dateTime, MODE_LABELS } from "@/lib/format";

function Item({ title, lines, onDecide, testid }) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3 rounded-xl border-2 border-orange-200 bg-white p-4 shadow-sm" data-testid={testid}>
      <div className="font-semibold">{title}</div>
      <div className="space-y-0.5 text-sm text-slate-700">{lines.filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}</div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Poznámka (u zamítnutí povinná)" className="h-11" data-testid="review-note-input" />
      <div className="flex gap-2">
        <Button className="btn-primary h-12 flex-1 font-semibold" onClick={() => onDecide("approve", note)} data-testid="review-approve-button"><Check className="mr-1 h-5 w-5" />Schválit</Button>
        <Button className="h-12 flex-1 bg-red-600 font-semibold text-white hover:bg-red-700" disabled={!note.trim()} onClick={() => onDecide("reject", note)} data-testid="review-reject-button"><X className="mr-1 h-5 w-5" />Zamítnout</Button>
      </div>
    </div>
  );
}

export default function Review() {
  const q = useCached("/attendance/review");
  const decide = async (path, decision, note) => {
    try { await http.post(path, { decision, note }); toast.success(decision === "approve" ? "Schváleno" : "Zamítnuto"); q.reload(); } catch (e) { toast.error(errText(e)); }
  };
  const evs = q.data?.events || [], reqs = q.data?.requests || [];
  return (
    <div className="space-y-5">
      <PageHeader title="Kontrola výjimek" subtitle="Offline, ruční, mimo okruh či bez platného QR – rozhodnutí se ukládá do auditu s vaším jménem a časem." />
      {!q.loading && evs.length + reqs.length === 0 && <Empty icon={ShieldCheck} title="Nic ke schválení" text="Všechny události docházky jsou ověřené nebo vyřízené." />}
      {evs.length > 0 && <div><div className="mb-2 font-heading font-semibold">Události docházky ({evs.length})</div><div className="grid gap-3 lg:grid-cols-2">{evs.map((e) => (
        <Item key={e.id} testid="review-event-item" title={`${e.employee_name} · ${KIND_LABELS[e.kind]} · ${e.workplace_name}`}
          lines={[`Čas zařízení: ${dateTime(e.device_at)} · přijato serverem: ${dateTime(e.received_at)}`, `Režim: ${MODE_LABELS[e.mode] || e.mode}${e.offline ? " · zapsáno offline" : ""}`,
            `Důvod výjimky: ${(e.reasons || []).map((r) => REASON_LABELS[r] || r).join(", ")}`, e.gps ? `GPS: ${e.gps.result}${e.gps.distance != null ? `, vzdálenost ${e.gps.distance} m, přesnost ${e.gps.accuracy} m` : ""} (souřadnice se neukládají)` : null,
            e.exception_reason ? `Zaměstnanec uvedl: „${e.exception_reason}“` : null]}
          onDecide={(d, n) => decide(`/attendance/events/${e.id}/decision`, d, n)} />))}</div></div>}
      {reqs.length > 0 && <div><div className="mb-2 font-heading font-semibold">Žádosti o opravu ({reqs.length})</div><div className="grid gap-3 lg:grid-cols-2">{reqs.map((r) => (
        <Item key={r.id} testid="review-request-item" title={`${r.employee_name} · ${r.event_id ? "oprava času" : "doplnění"}: ${KIND_LABELS[r.kind]}`}
          lines={[`Skutečný čas: ${dateTime(r.at)} · ${r.workplace_name}`, `Důvod: „${r.reason}“`, `Podáno: ${dateTime(r.created_at)}`]}
          onDecide={(d, n) => decide(`/attendance/requests/${r.id}/decision`, d, n)} />))}</div></div>}
    </div>
  );
}
