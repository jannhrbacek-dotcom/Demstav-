import React, { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, FileCheck2 } from "lucide-react";
import { http, errText } from "@/lib/api";
import { useLanguage } from "@/lib/language";
import { normalizeAssistantPatch } from "@/lib/localAssistant";

const VALID = new Set(["date", "machine", "site", "work", "mthStart", "mthEnd", "start", "end"]);

/** Deliberately never saves/validates a record. OCR only proposes edits after human review. */
export function PhotoDiaryOcr({ record, onAttach, onApply, onUseLocalAI, machines = [] }) {
  const { t, language } = useLanguage();
  const localized = (cs, uk) => language === "uk" ? uk : cs;
  const [fields, setFields] = useState([]);
  const [raw, setRaw] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [attached, setAttached] = useState(false);
  const [visionAvailable, setVisionAvailable] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    let mounted = true;
    http.get("/ocr/diary/vision/status").then(({ data }) => {
      if (mounted) setVisionAvailable(Boolean(data?.enabled));
    }).catch(() => { if (mounted) setVisionAvailable(false); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    ++generation.current;
    setFields([]); setRaw(""); setWarning(""); setError("");
    setBusy(false); setPhoto(null); setAttached(false);
    // This is an async operation counter, not a DOM ref; invalidate the latest request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { ++generation.current; };
  }, [record?.id]);

  async function process(file, isAttached = false) {
    if (!file) return;
    const epoch = ++generation.current;
    setBusy(true); setError(""); setFields([]); setRaw(""); setWarning("");
    setPhoto(file); setAttached(isAttached);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
      setError(t("Pro automatický přepis vyberte JPG/PNG/WEBP do 10 MB."));
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
        ...f, checked: false,
      })));
      if (!data.text) setError(t("Fotografie nebyla čitelná. Zkuste ostrý snímek při dobrém světle."));
      else if (!(data.fields || []).filter(f => VALID.has(f.key)).length) setError(t("Základní OCR nerozpoznalo údaje pro formulář. Výpis níže může obsahovat pouze části tiskopisu a nesprávně přečtený rukopis."));
    } catch (e) {
      if (generation.current === epoch) setError(errText(e, t("Přepis fotografie se nezdařil. Příloha zůstává v zápisu.")));
    } finally {
      if (generation.current === epoch) setBusy(false);
    }
  }


  async function processVision() {
    if (!photo || !attached || !visionAvailable) return;
    const epoch = ++generation.current;
    setBusy(true); setError(""); setWarning(""); setFields([]); setRaw("");
    try {
      const form = new FormData();
      form.append("file", photo, photo.name || "denik.jpg");
      form.append("consent", "true");
      const { data } = await http.post("/ocr/diary/vision", form, { timeout: 90000 });
      if (generation.current !== epoch) return;
      const proposals = (data.fields || []).filter(f => VALID.has(f.key)).map(f => ({ ...f, checked: false }));
      setFields(proposals);
      setRaw(data.text || "");
      setWarning(data.warning || "");
      if (!proposals.length) setError(localized(
        "Obrazová AI nenašla jednoznačně čitelné údaje. Doplňte je podle fotografie ručně.",
        "Візуальний ШІ не знайшов однозначно читабельних даних. Заповніть за фотографією вручну."
      ));
    } catch (e) {
      if (generation.current === epoch) setError(errText(e, localized(
        "Přepis externí AI se nezdařil. Příloha zůstává uložená.",
        "Зовнішній ШІ не зміг розпізнати фото. Вкладення збережено."
      )));
    } finally {
      if (generation.current === epoch) setBusy(false);
    }
  }

  const update = (key, prop, value) => setFields(prev => prev.map(f => f.key === key ? { ...f, [prop]: value } : f));
  const apply = () => {
    const selected = fields.filter(f => f.checked && String(f.value || "").trim());
    if (!selected.length) return;
    const submitted = Object.fromEntries(selected.map(f => [f.key, String(f.value).trim()]));
    const { patch, rejected } = normalizeAssistantPatch(submitted, machines);
    if (rejected.length || Object.keys(patch).length !== selected.length) {
      const fieldNames = selected.filter(f => rejected.includes(f.key)).map(f => t(f.label));
      setError(localized(
        "Neplatné nebo rozporné hodnoty: " + (fieldNames.join(", ") || "zkontrolujte označené údaje") + ". Stroj musí odpovídat evidenci, MTH a datum musí být platné.",
        "Некоректні або суперечливі значення: " + (fieldNames.join(", ") || "перевірте вибрані дані") + ". Машина має бути в реєстрі, дата й мотогодини мають бути правильні."
      ));
      return;
    }
    if ((patch.start && !patch.end) || (patch.end && !patch.start)) {
      setError(t("Čas směny použijte pouze při potvrzeném začátku i konci."));
      return;
    }
    setError("");
    onApply(patch);
    setWarning(t("Údaje byly vloženy do rozepsaného formuláře. Před potvrzením zápisu zkontrolujte MTH, čas a datum."));
    setFields(prev => prev.map(f => ({ ...f, checked: false })));
  };

  return <div className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4" data-testid="photo-diary-ocr">
    <h2 className="text-lg font-bold text-slate-900">{t("Přepsat papírový deník / šichtovnici")}</h2>
    <p className="text-sm text-slate-800">{t("Vyfoťte jednu stránku nebo nahrajte její fotku. Originál se přiloží k zápisu, rozpoznané údaje nejdříve zkontrolujete. Nic se samo nepotvrdí.")}</p>
    <p className="text-sm font-semibold text-amber-950">{t("Základní OCR je určené hlavně pro tištěný text. Rukopis a tabulky mohou být nečitelné. Pro zkoušku rukopisu použijte místní AI; i její návrh je nutné ověřit.")}</p>
    <div className="flex flex-wrap gap-2">
      <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 font-semibold text-white focus-within:ring-2 focus-within:ring-amber-500">
        <Camera className="h-5 w-5" /> {t("Vyfotit dokument")}
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) process(file); }} data-testid="ocr-photo-input" />
      </label>
      <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border-2 border-slate-900 bg-white px-4 font-semibold">
        <ImagePlus className="h-5 w-5" /> {t("Vybrat fotografii")}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) process(file); }} data-testid="ocr-gallery-input" />
      </label>
    </div>
    {busy && <div role="status" className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="h-4 w-4 animate-spin" /> {t("Ukládám fotografii a rozpoznávám text…")}</div>}
    {photo && !busy && <p className="text-sm text-slate-700">{t("Fotografie:")} {photo.name || "deník"} {t(attached ? "· uložena jako příloha konceptu" : "· nebyla přiložena")}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{error}</p>}
    {photo && !busy && <button type="button" className="text-sm font-semibold underline" onClick={() => process(photo, attached)} data-testid="ocr-retry">{t("Zopakovat rozpoznání fotografie")}</button>}
    {photo && attached && !busy && visionAvailable && <div className="rounded-lg border-2 border-sky-700 bg-white p-3 space-y-2" data-testid="ocr-cloud-option">
      <p className="text-sm text-slate-900">{localized(
        "Přesnější pokus o čtení rukopisu přes externí obrazovou AI. Po kliknutí odešlete fotografii společnosti OpenAI. Volání API může být zpoplatněno. Výsledek budete muset zkontrolovat.",
        "Спроба розпізнати рукопис за допомогою зовнішнього візуального ШІ. Після натискання фото буде надіслано OpenAI. Використання API може бути платним. Результат потрібно перевірити."
      )}</p>
      <button type="button" className="min-h-12 w-full rounded-lg bg-sky-800 px-3 py-2 font-semibold text-white" onClick={processVision} data-testid="ocr-use-cloud-vision">{localized(
        "Souhlasím s odesláním fotografie externí AI a chci přepsat rukopis",
        "Погоджуюся на надсилання фото зовнішньому ШІ для розпізнавання рукопису"
      )}</button>
    </div>}
    {photo && attached && !busy && onUseLocalAI && <button type="button" className="flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-sky-700 bg-sky-50 px-3 font-semibold text-sky-950" onClick={() => onUseLocalAI(photo)} data-testid="ocr-use-local-ai">{t("Zkusit stejnou fotografii místní AI")}</button>}
    {!!fields.length && <div className="space-y-3 rounded-lg border border-slate-300 bg-white p-3" data-testid="ocr-review">
      <h3 className="font-bold">{t("Zkontrolujte návrh přepisu")}</h3>
      <p className="text-sm text-amber-900">{t("Porovnejte každé pole s fotografií. Nic není předem označené; vloží se pouze vámi zaškrtnuté údaje.")}</p>
      {fields.map(f => <div className="grid gap-1 sm:grid-cols-[auto_1fr]" key={f.key}>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.checked} onChange={e => update(f.key, "checked", e.target.checked)} className="h-5 w-5" data-testid={`ocr-check-${f.key}`} />
          {t(f.label)}
        </label>
        <input value={f.value} onChange={e => update(f.key, "value", e.target.value)} className="min-h-11 min-w-0 w-full rounded-lg border border-slate-300 px-3 text-base" aria-label={`${t("Opravit:")} ${t(f.label)}`} />
      </div>)}
      <button type="button" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 font-semibold text-white disabled:opacity-40" onClick={apply} disabled={!fields.some(f => f.checked)} data-testid="ocr-apply"><FileCheck2 className="h-5 w-5" />{t("Vložit označené údaje do formuláře")}</button>
    </div>}
    {warning && <p role="status" className="text-sm font-semibold text-amber-950">{t(warning)}</p>}
    {!!raw && <details className="rounded-lg border border-slate-300 bg-white p-3 text-sm"><summary className="cursor-pointer font-semibold">{t("Zobrazit celý rozpoznaný text")}</summary><pre className="mt-2 whitespace-pre-wrap break-words font-sans">{raw}</pre></details>}
  </div>;
}
