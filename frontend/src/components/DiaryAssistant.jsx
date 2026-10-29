import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/language";
import { ASSISTANT_KEYS, createLocalAssistant, manualAssistantAnswer, nextAssistantQuestion, parseAssistantOutput, recordValue, selectedAssistantPatch } from "@/lib/localAssistant";

const labels = {
  customer: ["Objednatel", "Замовник"], job: ["Zakázka", "Замовлення"], diesel: ["Nafta (l)", "Дизель (л)"], hydraulic: ["Hydraulický olej (l)", "Гідравлічне масло (л)"], oil: ["Motorový olej (l)", "Моторне масло (л)"], serviceDescription: ["Popis servisu", "Опис сервісу"], repairDescription: ["Opravy / závady", "Ремонт / несправності"], vehiclesTo: ["Vozidlo tam", "Транспорт туди"], vehiclesFrom: ["Vozidlo zpět", "Транспорт назад"], crew: ["Posádka", "Бригада"], accommodation: ["Ubytování (yes/no)", "Проживання (yes/no)"], notes: ["Poznámky", "Примітки"],
  date: ["Datum", "Дата"], machine: ["Stroj", "Машина"], site: ["Pracoviště", "Об’єкт"], work: ["Provedená práce", "Виконана робота"],
  mthStart: ["Počáteční MTH", "Початковий MTH"], mthEnd: ["Konečné MTH", "Кінцевий MTH"], start: ["Začátek směny", "Початок зміни"], end: ["Konec směny", "Кінець зміни"],
};
const button = "min-h-11 rounded-lg border border-slate-400 px-3 py-2 text-sm font-semibold disabled:opacity-50";
export function DiaryAssistant({ record, onApply, machines = [], photoRequest = null }) {
  const { language } = useLanguage();
  const uk = language === "uk";
  const say = (cs, ua) => uk ? ua : cs;
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [fields, setFields] = useState({});
  const [selected, setSelected] = useState({});
  const [rejected, setRejected] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [notice, setNotice] = useState("");
  const engine = useRef(null), epoch = useRef(0), mounted = useRef(true), operation = useRef(0);
  const signature = JSON.stringify([record?.id, ...ASSISTANT_KEYS.map(k => recordValue(record, k))]);
  const busy = ["loading", "generating", "stopping"].includes(status);
  const [questionKey, question, optional] = nextAssistantQuestion(record, language, skipped);
  const answerHint = questionKey === "date" ? say("Napiš datum, například 29. 10. 2026.", "Введи дату, наприклад 29. 10. 2026.")
    : ["start", "end"].includes(questionKey) ? say("Napiš čas, například 7:00.", "Введи час, наприклад 7:00.")
    : ["mthStart", "mthEnd", "diesel", "hydraulic", "oil"].includes(questionKey) ? say("Napiš pouze číslo bez jednotky.", "Введи лише число без одиниці виміру.")
    : questionKey === "machine" ? say("Napiš přesný název stroje z evidence.", "Введи точну назву машини з реєстру.")
    : questionKey === "accommodation" ? say("Napiš ano nebo ne.", "Введи так або ні.")
    : say("Napiš pouze odpověď na uvedenou otázku.", "Введи лише відповідь на поточне запитання.");
  const choosePhoto = useCallback(file => {
    if (!file) return;
    setError(""); setFields({}); setSelected({}); setRejected([]);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
      setError(uk ? "Обери JPG, PNG або WEBP до 10 МБ." : "Vyber JPG, PNG nebo WEBP do 10 MB."); return;
    }
    setPhotoUrl(URL.createObjectURL(file));
  }, [uk]);

  useEffect(() => {
    mounted.current = true;
    // These refs track async operations, not DOM nodes; cleanup must invalidate the latest run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { mounted.current = false; ++epoch.current; engine.current?.dispose(); engine.current = null; };
  }, []);
  useEffect(() => {
    ++epoch.current; engine.current?.cancel();
    setFields({}); setSelected({}); setRejected([]); setSource(""); setPhotoUrl(""); setError(""); setNotice("");
  }, [signature]);
  useEffect(() => { setSkipped([]); }, [record?.id]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);
  useEffect(() => {
    if (!photoRequest?.file) return;
    ++epoch.current; engine.current?.cancel();
    choosePhoto(photoRequest.file);
    setSource(""); setNotice("");
  }, [photoRequest, choosePhoto]);

  async function load() {
    if (busy) return;
    const token = ++epoch.current; operation.current = token;
    const current = engine.current || createLocalAssistant(); engine.current = current;
    setStatus("loading"); setError(""); setNotice(""); setProgress("");
    try {
      await current.load(p => {
        if (mounted.current && token === epoch.current) setProgress(p.file ? `${p.file.split("/").pop()}${Number.isFinite(p.progress) ? ` · ${Math.round(p.progress)} %` : ""}` : "");
      });
      if (mounted.current && token === epoch.current) setStatus("ready");
    } catch (e) {
      if (mounted.current && token === epoch.current) {
        const reason = e.code === "GPU_ADAPTER_UNAVAILABLE" ? say("Prohlížeč neposkytl grafický adaptér pro WebGPU. Místní AI zde nemůže běžet.", "Браузер не надав графічний адаптер WebGPU. Локальний ШІ тут не може працювати.")
          : e.code === "GPU_FP16_UNAVAILABLE" ? say("Grafický adaptér nepodporuje shader-f16, který tento model vyžaduje.", "Графічний адаптер не підтримує shader-f16, потрібний цій моделі.")
          : e.code === "GPU_UNAVAILABLE" ? say("Prohlížeč nepodporuje WebGPU.", "Браузер не підтримує WebGPU.")
          : say("Model se nepodařilo stáhnout nebo spustit. Ověř připojení a volnou paměť zařízení.", "Не вдалося завантажити або запустити модель. Перевір з’єднання й вільну пам’ять пристрою.");
        setError(e.name === "AbortError" ? "" : `${reason} ${say("Na otázku můžeš odpovědět tlačítkem bez AI; fotografie se tím nepřepisuje.", "Можна відповісти на запитання кнопкою без ШІ; це не переписує фотографію.")}`);
        setStatus("idle");
      }
    } finally {
      if (mounted.current && operation.current === token && token !== epoch.current) setStatus("idle");
    }
  }
  async function generate() {
    if (busy || status !== "ready" || (!source.trim() && !photoUrl)) return;
    const token = ++epoch.current; operation.current = token;
    setStatus("generating"); setError(""); setNotice(""); setFields({}); setSelected({}); setRejected([]);
    const current = engine.current; current.resume();
    try {
      const output = await current.generate({ source, photoUrl, machines, question });
      if (!mounted.current || token !== epoch.current) return;
      const result = parseAssistantOutput(output, machines);
      setFields(result.patch); setRejected(result.rejected);
      // Every field requires an explicit human selection, including previously empty fields.
      setSelected({});
      if (!Object.keys(result.patch).length) setError(say("AI bezpečně nerozpoznala žádné údaje. Zkus detailnější fotografii nebo vyplň pole ručně.", "ШІ не розпізнав дані достатньо надійно. Спробуй чіткіше фото або заповни поля вручну."));
    } catch (e) {
      if (mounted.current && token === epoch.current && e.name !== "AbortError") setError(say("Přepis se nepodařil nebo model nevrátil platná data. Nic se nezměnilo. Zkus kratší odpověď či ostřejší snímek.", "Не вдалося переписати або модель повернула некоректні дані. Дані не змінено. Спробуй коротшу відповідь або чіткіше фото."));
    } finally { if (mounted.current && operation.current === token) setStatus("ready"); }
  }
  function cancel() {
    ++epoch.current; engine.current?.cancel(); setStatus("stopping"); setFields({}); setSelected({});
    setNotice(say("Ruším výpočet. Probíhající stažení souboru může ještě doběhnout. Žádné údaje se nevloží.", "Скасовую обчислення. Поточне завантаження файлу може завершитися. Дані не будуть вставлені."));
  }
  function prepareManualAnswer() {
    if (busy || !questionKey) return;
    setFields({}); setSelected({}); setRejected([]); setError("");
    try {
      setFields(manualAssistantAnswer(questionKey, source, machines));
      setNotice(say("Připravena pouze odpověď na aktuální otázku bez AI. Porovnej ji a označ k vložení. Fotografie nebyla zpracována.", "Підготовлено лише відповідь на поточне запитання без ШІ. Перевір і познач для вставлення. Фото не оброблялося."));
    } catch (_) {
      setError(`${say("Odpověď neodpovídá poli.", "Відповідь не відповідає полю.")} ${answerHint}`);
    }
  }
  function apply() {
    if (busy) return;
    try {
      const patch = selectedAssistantPatch(fields, selected, machines);
      if (!Object.keys(patch).length) return;
      onApply(patch); setFields({}); setSelected({});
      setNotice(say("Vybrané údaje byly vloženy do konceptu. Zkontroluj celý formulář; zápis není potvrzený ani podepsaný.", "Обрані дані вставлено в чернетку. Перевір весь формуляр; запис не підтверджено та не підписано."));
    } catch (_) { setError(say("Oprav označená pole. Stroj musí být v evidenci, MTH, časy a datum musí být platné.", "Виправ обрані поля. Машина має бути в реєстрі, MTH, час і дата мають бути коректними.")); }
  }
  return <section className="space-y-3 rounded-xl border-2 border-sky-300 bg-sky-50 p-4" data-testid="diary-assistant">
    <h2 className="text-lg font-bold">{say("AI pomocník zdarma · místní zpracování", "Безплатний ШІ-помічник · локальна обробка")}</h2>
    <p className="text-sm">{say("Open source Qwen3.5 (Apache 2.0) běží v tomto zařízení. První spuštění stáhne přibližně 0,9 GB a potřebuje další volnou paměť. Stahování probíhá z Hugging Face; text ani fotografii jim neposíláme. Přepis rukopisu může chybovat. Vše před vložením zkontroluj.", "Open source Qwen3.5 (Apache 2.0) працює на цьому пристрої. Перший запуск завантажує приблизно 0,9 ГБ і потребує додаткової вільної пам’яті. Модель завантажується з Hugging Face; текст і фото туди не надсилаються. Рукопис може бути розпізнаний помилково. Перевір дані перед вставленням.")}</p>
    {!navigator.gpu && <p role="status" className="text-sm font-semibold">{say("Tento prohlížeč nepodporuje WebGPU. Použij aktuální podporovaný prohlížeč a zařízení, nebo pokračuj ručně podle otázek.", "Цей браузер не підтримує WebGPU. Використай сумісний сучасний браузер і пристрій або продовжуй вручну за запитаннями.")}</p>}
    {status === "idle" && <button type="button" className={button} onClick={load} disabled={!navigator.gpu} data-testid="assistant-load">{say("Stáhnout a spustit místní AI", "Завантажити й запустити локальний ШІ")}</button>}
    {status === "ready" && <p role="status" className="text-sm font-semibold">{say("Místní AI je připravená.", "Локальний ШІ готовий.")}</p>}
    {busy && <div role="status" className="space-y-2 text-sm"><p>{status === "loading" ? say("Stahuji a připravuji model…", "Завантажую й готую модель…") : status === "stopping" ? say("Ruším…", "Скасовую…") : say("Zpracovávám na tomto zařízení…", "Обробляю на цьому пристрої…")}</p>{status === "loading" && <p className="break-all">{progress}</p>}{status !== "stopping" && <button type="button" onClick={cancel} className={button}>{say("Zrušit", "Скасувати")}</button>}</div>}
    <div className="rounded-lg bg-white p-3"><p className="text-sm font-semibold">{say("Další otázka", "Наступне запитання")}</p><p>{question}</p>{optional && <div className="mt-2 flex items-center gap-2 text-sm"><span>{say("Nepovinné", "Необов’язково")}</span><button type="button" className={button} disabled={busy} onClick={() => { setSkipped(s => [...s, questionKey]); setSource(""); }}>{say("Přeskočit otázku", "Пропустити запитання")}</button></div>}</div>
    <label className="block text-sm font-semibold">{say("Odpověď nebo celý dnešní zápis", "Відповідь або весь сьогоднішній запис")}<textarea value={source} onChange={e => { setSource(e.target.value); setFields({}); setSelected({}); }} maxLength={6000} disabled={busy} className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-2 font-normal" data-testid="assistant-source" /></label>
    {questionKey && <p className="text-sm">{answerHint}</p>}
    {questionKey && <button type="button" onClick={prepareManualAnswer} disabled={busy || !source.trim()} className={button} data-testid="assistant-manual">{say("Použít odpověď na otázku bez AI", "Використати відповідь на запитання без ШІ")}</button>}
    <label className="block text-sm font-semibold">{say("Přidat fotografii deníku (zůstane v zařízení)", "Додати фото журналу (залишається на пристрої)")}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="mt-1 block w-full text-sm" onChange={e => { choosePhoto(e.target.files?.[0]); e.target.value = ""; }} /></label>
    {photoUrl && <div className="space-y-2"><img src={photoUrl} alt={say("Původní fotografie pro kontrolu přepisu", "Оригінальне фото для перевірки перепису")} className="max-h-96 w-full rounded-lg border object-contain bg-white" /><button type="button" disabled={busy} className={button} onClick={() => { setPhotoUrl(""); setFields({}); }}>{say("Odebrat fotografii", "Прибрати фото")}</button></div>}
    <button type="button" onClick={generate} disabled={status !== "ready" || (!source.trim() && !photoUrl)} className={`${button} bg-slate-900 text-white`} data-testid="assistant-generate">{say("Zpracovat odpověď / fotografii", "Опрацювати відповідь / фото")}</button>
    {Object.keys(fields).length > 0 && <div className="space-y-3 rounded-lg border bg-white p-3" data-testid="assistant-review"><h3 className="font-bold">{say("Zkontroluj a označ pole k vložení", "Перевір і познач поля для вставлення")}</h3>{ASSISTANT_KEYS.filter(k => Object.hasOwn(fields, k)).map(k => <div key={k} className="space-y-1"><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!selected[k]} onChange={e => setSelected(s => ({ ...s, [k]: e.target.checked }))} data-testid={`assistant-check-${k}`} />{labels[k][uk ? 1 : 0]}</label><input aria-label={labels[k][uk ? 1 : 0]} value={fields[k]} onChange={e => setFields(f => ({ ...f, [k]: e.target.value }))} className="min-h-11 w-full rounded border p-2" /><p className="break-words text-xs text-slate-600">{say("Ve formuláři:", "У формулярі:")} {String(recordValue(record, k)) || "—"}</p></div>)}<button type="button" className={button} onClick={apply} disabled={busy || !Object.values(selected).some(Boolean)} data-testid="assistant-apply">{say("Vložit pouze označené údaje", "Вставити лише позначені дані")}</button></div>}
    {rejected.length > 0 && <p role="alert" className="text-sm text-amber-950">{say("Neplatné nebo nejednoznačné údaje nebyly nabídnuty:", "Некоректні чи неоднозначні дані не запропоновано:")} {rejected.map(k => labels[k][uk ? 1 : 0]).join(", ")}</p>}
    {(fields.serviceDescription || fields.repairDescription) && <p className="text-sm font-semibold">{say("Popis servisu nenahrazuje časový interval. Časy servisu a opravy zkontroluj samostatně v příslušné sekci formuláře.", "Опис сервісу не замінює часовий інтервал. Час сервісу й ремонту перевір окремо у відповідному розділі формуляра.")}</p>}
    {error && <p role="alert" className="rounded bg-red-100 p-3 text-sm text-red-900">{error}</p>}
    {notice && <p role="status" className="text-sm font-semibold">{notice}</p>}
    <p className="text-xs text-slate-700">{say("Fotografie zde slouží pouze místní AI. Chceš-li ji uchovat jako podklad zápisu, přidej ji také do příloh. MTH nejsou odpracované hodiny. Pomocník sám nic neukládá, nepotvrzuje ani nepodepisuje.", "Фото тут використовується лише локальним ШІ. Щоб зберегти його як підставу запису, додай його також до додатків. MTH не є відпрацьованими годинами. Помічник нічого сам не зберігає, не підтверджує й не підписує.")}</p>
  </section>;
}
