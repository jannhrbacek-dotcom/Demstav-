import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { http, errText } from "@/lib/api";

/** Full-screen, time-limited signed QR for a tablet at the workplace. Refreshes every 60 s (valid 120 s). */
export default function QrDisplay() {
  const { id } = useParams();
  const [qr, setQr] = useState(null);
  const [err, setErr] = useState("");
  const [left, setLeft] = useState(0);
  useEffect(() => {
    let t;
    const load = async () => { try { const { data } = await http.get(`/workplaces/${id}/qr/dynamic`); setQr(data); setErr(""); } catch (e) { setErr(errText(e)); } };
    load(); t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [id]);
  useEffect(() => { const t = setInterval(() => setLeft(qr ? Math.max(0, Math.round((Date.parse(qr.expiresAt) - Date.now()) / 1000)) : 0), 1000); return () => clearInterval(t); }, [qr]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0B0F14] p-6 text-white" data-testid="qr-display">
      <div className="font-heading text-3xl font-bold">DEMSTAV · {qr?.workplace || "…"}</div>
      {err ? <div className="text-lg text-red-300">{err}</div> : qr && left > 0 ? <div className="rounded-2xl bg-white p-6"><QRCodeSVG value={qr.value} size={Math.min(window.innerWidth, window.innerHeight) * 0.6} data-testid="qr-display-code" /></div> : <div>Čekám na platný QR kód…</div>}
      <div className="text-lg text-slate-300">Naskenujte při příchodu a odchodu. Kód se obnovuje; platnost {left} s.</div>
      <div className="h-1.5 w-64 bg-[#FFD200]" />
    </div>
  );
}
