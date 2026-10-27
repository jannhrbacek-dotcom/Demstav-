import React, { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

/** Textarea s tlačítkem diktafonu – živý přepis řeči (čeština) přímo v telefonu. */
export function DictateTextarea({ value, onChange, testid, placeholder, ...rest }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef(null);
  const baseRef = useRef("");
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* ignore */ } }, []);

  const stop = () => { try { recRef.current?.stop(); } catch { /* ignore */ } };

  const start = () => {
    if (!SR) { toast.error("Tento prohlížeč diktování nepodporuje. Použijte Chrome (Android) nebo Safari (iPhone), případně mikrofon na klávesnici."); return; }
    if (!navigator.onLine) { toast.error("Diktování potřebuje signál. Bez připojení použijte mikrofon na klávesnici telefonu."); return; }
    const rec = new SR();
    rec.lang = "cs-CZ";
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = valueRef.current || "";
    rec.onresult = (ev) => {
      let finalText = "";
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += t; else interimText += t;
      }
      if (finalText.trim()) {
        const base = baseRef.current;
        const sep = base && !/\s$/.test(base) ? " " : "";
        let chunk = finalText.trim();
        if (!base || /[.!?]\s*$/.test(base)) chunk = chunk.charAt(0).toUpperCase() + chunk.slice(1);
        baseRef.current = base + sep + chunk;
        onChange(baseRef.current);
      }
      setInterim(interimText);
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") toast.error("Povolte aplikaci přístup k mikrofonu v nastavení prohlížeče.");
      else if (ev.error === "network") toast.error("Diktování potřebuje signál. Zkuste to znovu po připojení.");
      else if (ev.error !== "no-speech" && ev.error !== "aborted") toast.error("Diktování se nepodařilo, zkuste to znovu.");
    };
    rec.onend = () => { setListening(false); setInterim(""); };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testid}
          className={`min-h-[110px] pr-16 ${listening ? "border-[#FFD200] ring-2 ring-[#FFD200]/60" : ""}`} {...rest} />
        <button type="button" onClick={listening ? stop : start} data-testid={`${testid}-dictate`}
          aria-label={listening ? "Zastavit diktování" : "Diktovat hlasem"} aria-pressed={listening}
          className={`absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${listening ? "animate-pulse bg-red-700 text-white" : "bg-[#FFD200] text-slate-900 hover:bg-[#FFC400]"}`}>
          {listening ? <Square className="h-5 w-5" /> : <Mic className="h-6 w-6" />}
        </button>
      </div>
      {listening && (
        <div className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white" data-testid={`${testid}-dictate-status`} aria-live="polite">
          <span className="font-semibold text-[#FFD200]">Poslouchám…</span> {interim || "mluvte, text se doplní sám. Ukončete čtverečkem."}
        </div>
      )}
    </div>
  );
}
