import React, { useState } from "react";
import { toast } from "sonner";
import { CloudUpload, Trash2, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Empty } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { useSync, syncNow, removeOp, updateOp, resolveConflict } from "@/lib/sync";
import { dateTime, dmy, KIND_LABELS, REASON_LABELS } from "@/lib/format";

const TYPE = { record: "Denní zápis", event: "Docházka", attachment: "Příloha", request: "Žádost o opravu" };

function OpRow({ op, rec }) {
  const [reason, setReason] = useState("");
  const desc = op.type === "record" ? `${rec?.record?.machine || "—"} · ${dmy(rec?.record?.date)}${op.payload.confirm ? " · k potvrzení" : " · koncept"}`
    : op.type === "event" ? `${KIND_LABELS[op.payload.kind]} · čas zařízení ${dateTime(op.payload.deviceAt)}`
    : op.type === "attachment" ? `${op.payload.name} · ${Math.round(op.payload.size / 1024)} kB` : `${KIND_LABELS[op.payload.kind]} · ${dateTime(op.payload.at)}`;
  const serverConfirmed = rec?.serverRecord?.status === "confirmed";
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="queue-item-row">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><div className="font-semibold">{TYPE[op.type]}</div><div className="text-sm text-slate-600">{desc}</div><div className="text-xs text-slate-500">Uloženo v telefonu {dateTime(op.createdAt)}{op.attempts ? ` · pokusů ${op.attempts}` : ""}</div></div>
        <StatusBadge status={op.state === "queued" ? "queued" : op.state} />
      </div>
      {op.error && <div className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900" data-testid="queue-item-error">{op.error}</div>}
      {op.state === "needs_reason" && (
        <div className="space-y-2"><div className="text-sm">Důvod výjimky: {(op.reasons || []).map((r) => REASON_LABELS[r] || r).join(", ")}</div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Proč se ověření nepodařilo…" data-testid="queue-reason-input" />
          <Button className="btn-primary h-12 font-semibold" disabled={!reason.trim()} onClick={() => updateOp(op.opId, { exceptionReason: reason.trim() })} data-testid="queue-reason-submit">Odeslat ke schválení</Button></div>)}
      {op.state === "conflict" && (
        <div className="space-y-2 rounded-lg border border-rose-200 p-3" data-testid="queue-conflict">
          <div className="text-sm">Na serveru je novější verze (revize {rec?.serverRecord?.revision}, {rec?.serverRecord?.status === "confirmed" ? "potvrzená" : "koncept"}, uloženo {dateTime(rec?.serverRecord?.updatedAt)}).</div>
          {serverConfirmed && <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Důvod opravy (povinný u potvrzeného zápisu)" data-testid="queue-conflict-reason" />}
          <div className="flex flex-wrap gap-2">
            <Button className="btn-primary h-12 font-semibold" disabled={serverConfirmed && !reason.trim()} onClick={() => resolveConflict(op.refId, "mine", reason.trim())} data-testid="queue-conflict-keep-mine">Ponechat moji verzi (nová revize)</Button>
            <Button variant="outline" className="h-12" onClick={() => resolveConflict(op.refId, "server")} data-testid="queue-conflict-take-server">Převzít verzi ze serveru</Button>
          </div>
        </div>)}
      <div className="flex flex-wrap gap-2">
        {(op.state === "error" || op.state === "retry") && <Button variant="outline" className="h-11" onClick={() => updateOp(op.opId, {})} data-testid="queue-item-retry-button"><RefreshCw className="mr-1 h-4 w-4" />Zkusit znovu</Button>}
        {op.state !== "queued" && <Button variant="ghost" className="h-11 text-red-700" onClick={() => { if (window.confirm("Položka bude z telefonu odstraněna a nebude odeslána. Pokračovat?")) removeOp(op.opId); }} data-testid="queue-item-remove-button"><Trash2 className="mr-1 h-4 w-4" />Zahodit</Button>}
      </div>
    </div>
  );
}

export default function Queue() {
  const s = useSync();
  const send = async () => { await syncNow(); toast(s.online ? "Odesílání dokončeno" : "Bez připojení – zkusíme později"); };
  return (
    <div>
      <PageHeader title="Fronta odesílání" subtitle={`Položky uložené v tomto telefonu, které ještě server nepřijal. ${s.lastSync ? `Poslední pokus ${dateTime(s.lastSync)}.` : ""}`}
        actions={<Button className="btn-primary h-12 font-semibold" onClick={send} disabled={s.syncing || !s.queue.length} data-testid="queue-send-all-button"><CloudUpload className={`mr-2 h-5 w-5 ${s.syncing ? "animate-pulse" : ""}`} />Odeslat vše</Button>} />
      {s.queue.length === 0 ? <Empty icon={CheckCircle2} title="Vše je odesláno" text="Server přijal všechny záznamy z tohoto zařízení." />
        : <div className="space-y-3">{s.queue.map((op) => <OpRow key={op.opId} op={op} rec={op.type === "record" ? s.records[op.refId] : null} />)}</div>}
      <p className="mt-4 text-xs text-slate-600">Každá položka má stálý identifikátor – opakované odeslání nevytvoří duplicitu. Data jsou oddělená podle účtu a vypršení přihlášení je nesmaže.</p>
    </div>
  );
}
