import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { LogIn, LogOut, Coffee, Play, QrCode, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { QrScanner } from "@/components/QrScanner";
import { addAttendanceEvent, updateOp, useSync } from "@/lib/sync";
import { newId, KIND_LABELS, REASON_LABELS, MODE_LABELS } from "@/lib/format";

export function nextState(state, kind) {
  if (kind === "arrival" && state === "away") return "working";
  if (kind === "departure" && (state === "working" || state === "break")) return "away";
  if (kind === "break_start" && state === "working") return "break";
  if (kind === "break_end" && state === "break") return "working";
  return null;
}

/** Server state + events still waiting in the local queue. */
export function useShiftState(serverState) {
  const s = useSync();
  return useMemo(() => {
    let st = serverState || "away";
    const pending = s.queue.filter((o) => o.type === "event").sort((a, b) => a.payload.deviceAt.localeCompare(b.payload.deviceAt));
    for (const op of pending) { const n = nextState(st, op.payload.kind); if (n) st = n; }
    return { state: st, pending };
  }, [serverState, s.queue]);
}

function captureGps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, capturedAt: new Date(p.timestamp || Date.now()).toISOString() }),
      () => resolve(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  });
}

const BTN = {
  arrival: { icon: LogIn, testid: "today-arrival-button" },
  break_start: { icon: Coffee, testid: "today-break-start-button" },
  break_end: { icon: Play, testid: "today-break-end-button" },
  departure: { icon: LogOut, testid: "today-departure-button" },
};

export function AttendanceActions({ workplaces, serverState, onDone }) {
  const { state } = useShiftState(serverState);
  const [wpId, setWpId] = useState(() => localStorage.getItem("demstav:lastWorkplace") || "");
  const [qrFor, setQrFor] = useState(null);
  const [reasonOp, setReasonOp] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const wp = (workplaces || []).find((w) => w.id === wpId) || (workplaces?.length === 1 ? workplaces[0] : null);

  const finish = (op) => {
    if (!op) { toast.success("Přijato serverem"); onDone && onDone(); return; }
    if (op.state === "needs_reason") { setReasonOp(op); return; }
    if (op.state === "error") { toast.error(op.error || "Událost nebyla přijata."); return; }
    toast("Uloženo v telefonu – čeká na odeslání", { description: "Odešle se automaticky po připojení." });
  };

  const send = async (kind, qr) => {
    if (!wp) { toast.error("Nejprve vyberte pracoviště."); return; }
    setBusy(true);
    try {
      localStorage.setItem("demstav:lastWorkplace", wp.id);
      const deviceAt = new Date().toISOString();
      const gps = wp.mode === "gps" || wp.mode === "qr_gps" ? await captureGps() : null;
      const op = await addAttendanceEvent({ id: newId(), workplaceId: wp.id, kind, deviceAt, offline: !navigator.onLine, qr: qr || null, gps, exceptionReason: "" });
      finish(op);
    } finally { setBusy(false); }
  };
  const start = (kind) => {
    if (!wp) { toast.error("Nejprve vyberte pracoviště."); return; }
    if (wp.mode === "qr" || wp.mode === "qr_gps") setQrFor(kind); else send(kind);
  };
  const submitReason = async () => {
    const op = reasonOp; setReasonOp(null);
    await updateOp(op.opId, { exceptionReason: reason.trim() });
    setReason("");
    const { getState } = await import("@/lib/sync");
    finish(getState().queue.find((o) => o.opId === op.opId) || null);
  };

  const kinds = ["arrival", "break_start", "break_end", "departure"];
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="text-sm font-semibold text-slate-900">Pracoviště</div>
        <Select value={wp?.id || ""} onValueChange={(v) => setWpId(v)}>
          <SelectTrigger className="h-14 text-base" data-testid="attendance-workplace-select"><SelectValue placeholder={workplaces?.length ? "Vyberte pracoviště" : "Žádné pracoviště – kontaktujte vedoucího"} /></SelectTrigger>
          <SelectContent>{(workplaces || []).map((w) => <SelectItem key={w.id} value={w.id} data-testid={`workplace-option-${w.id}`}>{w.name} · {MODE_LABELS[w.mode]}</SelectItem>)}</SelectContent>
        </Select>
        {wp && <div className="flex items-center gap-2 text-xs text-slate-600">{wp.mode.includes("qr") && <><QrCode className="h-3.5 w-3.5" />naskenujte QR na pracovišti</>}{wp.mode.includes("gps") && <><MapPin className="h-3.5 w-3.5" />poloha se ověří jen v okamžiku záznamu a neukládá se</>}{wp.mode === "manual" && "ruční záznam – schvaluje vedoucí"}</div>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {kinds.map((k) => {
          const enabled = !!nextState(state, k) && !busy;
          const primary = k === "arrival" || k === "departure";
          const I = BTN[k].icon;
          return (
            <button key={k} type="button" disabled={!enabled} onClick={() => start(k)} data-testid={BTN[k].testid}
              className={`flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-base font-semibold transition-colors duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${primary ? "border-[#E6BD00] bg-[#FFD200] text-slate-900 hover:bg-[#FFC400]" : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"}`}>
              <I className="h-7 w-7" />{KIND_LABELS[k]}
            </button>
          );
        })}
      </div>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-w-md" data-testid="qr-dialog">
          <DialogHeader><DialogTitle className="font-heading">Naskenujte QR – {KIND_LABELS[qrFor]}</DialogTitle><DialogDescription>QR kód je vyvěšený nebo zobrazený na tabletu na pracovišti {wp?.name}.</DialogDescription></DialogHeader>
          {qrFor && <QrScanner onResult={(code) => { const k = qrFor; setQrFor(null); send(k, code); }} />}
          <DialogFooter><Button variant="outline" className="h-12" onClick={() => { const k = qrFor; setQrFor(null); send(k, null); }} data-testid="qr-skip-button">Bez QR (bude výjimka)</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reasonOp} onOpenChange={(o) => !o && setReasonOp(null)}>
        <DialogContent className="max-w-md" data-testid="exception-reason-dialog">
          <DialogHeader><DialogTitle className="font-heading">Ověření se nepodařilo</DialogTitle>
            <DialogDescription>{(reasonOp?.reasons || []).map((r) => REASON_LABELS[r] || r).join(", ")}. Doplňte důvod – záznam uložíme jako výjimku ke schválení vedoucím.</DialogDescription></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Např. slabý signál GPS v hale, QR kód je poškozený…" className="min-h-[100px]" data-testid="exception-reason-input" />
          <DialogFooter><Button className="btn-primary h-12 w-full font-semibold" disabled={!reason.trim()} onClick={submitReason} data-testid="exception-reason-submit">Odeslat ke schválení</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
