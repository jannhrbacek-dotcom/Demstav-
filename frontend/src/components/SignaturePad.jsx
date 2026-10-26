import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

/** Captures a drawn signature image. It is NOT a qualified electronic signature. */
export function SignaturePad({ value, onChange, testid = "signature-pad", label = "Podpis" }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(!value);

  useEffect(() => {
    const c = ref.current; const ctx = c.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio;
    ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#1e293b";
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.offsetWidth, c.offsetHeight); img.src = value; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => { e.preventDefault(); drawing.current = true; const ctx = ref.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(...pos(e)); ref.current.setPointerCapture(e.pointerId); };
  const move = (e) => { if (!drawing.current) return; const ctx = ref.current.getContext("2d"); ctx.lineTo(...pos(e)); ctx.stroke(); setEmpty(false); };
  const up = () => { if (!drawing.current) return; drawing.current = false; onChange(ref.current.toDataURL("image/png")); };
  const clear = () => { const c = ref.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); setEmpty(true); onChange(""); };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-900">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} data-testid={`${testid}-clear`}><Eraser className="mr-1 h-4 w-4" />Smazat</Button></div>
      <canvas ref={ref} data-testid={testid} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        className="h-32 w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white" />
      <p className="text-xs text-slate-600">{empty ? "Podepište se prstem nebo myší." : "Obrázek podpisu není kvalifikovaný elektronický podpis; průkaznost zajišťuje osobní účet a historie zápisu."}</p>
    </div>
  );
}
