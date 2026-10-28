import React, { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, FileCheck2 } from "lucide-react";
import { http, errText } from "@/lib/api";

const VALID = new Set(["date", "machine", "site", "work", "mthStart", "mthEnd", "start", "end"]);
const present = (record, key) => {
  if (key === "start" || key === "end") return !!record.billing?.[0]?.[key];
  return !!record[key];
};

/** Deliberately never saves/validates a record. OCR only proposes edits after human review. */
export function PhotoDiaryOcr({ record, onAttach, onApply }) {
  const [fields, setFields] = useState([]);
  const [raw, setRaw] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [attached, setAttached] = useState(false);
  const generation = useRef(0);

  async function process(file, isAttached = false) {
    if (!file) return;
    const epoch = ++generation.current;
    setBusy(true); setError(""); setFields([]); setRaw(""); setWarning("");
    setPhoto(file); setAttached(isAttached);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Pro automatický přepis vyberte JPG/PNG/WEBP do 10 MB.");
      setBusy(false);
      return;
    }
    try {
      if (!isAttached) {
        await onAttach(file);
        if (generation.current !== epoch) return;
        setAttached(true);
      }
      const form = new FormData();
      form.append("file", file, file.name || "denik.jpg");
      const { data } = await http.post("/ocr/diary", form, { timeout: 60000 });
      if (generation.current !== epoch) return;
      setRaw(data.text || "");
      setWarning(data.warning || "");
      setFields((data.fields || []).filter(f => VALID.has(f.key)).map(f => ({
        ...f, checked: !present(record, f.key),
      })));
      if (!data.text) setError("Fotografie nebyla čitelná. Zkuste ostrý snímek při dobrém světle.");
      else if (!(data.fields || []).length) setError("Text byl přečten, ale hodnoty nebyly bezpečně rozpoznány. Zkontrolujte původní text níže.");
    } catch (e) {
      if (generation.current === epoch) setError(errText(e, "Přepis fotografie se nezdařil. Příloha zůstává v zápisu."));
    } finally {
      if (generation.current === epoch) setBusy(false);
    }
  }

  const update = (key, prop, value) => setFields(prev => prev.map(f => f.key === key ? { ...f, [prop]: value } : f));
  const apply = () => {
    const selected = fields.filter(f => f.checked && String(f.value || "").trim());
    if (!selected.length) return;
    const patch = {};
    selected.forEach(f => { patch[f.key] = String(f.value).trim(); });
    if ((patch.start && !patch.end) || (patch.end && !patch.start)) {
      setError("Čas směny použijte pouze při potvrzeném začátku i konci.");
      return;
    }
    if (patch.date && !/^\d{4}-\d{2}-\d{2}$/.test(patch.date)) {
      setError("Datum musí být ve formátu RRRR-MM-DD.");
      return;
    }
    if (patch.start && (![patch.start, patch.end].every(s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)))) {
      setError("Čas musí být ve formátu HH:MM.");
      return;
    }
    setError("");
    onApply(patch);
    setWarning("Údaje byly vloženy do rozepsaného formuláře. Před potvrzením zápisu zkontrolujte MTH, čas a datum.");
    setFields(prev => prev.map(f => ({ ...f, checked: false })));
  };

  return <div className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4" data-testid="photo-diary-ocr">
    <h2 className="text-lg font-bold text-slate-900">Přepsat papírový deník / šichtovnici</h2>
    <p className="text-sm text-slate-800">Vyfoťte jednu stránku nebo nahrajte její fotku. Originál se přiloží k zápisu, rozpoznané údaje nejdříve zkontrolujete. Nic se samo nepotvrdí.</p>
    <div className="flex flex-wrap gap-2">
      <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 font-semibold text-white focus-within:ring-2 focus-within:ring-amber-500">
        <Camera className="h-5 w-5" /> Vyfotit dokument
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) process(file); }} data-testid="ocr-photo-input" />
      </label>
      <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border-2 border-slate-900 bg-white px-4 font-semibold">
        <ImagePlus className="h-5 w-5" /> Vybrat fotografii
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) process(file); }} data-testid="ocr-gallery-input" />
      </label>
    </div>
    {busy && <div role="status" className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="h-4 w-4 animate-spin" /> Ukládám fotografii a rozpoznávám text…</div>}
    {photo && !busy && <p className="text-sm text-slate-700">Fotografie: {photo.name || "deník"} {attached ? "· uložena jako příloha konceptu" : "· nebyla přiložena"}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{error}</p>}
    {photo && !busy && <button type="button" className="text-sm font-semibold underline" onClick={() => process(photo, attached)} data-testid="ocr-retry">Zopakovat rozpoznání fotografie</button>}
    {!!fields.length && <div className="space-y-3 rounded-lg border border-slate-300 bg-white p-3" data-testid="ocr-review">
      <h3 className="font-bold">Zkontrolujte návrh přepisu</h3>
      <p className="text-sm text-amber-900">Zaškrtnutá pole se vloží až po klepnutí na tlačítko. Již vyplněná pole se automaticky neoznačují.</p>
      {fields.map(f => <div className="grid gap-1 sm:grid-cols-[auto_1fr]" key={f.key}>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.checked} onChange={e => update(f.key, "checked", e.target.checked)} className="h-5 w-5" data-testid={`ocr-check-${f.key}`} />
          {f.label}
        </label>
        <input value={f.value} onChange={e => update(f.key, "value", e.target.value)} className="min-h-11 min-w-0 w-full rounded-lg border border-slate-300 px-3 text-base" aria-label={`Opravit: ${f.label}`} />
      </div>)}
      <button type="button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 font-semibold text-white disabled:opacity-40" onClick={apply} disabled={!fields.some(f => f.checked)} data-testid="ocr-apply"><FileCheck2 className="h-5 w-5" />Vložit označené údaje do formuláře</button>
    </div>}
    {warning && <p role="status" className="text-sm font-semibold text-amber-950">{warning}</p>}
    {!!raw && <details className="rounded-lg border border-slate-300 bg-white p-3 text-sm"><summary className="cursor-pointer font-semibold">Zobrazit celý rozpoznaný text</summary><pre className="mt-2 whitespace-pre-wrap break-words font-sans">{raw}</pre></details>}
  </div>;
}
