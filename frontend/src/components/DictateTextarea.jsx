import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { http } from "@/lib/api";

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const HAS_REC = typeof window !== "undefined" && !!window.MediaRecorder && !!navigator.mediaDevices?.getUserMedia;
const MAX_SECONDS = 120;

const pickMime = () => {
  if (!HAS_REC) return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mp4;codecs=mp4a.40.2"]) {
    try { if (window.MediaRecorder.isTypeSupported?.(t)) return t; } catch { /* ignore */ }
  }
  return "";
};

const joinText = (base, chunk) => {
  const c = (chunk || "").trim();
  if (!c) return base || "";
  const b = base || "";
  const sep = b && !/\s$/.test(b) ? " " : "";
  const cap = !b || /[.!?]\s*$/.test(b) ? c.charAt(0).toUpperCase() + c.slice(1) : c;
  return b + sep + cap;
};

/**
 * Textarea s diktafonem. Hlavní režim: nahrávka → přepis AI (Emergent managed OpenAI Whisper, model whisper-1).
 * Bez signálu se nahrávka podrží a přepíše automaticky po připojení. Záložně živý přepis prohlížeče.
 */
export function DictateTextarea({ value, onChange, testid, placeholder, ...rest }) {
  const [phase, setPhase] = useState("idle"); // idle | recording | transcribing | pending
  const [secs, setSecs] = useState(0);
  const [interim, setInterim] = useState("");
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const pendingRef = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const cleanupStream = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => { cleanupStream(); try { recRef.current?.stop?.(); } catch { /* ignore */ } }, []);

  const transcribe = useCallback(async (blob) => {
    setPhase("transcribing");
    try {
      const fd = new FormData();
      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      fd.append("file", blob, `poznamka.${ext}`);
      fd.append("field", testid || "");
      const { data } = await http.post("/stt", fd, { timeout: 90000 });
      pendingRef.current = null;
      if (data.text) { onChangeRef.current(joinText(valueRef.current, data.text)); toast.success("Text doplněn z nahrávky."); }
      else toast.error("V nahrávce nebyla rozpoznána řeč. Zkuste mluvit blíž k telefonu.");
      setPhase("idle");
    } catch (e) {
      const status = e?.response?.status;
      if (!status || !navigator.onLine) {
        pendingRef.current = blob;
        setPhase("pending");
        toast.message("Bez signálu – nahrávka je uložená a přepíše se po připojení.");
      } else {
        pendingRef.current = blob;
        setPhase("pending");
        toast.error(e?.response?.data?.detail || "Přepis se nepodařil. Zkuste to znovu.");
      }
    }
  }, [testid]);

  // Po obnovení připojení automaticky přepiš čekající nahrávku.
  useEffect(() => {
    const h = () => { if (pendingRef.current) transcribe(pendingRef.current); };
    window.addEventListener("online", h);
    return () => window.removeEventListener("online", h);
  }, [transcribe]);

  const startRecording = async () => {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { toast.error("Povolte aplikaci přístup k mikrofonu v nastavení telefonu."); return; }
    streamRef.current = stream;
    const mime = pickMime();
    const rec = new window.MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (ev) => { if (ev.data?.size) chunksRef.current.push(ev.data); };
    rec.onstop = () => {
      cleanupStream();
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
      if (blob.size < 1000) { setPhase("idle"); toast.error("Nahrávka je příliš krátká."); return; }
      if (!navigator.onLine) { pendingRef.current = blob; setPhase("pending"); toast.message("Bez signálu – nahrávka je uložená a přepíše se po připojení."); return; }
      transcribe(blob);
    };
    recRef.current = rec;
    rec.start(1000);
    setSecs(0);
    setPhase("recording");
    timerRef.current = setInterval(() => setSecs((s) => {
      if (s + 1 >= MAX_SECONDS) { try { rec.stop(); } catch { /* ignore */ } }
      return s + 1;
    }), 1000);
  };

  // Záložní živý přepis (jen pokud prohlížeč neumí nahrávat).
  const startLive = () => {
    if (!SR) { toast.error("Tento prohlížeč diktování nepodporuje. Použijte mikrofon na klávesnici telefonu."); return; }
    const rec = new SR();
    rec.lang = "cs-CZ"; rec.continuous = true; rec.interimResults = true;
    let base = valueRef.current || "";
    rec.onresult = (ev) => {
      let fin = ""; let tmp = "";
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        if (ev.results[i].isFinal) fin += ev.results[i][0].transcript; else tmp += ev.results[i][0].transcript;
      }
      if (fin.trim()) { base = joinText(base, fin); onChangeRef.current(base); }
      setInterim(tmp);
    };
    rec.onerror = (ev) => { if (!["no-speech", "aborted"].includes(ev.error)) toast.error("Diktování se nepodařilo, zkuste to znovu."); };
    rec.onend = () => { setPhase("idle"); setInterim(""); };
    recRef.current = rec;
    try { rec.start(); setPhase("recording"); } catch { setPhase("idle"); }
  };

  const toggle = () => {
    if (phase === "recording") { try { recRef.current?.stop(); } catch { /* ignore */ } return; }
    if (phase === "transcribing") return;
    if (HAS_REC) startRecording(); else startLive();
  };

  const busy = phase === "transcribing";
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testid}
          className={`min-h-[110px] pr-16 ${phase === "recording" ? "border-[#FFD200] ring-2 ring-[#FFD200]/60" : ""}`} {...rest} />
        <button type="button" onClick={toggle} disabled={busy} data-testid={`${testid}-dictate`}
          aria-label={phase === "recording" ? "Zastavit nahrávání" : "Nadiktovat hlasem"} aria-pressed={phase === "recording"}
          className={`absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-70 ${phase === "recording" ? "animate-pulse bg-red-700 text-white" : "bg-[#FFD200] text-slate-900 hover:bg-[#FFC400]"}`}>
          {phase === "recording" ? <Square className="h-5 w-5" /> : busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-6 w-6" />}
        </button>
      </div>
      {phase === "recording" && (
        <div className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white" data-testid={`${testid}-dictate-status`} aria-live="polite">
          <span className="font-semibold text-[#FFD200]">Nahrávám {HAS_REC ? mmss : ""}</span>{" "}
          {HAS_REC ? "– mluvte normálně, po zastavení čtverečkem se text doplní sám." : (interim || "mluvte, text se doplní sám.")}
        </div>
      )}
      {busy && <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800" data-testid={`${testid}-dictate-status`} aria-live="polite">Přepisuji nahrávku…</div>}
      {phase === "pending" && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-950" data-testid={`${testid}-dictate-pending`} aria-live="polite">
          <span className="flex-1">Nahrávka čeká na přepis (bez signálu nebo chyba). Neopouštějte formulář.</span>
          <button type="button" className="flex items-center gap-1 font-semibold underline" onClick={() => pendingRef.current && transcribe(pendingRef.current)} data-testid={`${testid}-dictate-retry`}><RotateCw className="h-4 w-4" />Přepsat</button>
          <button type="button" className="flex items-center gap-1 text-amber-900" onClick={() => { pendingRef.current = null; setPhase("idle"); }} data-testid={`${testid}-dictate-discard`}><X className="h-4 w-4" />Zahodit</button>
        </div>
      )}
    </div>
  );
}
