import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function QrScanner({ onResult }) {
  const [err, setErr] = useState("");
  const [manual, setManual] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const q = new Html5Qrcode("qr-reader");
    ref.current = q;
    let stopped = false;
    q.start({ facingMode: "environment" }, { fps: 10, qrbox: 220 }, (text) => {
      if (stopped) return; stopped = true;
      q.stop().catch(() => {}).finally(() => onResult(text));
    }, () => {}).catch(() => setErr("Kameru nelze spustit (oprávnění nebo zařízení). Opište kód ručně."));
    return () => { if (!stopped) { stopped = true; q.stop().catch(() => {}); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="space-y-3">
      <div id="qr-reader" data-testid="qr-reader" className="mx-auto w-full max-w-sm overflow-hidden rounded-lg bg-slate-900" style={{ minHeight: 220 }} />
      {err && <p className="text-sm font-medium text-red-700" data-testid="qr-error">{err}</p>}
      <div className="flex gap-2">
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Kód z QR (DS0… / DS1…)" className="h-12" data-testid="qr-manual-input" />
        <Button type="button" className="h-12" variant="outline" disabled={!manual.trim()} onClick={() => onResult(manual.trim())} data-testid="qr-manual-submit">Použít</Button>
      </div>
    </div>
  );
}
