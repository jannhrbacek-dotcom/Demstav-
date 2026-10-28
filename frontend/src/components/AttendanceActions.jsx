import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { LogIn, LogOut, Coffee, Play, QrCode, MapPin, Route } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { QrScanner } from "@/components/QrScanner";
import { addAttendanceEvent, updateOp, removeOp, useSync } from "@/lib/sync";
import { newId, KIND_LABELS, REASON_LABELS, MODE_LABELS } from "@/lib/format";
import { useLanguage } from "@/lib/language";

export function nextState(state, kind) {
  if (kind === "arrival" && (state === "away" || state === "travel")) return "working";
  if (kind === "departure" && (state === "working" || state === "break" || state === "travel")) return "away";
  if (kind === "travel_start" && state === "working") return "travel";
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
  travel_start: { icon: Route, testid: "today-travel-button" },
};
// Pauza a přejezd se jen klepnou – bez QR a GPS.
const TAP = ["break_start", "break_end", "travel_start"];

export function AttendanceActions({ workplaces, serverState, onDone }) {
  const { t } = useLanguage();
  const { state } = useShiftState(serverState);
  const [wpId, setWpId] = useState(() => localStorage.getItem("demstav:lastWorkplace") || "");
  const [qrFor, setQrFor] = useState(null);
  const [methodFor, setMethodFor] = useState(null);
  const [reasonOp, setReasonOp] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [travelOpen, setTravelOpen] = useState(false);
  const [travelTo, setTravelTo] = useState("");
  const wp = (workplaces || []).find((w) => w.id === wpId) || (workplaces?.length === 1 ? workplaces[0] : null);

  const finish = (op) => {
    if (!op) { toast.success(t("Přijato serverem")); onDone && onDone(); return; }
    if (op.state === "needs_reason") { setReasonOp(op); return; }
    if (op.state === "error") { toast.error(op.error || t("Událost nebyla přijata.")); return; }
    toast(t("Uloženo v telefonu – čeká na odeslání"), { description: t("Odešle se automaticky po připojení.") });
  };

  const send = async (kind, qr, extra = {}) => {
    if (busy) return;
    if (!wp) { toast.error(t("Nejprve vyberte pracoviště.")); return; }
    setBusy(true);
    try {
      localStorage.setItem("demstav:lastWorkplace", wp.id);
      const tap = TAP.includes(kind);
      const gps = !tap && (wp.mode === "gps" || wp.mode === "qr_gps" || (wp.mode === "gps_or_qr" && !qr)) ? await captureGps() : null;
      const deviceAt = new Date().toISOString();
      const op = await addAttendanceEvent({ id: newId(), workplaceId: wp.id, kind, deviceAt, offline: !navigator.onLine, qr: qr || null, gps, exceptionReason: "", ...extra });
      finish(op);
    } catch (e) { toast.error(e.message || t("Událost nelze uložit. Zkuste to znovu.")); } finally { setBusy(false); }
  };
  const start = (kind) => {
    if (!wp) { toast.error(t("Nejprve vyberte pracoviště.")); return; }
    if (kind === "travel_start") { setTravelOpen(true); return; }
    if (TAP.includes(kind)) { send(kind); return; }
    if (wp.mode === "gps_or_qr") setMethodFor(kind);
    else if (wp.mode === "qr" || wp.mode === "qr_gps") setQrFor(kind); else send(kind);
  };
  const startTravel = () => {
    setTravelOpen(false);
    send("travel_start", null, { travelFrom: wp?.name || "", travelTo: travelTo.trim() });
    setTravelTo("");
  };
  const submitReason = async () => {
    const op = reasonOp; setReasonOp(null);
    await updateOp(op.opId, { exceptionReason: reason.trim() });
    setReason("");
    const { getState } = await import("@/lib/sync");
    finish(getState().queue.find((o) => o.opId === op.opId) || null);
  };

  const kinds = state === "travel" ? ["arrival", "departure"] : (state === "break" ? ["break_end", "departure"] : ["arrival", "departure"]);
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="text-sm font-semibold text-slate-900">{t("Pracoviště")}</div>
        <Select value={wp?.id || ""} onValueChange={(v) => setWpId(v)}>
          <SelectTrigger className="h-14 text-base" data-testid="attendance-workplace-select"><SelectValue placeholder={workplaces?.length ? t("Vyberte pracoviště") : t("Žádné pracoviště – kontaktujte vedoucího")} /></SelectTrigger>
          <SelectContent>{(workplaces || []).map((w) => <SelectItem key={w.id} value={w.id} data-testid={`workplace-option-${w.id}`}>{w.name} · {MODE_LABELS[w.mode]}</SelectItem>)}</SelectContent>
        </Select>
        {wp?.mode === "gps_or_qr" && <p className="text-sm text-slate-700">Příchod i odchod potvrdíte polohou GPS v okruhu {wp.radius} m nebo QR kódem na pracovišti. Stačí jeden způsob.</p>}
        {wp && wp.mode !== "gps_or_qr" && <div className="flex items-center gap-2 text-xs text-slate-600">{wp.mode.includes("qr") && <><QrCode className="h-3.5 w-3.5" />naskenujte QR na pracovišti</>}{wp.mode.includes("gps") && <><MapPin className="h-3.5 w-3.5" />poloha se ověří jen v okamžiku záznamu a neukládá se</>}{wp.mode === "manual" && "ruční záznam – schvaluje vedoucí"}</div>}
      </div>
      {state === "travel" && (
        <div className="rounded-xl border-2 border-[#E6BD00] bg-amber-50 p-3 text-sm text-amber-950" data-testid="attendance-travel-banner">
          <div className="font-semibold">{t("Přejezd na jinou zakázku – stále v práci")}</div>
          <div>Po příjezdu vyberte nové pracoviště (bod B) a dejte <b>Příchod</b> s ověřením podle pracoviště. Čas přejezdu se počítá do pracovní doby, ale nefakturuje se.</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {kinds.map((k) => {
          const enabled = !!nextState(state, k) && !busy;
          const primary = k === "arrival" || k === "departure";
          const I = BTN[k].icon;
          const label = k === "arrival" && state === "travel" ? t("Příjezd na bod B") : KIND_LABELS[k];
          return (
            <button key={k} type="button" disabled={!enabled} onClick={() => start(k)} data-testid={BTN[k].testid}
              className={`flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-base font-semibold transition-colors duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${primary ? "border-[#E6BD00] bg-[#FFD200] text-slate-900 hover:bg-[#FFC400]" : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"}`}>
              <I className="h-7 w-7" />{t(label)}
            </button>
          );
        })}
      </div>
      {state !== "travel" && (
        <button type="button" disabled={!nextState(state, "travel_start") || busy} onClick={() => start("travel_start")} data-testid={BTN.travel_start.testid}
          className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white px-3 text-base font-semibold text-slate-900 transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          <Route className="h-6 w-6" />{t("Přejezd na jinou zakázku (A → B)")}
        </button>
      )}
      {busy && <p role="status" className="text-sm font-semibold">{t("Ověřuji a ukládám docházku…")}</p>}
      <p className="text-xs text-slate-600">Přestávky 12:00–12:30 a 15:30–16:00 se odečítají automaticky. Změnu žádejte v Docházce. Přejezd stačí klepnout – bez QR. Příchod a odchod potvrďte způsobem uvedeným u pracoviště.</p>

      <Dialog open={!!methodFor} onOpenChange={(o) => !o && setMethodFor(null)}>
        <DialogContent className="max-w-md" data-testid="attendance-method-dialog">
          <DialogHeader><DialogTitle>{t(KIND_LABELS[methodFor])} – {t("jak potvrdit?")}</DialogTitle><DialogDescription>{wp?.name}. {t("Vyberte jeden způsob ověření.")}</DialogDescription></DialogHeader>
          <Button className="btn-primary h-16 text-lg" disabled={busy} data-testid="attendance-method-gps" onClick={() => { const kind = methodFor; setMethodFor(null); send(kind); }}><MapPin className="mr-2 h-6 w-6" />{t("Potvrdit pomocí GPS")}</Button>
          <Button variant="outline" className="h-16 text-lg" disabled={busy} data-testid="attendance-method-qr" onClick={() => { setQrFor(methodFor); setMethodFor(null); }}><QrCode className="mr-2 h-6 w-6" />{t("Naskenovat QR kód")}</Button>
          <p className="text-sm text-slate-600">GPS se použije jen při potvrzení. Při skenování QR není přístup k poloze potřeba. Bez ověření záznam schvaluje vedoucí.</p>
        </DialogContent>
      </Dialog>

      <Dialog open={travelOpen} onOpenChange={setTravelOpen}>
        <DialogContent className="max-w-md" data-testid="travel-dialog">
          <DialogHeader><DialogTitle className="font-heading">Přejezd na jinou zakázku</DialogTitle>
            <DialogDescription>Odjíždíte z: <b>{wp?.name}</b> (bod A). Zůstáváte v práci – směna se nepřeruší.</DialogDescription></DialogHeader>
          <div className="space-y-1.5">
            <div className="text-sm font-semibold">Kam jedete (bod B)</div>
            <Input list="travel-to-list" value={travelTo} onChange={(e) => setTravelTo(e.target.value)} className="h-12" placeholder="Pracoviště nebo adresa" data-testid="travel-to-input" />
            <datalist id="travel-to-list">{(workplaces || []).filter((w) => w.id !== wp?.id).map((w) => <option key={w.id} value={w.name} />)}</datalist>
          </div>
          <DialogFooter><Button className="btn-primary h-12 w-full font-semibold" onClick={startTravel} data-testid="travel-start-confirm">Vyjíždím</Button></DialogFooter>
        </DialogContent>
      </Dialog>

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
          {wp?.mode === "gps_or_qr" && reasonOp?.payload?.workplaceId === wp.id && !reasonOp?.payload?.qr && <Button variant="outline" className="h-12" data-testid="exception-try-qr" onClick={async () => {
            const op = reasonOp;
            await removeOp(op.opId);
            setReasonOp(null); setReason(""); setQrFor(op.payload.kind);
          }}><QrCode className="mr-2 h-5 w-5" />Zkusit QR místo GPS</Button>}
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Např. slabý signál GPS v hale, QR kód je poškozený…" className="min-h-[100px]" data-testid="exception-reason-input" />
          <DialogFooter><Button className="btn-primary h-12 w-full font-semibold" disabled={!reason.trim()} onClick={submitReason} data-testid="exception-reason-submit">Odeslat ke schválení</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
