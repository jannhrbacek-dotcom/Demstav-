import BreakRequests from "@/components/BreakRequests";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Camera, OctagonAlert, History, ArrowLeft, Wrench, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DictateTextarea } from "@/components/DictateTextarea";
import { PhotoDiaryOcr } from "@/components/PhotoDiaryOcr";
import MachinePicker from "@/components/MachinePicker";
import { useLanguage } from "@/lib/language";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Section, Field, PageHeader } from "@/components/Section";
import { IntervalEditor } from "@/components/IntervalEditor";
import { SignaturePad } from "@/components/SignaturePad";
import { StatusBadge } from "@/components/StatusBadge";
import { AttachmentThumb } from "@/components/AttachmentThumb";
import { remainingText } from "@/lib/serviceNotify";
import { prefillMachine } from "@/lib/machinePrefill";
import { useAuth } from "@/lib/auth";
import { useCached, mergedRecords } from "@/lib/data";
import { http } from "@/lib/api";
import { useSync, saveRecordLocal, addAttachment, discardLocalRecord } from "@/lib/sync";
import { useRecordDraft } from "@/lib/recordDraft";
import { newId, pragueDate, ATT_KINDS } from "@/lib/format";
import { timeBreakdown, fmtH } from "@/lib/worktime";
import { durationMinutes, journeyText } from "@/lib/journey";

const SERVICE_ACTOR_OPTIONS = [
  { value: "operator", label: "Strojník" },
  { value: "operator_workshop", label: "Strojník včetně dílny" },
  { value: "workshop", label: "Dílna – výjezd" },
  { value: "external", label: "Externí servis" },
];
function canUserDoIntervalService(user) {
  return !!user && (["owner", "operations_manager"].includes(user.role) ||
    ["mechanik", "strojnik_mechanik", "externi_servis"].includes(user.position));
}

const blank = (user, last, date) => ({
  id: newId(), revision: 0, status: "draft", date, shift: "Denní", operator: user?.name || "", crew: "",
  machine: last?.machine || "", customer: last?.customer || "", site: last?.site || "", job: last?.job || "", drive: "", driveMinutes: null, journeyRole: "", chipStatus: "unverified",
  vehiclesTo: last?.vehiclesTo || "", vehiclesFrom: last?.vehiclesFrom || "", accommodation: last?.accommodation || "",
  billing: [{ start: "", end: "" }], service: [], downtime: [], travel: [], downtimeReason: "", workTimeMode: "shift", work: "", mthStart: last?.status === "confirmed" && last.date <= date ? last.mthEnd || "" : "", mthEnd: "",
  dailyCheck: false, accessoryCheck: false, equipmentCheck: false, fit: "unknown", notes: "", handover: "", handoverName: "", handoverSignature: "", operatorSignature: "",
  diesel: "", hydraulic: "", oil: "", otherFluid: "", serviceDescription: "", repairDescription: "", serviceBy: "", externalCompany: "", workshopSignature: "",
  faults: [], attachments: [], intervalService: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

const num = (v) => (v && /^\d+(?:[.,]\d{1,3})?$/.test(v) ? Number(v.replace(",", ".")) : null);
function validate(r, confirm, user) {
  const e = [];
  if (confirm && r.intervalService && (!r.machine || !r.mthEnd)) e.push("Pravidelný servis dle intervalu: vyplňte stroj a konečný stav MTH.");
  if (confirm && r.intervalService) {
    const okUser = canUserDoIntervalService(user);
    if (!okUser) e.push("Pravidelný servis (500 mth) může zapsat jen oprávněný mechanik nebo vedoucí provozu.");
  }
  const b = timeBreakdown(r);
  if (r.drive && (r.journeyEditing || r.drive.includes(":")) && durationMinutes(r.drive) == null) e.push("Jízda: zadejte dobu H:MM nejvýše 24:00.");
  for (const k of ["mthStart", "mthEnd", "diesel", "hydraulic", "oil"]) if (r[k] && num(r[k]) === null) e.push(`Pole ${k === "mthStart" ? "MTH začátek" : k === "mthEnd" ? "MTH konec" : k}: zadejte číslo.`);
  (r.travel || []).forEach((i, n) => { if (confirm && (!i.from || !i.to)) e.push(`Přejezd, řádek ${n + 1}: doplňte odkud (bod A) a kam (bod B).`); });
  for (const [k, l] of [["billing", "pracovní doba"], ["service", "servis"], ["downtime", "prostoj"], ["travel", "přejezd"]]) (r[k] || []).forEach((i, n) => { if ((confirm && (!i.start || !i.end)) || (i.start && i.end && i.start === i.end)) e.push(`Doplňte platný čas od–do (${l}, řádek ${n + 1}).`); });
  r.faults.forEach((f, n) => { if (!f.description.trim()) e.push(`Doplňte popis závady ${n + 1}.`); if (confirm && !f.time) e.push(`Doplňte čas nahlášení závady ${n + 1}.`); if (confirm && f.resolved && !f.resolution.trim()) e.push(`Doplňte způsob odstranění závady ${n + 1}.`); });
  if (confirm) {
    if (!r.machine.trim()) e.push("Vyberte stroj.");
    if (!r.operator.trim()) e.push("Doplňte jméno obsluhy.");
    if (!r.billing.length) e.push("Doplňte alespoň jeden úsek pracovní doby.");
    if (!r.mthStart || !r.mthEnd) e.push("Povinnost psát začátek a konec MTH.");
    else if (num(r.mthEnd) !== null && num(r.mthStart) !== null && num(r.mthEnd) < num(r.mthStart)) e.push("Konečný stav MTH nesmí být nižší než počáteční.");
    if (b.serviceOutsideShift) e.push("Servis musí ležet uvnitř pracovní doby.");
    if (b.downtimeOutsideShift) e.push("Prostoj musí ležet uvnitř pracovní doby.");
    if (b.travelOutsideShift) e.push("Přejezd musí ležet uvnitř pracovní doby.");
    if (b.ambiguousDay) e.push("Úseky zahrnují 24 h a více – rozdělte je do dnů.");
    if (b.serviceHours > 0 && !r.serviceDescription.trim() && !r.repairDescription.trim()) e.push("K hodinám servisu doplňte popis provedené práce – bez popisu nelze čas započítat.");
    if (b.serviceHours > 0 && !r.serviceBy) e.push("Uveďte, kdo servis provedl.");
    if (r.serviceBy === "external" && !r.externalCompany.trim()) e.push("Uveďte název cizí servisní firmy.");
  }
  return e;
}

export default function RecordForm() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const nav = useNavigate();
  const s = useSync();
  const machines = useCached("/machines");
  const wps = useCached("/workplaces");
  const mine = useCached("/records?mine=1&limit=200");
  const [rec, setRec] = useState(null);
  const [server, setServer] = useState(null);
  const [draftRevision, setDraftRevision] = useState(null);
  const [additional, setAdditional] = useState(false);
  const draftKey = `u:${user.id}:record-form:${id || "new"}`;
  const localDraft = useRecordDraft(draftKey, rec, draftRevision ?? server?.revision ?? 0);
  useEffect(() => { setRec(null); setServer(null); setDraftRevision(null); }, [draftKey]);

  const [errors, setErrors] = useState([]);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [attKind, setAttKind] = useState("photo");
  const [attKm, setAttKm] = useState("");
  // Ano/Ne přepínače – řídí viditelnost sekcí servis a přejezd.
  const [continueMachine, setContinueMachine] = useState(false);

  const sugg = useMemo(() => {
    const merged = mergedRecords(mine.data, s.records).map((x) => x.record)
      .sort((a, b) => (b.date + (b.updatedAt || b.updated_at || "")).localeCompare(a.date + (a.updatedAt || a.updated_at || "")));
    const uniq = (k) => [...new Set(merged.map((r) => (r?.[k] || "").toString().trim()).filter(Boolean))].slice(0, 50);
    return {
      customer: uniq("customer"), site: uniq("site"), job: uniq("job"),
      operator: uniq("operator"), crew: uniq("crew"), vehiclesTo: uniq("vehiclesTo"), vehiclesFrom: uniq("vehiclesFrom"),
      downtimeReason: uniq("downtimeReason"), work: uniq("work"),
    };
  }, [mine.data, s.records]);
  const lastRecord = useMemo(() => mergedRecords(mine.data, s.records)[0]?.record || null, [mine.data, s.records]);

  useEffect(() => {
    if (rec || mine.loading || !localDraft.loaded) return;
    if (!id) {
      const last = mergedRecords(mine.data, s.records)[0]?.record;
      const nr = localDraft.value?.record || blank(user, last, pragueDate());
      if (localDraft.value) setDraftRevision(localDraft.value.baseRevision ?? 0);
      setRec(nr);
      return;
    }
    const loc = s.records[id];
    const srv = (mine.data || []).find((r) => r.id === id);
    const load = async () => {
      let full = srv;
      try { full = (await http.get(`/records/${id}`)).data; } catch { /* offline */ }
      if (full && full.owner_id && full.owner_id !== user.id && user.role !== "operations_manager") { nav(`/detail/${id}`, { replace: true }); return; }
      setServer(full || null);
      const restored = localDraft.value;
      const useDraft = restored && (!loc || restored.savedAt > loc.savedAt);
      const loaded = useDraft ? { ...restored.record } : loc ? { ...loc.record } : full ? { ...full } : null;
      if (useDraft) setDraftRevision(restored.baseRevision ?? 0);
      setRec(loaded);
      // Předvyplníme Ano/Ne podle existujících dat.
      if (loaded) {
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mine.loading, localDraft.loaded]);

  const breakApprovals = useCached("/break-requests?mine=1");
  const effectiveRec = useMemo(() => {
    if (!rec) return null;
    const approved = (breakApprovals.data || []).filter(r => (!rec.owner_id || rec.owner_id === user.id) && r.status === "approved" && r.date === rec.date).sort((a, b) => (b.decision?.at || "").localeCompare(a.decision?.at || ""))[0];
    return approved ? { ...rec, approvedBreaks: approved.breaks } : rec;
  }, [rec, breakApprovals.data, user.id]);
  const bd = useMemo(() => (effectiveRec ? timeBreakdown(effectiveRec) : null), [effectiveRec]);
  const local = rec ? s.records[rec.id] : null;
  const serverConfirmed = (server?.status || local?.record?.status) === "confirmed" && (local?.serverRevision || server?.revision || 0) > 0;
  const status = local ? local.localState : server ? (server.status === "confirmed" ? "confirmed" : "draft") : "local";
  const autoMth = useRef(null);
  if (!rec) return <div className="py-10 text-center text-slate-600" data-testid="record-loading">{localDraft.error || (mine.loading || !localDraft.loaded ? "Načítám…" : "Zápis nenalezen.")}</div>;

  const set = (k, v) => setRec((r) => { const next = { ...r, [k]: v }; if (k === "date" && v !== r.date) delete next.approvedBreaks; return next; });
  // Při výběru stroje předvyplní MTH začátek: konec MTH z posledního zápisu na tento stroj, jinak stav MTH ze seznamu strojů.
  const setMachine = (v) => setRec((r) => {
    if (v === r.machine) return r;
    if (id) return { ...r, machine: v, mthStart: "", mthEnd: "" };
    const next = prefillMachine(r, v, mergedRecords(mine.data, s.records).map(x => x.record), machines.data || []);
    autoMth.current = next.mthStart;
    return next;
  });
  const setFault = (i, k, v) => set("faults", rec.faults.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  const recentWork = [...new Set(mergedRecords(mine.data, s.records).map(x => x.record)
    .filter(x => x.machine === rec.machine && x.work?.trim()).map(x => x.work.trim()))].slice(0, 4);
  const mthDiff = num(rec.mthStart) !== null && num(rec.mthEnd) !== null ? Math.round((num(rec.mthEnd) - num(rec.mthStart)) * 1000) / 1000 : null;


  const doSave = async (confirm, correctionReason = "") => {
    const e = validate(rec, confirm, user);
    setErrors(e);
    if (e.length) { setAdditional(true); toast.error(e[0]); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const clean = { ...rec, billing: rec.billing.filter((i) => i.start || i.end), service: rec.service.filter((i) => i.start || i.end), downtime: rec.downtime.filter((i) => i.start || i.end), travel: (rec.travel || []).filter((i) => i.start || i.end || i.from || i.to) };
    try {
      await saveRecordLocal(clean, { confirm, correctionReason, baseRevision: local?.serverRevision ?? draftRevision ?? server?.revision ?? 0 });
      await localDraft.clear();
    } catch {
      toast.error("Zápis se nepodařilo bezpečně uložit v telefonu. Nezavírejte stránku a zkuste uložení znovu.");
      return;
    }
    toast.success(navigator.onLine ? (confirm ? "Zápis uložen a odesílá se k potvrzení" : "Koncept uložen a odesílá se") : "Uloženo v telefonu – čeká na odeslání");
    if (continueMachine && !id) {
      // Samostatný záznam pro každý stroj, čas a MTH nikdy nekopírujeme.
      setRec({ ...blank(user, clean, clean.date), machine: "", mthStart: "", mthEnd: "", billing: [{ start: "", end: "" }], work: "" });
      setErrors([]); setContinueMachine(false); autoMth.current = null;
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("První stroj uložen. Zadejte druhý stroj, jeho časy a vlastní MTH.");
    } else nav("/zapisy");
  };
  const onConfirm = () => (serverConfirmed ? setReasonOpen(true) : doSave(true));
  const onFile = async (ev, section = "general") => {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";
    for (const f of files) {
      if (f.size > 15 * 1024 * 1024) { toast.error(`${f.name}: soubor je větší než 15 MB.`); continue; }
      const att = await addAttachment(f, section === "general" ? { kind: attKind, km: attKm, recordId: rec.id, section } : { kind: "photo", km: "", recordId: rec.id, section });
      setRec((r) => ({ ...r, attachments: [...r.attachments, att] }));
    }
    if (section === "general") setAttKm("");
  };
  const removeAtt = (aid) => set("attachments", rec.attachments.filter((x) => x.id !== aid));
  const renderPhotos = (section, label) => {
    const list = rec.attachments.filter((a) => (a.section || "general") === section);
    return (
      <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3" data-testid={`photos-${section}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">{label} {list.length > 0 && <span className="text-slate-600" data-testid={`photos-${section}-count`}>({list.length})</span>}</div>
          <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-slate-900 bg-white px-4 font-semibold hover:bg-slate-50 focus-within:ring-2 focus-within:ring-slate-900" data-testid={`photos-${section}-add`}>
            <Camera className="h-5 w-5" />Vyfotit
            <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => onFile(e, section)} data-testid={`photos-${section}-input`} />
          </label>
        </div>
        {list.length > 0 && <div className="space-y-2">{list.map((a) => <AttachmentThumb key={a.id} att={a} onRemove={() => removeAtt(a.id)} />)}</div>}
      </div>
    );
  };
  const activeMachines = (machines.data || []).filter((m) => m.active !== false);
  const selMachine = activeMachines.find((m) => (m.label || "").trim().toLowerCase() === (rec.machine || "").trim().toLowerCase());
  const svc = (() => {
    if (!selMachine || !selMachine.service_interval_mth) return null;
    const cur = Math.max(num(rec.mthEnd) ?? -1, num(rec.mthStart) ?? -1, selMachine.current_mth ?? -1);
    if (cur < 0) return null;
    const interval = selMachine.service_interval_mth;
    const warn = selMachine.service_warn_mth ?? 100;
    const last = selMachine.last_service_mth;
    const next = last !== null && last !== undefined ? Math.max(Math.round(last / interval), 1) * interval + interval : Math.max(Math.ceil(cur / interval), 1) * interval;
    const remaining = Math.round((next - cur) * 10) / 10;
    return { label: selMachine.label, next_service_mth: next, remaining_mth: remaining, service_interval_mth: interval, service_state: remaining <= 0 ? "due" : remaining <= warn ? "soon" : "ok" };
  })();
  const wpOptions = wps.data || [];
  // Oprávnění pro pravidelný (500 mth) servis.
  const canIntervalServiceByUser = canUserDoIntervalService(user);
  const canIntervalService = canIntervalServiceByUser;


  return (
    <div className="space-y-4 pb-24">
      <PageHeader title={id ? "Úprava zápisu" : "Nový denní zápis"} subtitle="Provozní deník stroje a šichtovnice – vyplníte jednou, promítne se do obou."
        actions={<>
          <StatusBadge status={status} testid="record-status-badge" />
          {id && server && <Link to={`/detail/${rec.id}`}><Button variant="outline" className="h-10" data-testid="record-history-link"><History className="mr-1 h-4 w-4" />{t("Historie")}</Button></Link>}
          <Button variant="ghost" className="h-10" onClick={() => nav(-1)} data-testid="record-back-button"><ArrowLeft className="mr-1 h-4 w-4" />{t("Zpět")}</Button>
        </>} />
      {serverConfirmed && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950" data-testid="record-correction-note">Zápis je potvrzený (revize {local?.serverRevision || server?.revision}). Úprava vytvoří novou revizi s důvodem opravy; původní znění zůstane v historii.</div>}
      {local?.localState === "conflict" && <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950">Zápis byl mezitím změněn jinde. Konflikt vyřešte ve <Link to="/fronta" className="font-semibold underline">Frontě</Link>.</div>}
      <p role="status" className={`rounded-lg p-3 text-sm ${localDraft.error ? "bg-red-50 text-red-800" : "bg-slate-100"}`}>{localDraft.error || (!localDraft.saving && localDraft.savedAt ? "Rozpracovaný zápis uložen v telefonu. Server ho přijme až po odeslání." : "Ukládám rozpracovaný zápis v telefonu…")}</p>
      {errors.length > 0 && <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3 text-sm text-red-900" data-testid="record-errors"><div className="mb-1 font-semibold">Zkontrolujte prosím:</div><ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}

      {!id && lastRecord && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-3" data-testid="record-copy-last-banner">
          <div className="text-sm text-amber-950">
            <div className="font-semibold">Načíst údaje z posledního zápisu?</div>
            <div className="text-xs">{lastRecord.date} · {lastRecord.machine || "bez stroje"} · {lastRecord.site || "—"}. Doplní stroj, pracoviště, zakázku, SPZ, MTH začátek a další.</div>
          </div>
          <Button type="button" variant="outline" className="h-11 font-semibold" data-testid="record-copy-last-button"
            onClick={() => setRec((r) => ({ ...r,
              machine: lastRecord.machine || r.machine, customer: lastRecord.customer || r.customer, site: lastRecord.site || r.site,
              job: lastRecord.job || r.job, vehiclesTo: lastRecord.vehiclesTo || r.vehiclesTo,
              vehiclesFrom: lastRecord.vehiclesFrom || r.vehiclesFrom, accommodation: lastRecord.accommodation || r.accommodation,
              crew: lastRecord.crew || r.crew, mthStart: prefillMachine({ ...r, machine: "" }, lastRecord.machine || r.machine, mergedRecords(mine.data, s.records).map(x => x.record), machines.data || []).mthStart, shift: lastRecord.shift || r.shift,
            }))}>{t("Načíst z minula")}</Button>
        </div>
      )}

      <PhotoDiaryOcr record={rec}
        onAttach={async (file) => {
          const att = await addAttachment(file, { kind: "photo", km: "", recordId: rec.id, section: "timesheet" });
          setRec(r => ({ ...r, attachments: [...(r.attachments || []), att] }));
        }}
        onApply={(values) => {
          const { start, end, ...rest } = values;
          setRec(r => ({
            ...r, ...rest,
            ...(start && end ? { billing: [{ start, end }] } : {}),
            ...(rest.date && rest.date !== r.date ? { approvedBreaks: undefined } : {}),
          }));
          toast.success("Údaje z fotografie vloženy. Před potvrzením je zkontrolujte.");
        }} />

      <Section title="Datum, stroj a pracoviště" testid="section-basic">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Datum"><Input type="date" value={rec.date} onChange={(e) => set("date", e.target.value)} className="h-12" data-testid="record-date-input" /></Field>
          <Field label="Stroj" hint="Začněte psát typ, značku nebo evidenční číslo. Vyberte nalezený stroj.">
            <MachinePicker machines={activeMachines} value={rec.machine || ""} onChange={setMachine} />
            {activeMachines.length === 0 && <p className="mt-1 text-sm text-amber-800">{t("Žádný aktivní stroj – obraťte se na správce.")}</p>}
          </Field>
          <Field label="Pracoviště / dílna (stavba)">
            <Input list="site-list" value={rec.site} onChange={(e) => set("site", e.target.value)} className="h-12" data-testid="record-site-input" />
            <datalist id="site-list">{[...new Set([...wpOptions.map((w) => w.name), ...sugg.site])].map((v) => <option key={v} value={v} />)}</datalist>
          </Field>

        </div>
      </Section>

      <Section title="Pracovní čas" subtitle="Celá pracovní doba a prostoje" testid="section-time">
        <IntervalEditor label="Pracovní doba (celá směna)" hint="Zadejte celou směnu. Od 27. 10. 2026 se přestávky 12:00–12:30 a 15:30–16:00 odečítají automaticky pouze uvnitř směny." items={rec.billing} onChange={(v) => set("billing", v)} testid="billing" />
        <BreakRequests initialDate={rec.date} compact />
        <p className="text-sm">Odečtené přestávky: {fmtH(bd.breakHours)} h</p>
        <IntervalEditor label="Prostoje" hint="Samostatná kategorie uvnitř pracovní doby (např. čekání na materiál). Není to přestávka." items={rec.downtime} onChange={(v) => set("downtime", v)} testid="downtime" />
        {rec.downtime.length > 0 && <Field label="Důvod prostoje"><Input value={rec.downtimeReason} onChange={(e) => set("downtimeReason", e.target.value)} className="h-12" data-testid="record-downtime-reason-input" /></Field>}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#0B0F14] p-4 text-white sm:grid-cols-4" data-testid="record-time-breakdown">
          <div><div className="text-xs text-slate-300">Celkem</div><div className="font-heading text-2xl font-bold text-[#FFD200]" data-testid="breakdown-total">{fmtH(bd.totalHours)} h</div></div>
          <div><div className="text-xs text-slate-300">Ostatní práce</div><div className="font-heading text-2xl font-bold" data-testid="breakdown-work">{fmtH(bd.workHours)} h</div></div>
          <div><div className="text-xs text-slate-300">Servis</div><div className="font-heading text-2xl font-bold" data-testid="breakdown-service">{fmtH(bd.serviceHours)} h</div></div>
          <div><div className="text-xs text-slate-300">Prostoje</div><div className="font-heading text-2xl font-bold" data-testid="breakdown-downtime">{fmtH(bd.downtimeHours)} h</div></div>
          {bd.travelHours > 0 && <div><div className="text-xs text-slate-300">Přejezdy (nefakturuje se)</div><div className="font-heading text-2xl font-bold" data-testid="breakdown-travel">{fmtH(bd.travelHours)} h</div></div>}
          {bd.travelHours > 0 && <div><div className="text-xs text-slate-300">K fakturaci</div><div className="font-heading text-2xl font-bold" data-testid="breakdown-billable">{fmtH(bd.billableHours)} h</div></div>}
          <div className="col-span-2 text-xs text-slate-300 sm:col-span-4">Celkem = ostatní práce + servis + prostoje + přejezdy. {bd.serviceOutsideShift && <span className="font-semibold text-[#FFD200]">Pozor: část servisu leží mimo pracovní dobu.</span>} {bd.downtimeOutsideShift && <span className="font-semibold text-[#FFD200]">Pozor: část prostoje leží mimo pracovní dobu.</span>}</div>
        </div>
        <Field label="Provedená práce"><DictateTextarea value={rec.work} onChange={(v) => set("work", v)} placeholder={t("např. Třídění, nakládka… (nebo klepněte na mikrofon)")} testid="record-work-input" /></Field>
        {recentWork.length > 0 && <div className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-600">{t("Použité popisy pro")} {rec.machine}</div>
          <div className="grid grid-cols-1 gap-1" data-testid="record-work-suggestions">{recentWork.map((w, i) => <button key={i} type="button"
            title={w} onClick={() => set("work", w)}
            className="block h-11 w-full min-w-0 truncate rounded-md border border-slate-200 bg-white px-3 text-left text-sm font-medium leading-5 text-slate-800 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
            data-testid="record-work-suggestion">{w}</button>)}</div>
        </div>}
        {renderPhotos("timesheet", "Fotky k šichtovnici (výkaz, dodací list, stav pracoviště)")}
      </Section>

      <Section title="Motohodiny (MTH)" subtitle="Povinnost psát začátek a konec MTH" testid="section-mth">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="MTH začátek"><Input inputMode="decimal" value={rec.mthStart} onChange={(e) => set("mthStart", e.target.value)} className="h-12 text-lg" data-testid="record-mth-start-input" /></Field>
          <Field label="MTH konec"><Input inputMode="decimal" value={rec.mthEnd} onChange={(e) => set("mthEnd", e.target.value)} className="h-12 text-lg" data-testid="record-mth-end-input" /></Field>
          <Field label="Rozdíl"><div className={`flex h-12 items-center rounded-md border px-3 text-lg font-semibold ${mthDiff !== null && mthDiff < 0 ? "border-red-300 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50"}`} data-testid="record-mth-diff">{mthDiff === null ? "—" : String(mthDiff).replace(".", ",")}</div></Field>
        </div>
        <p className="text-xs text-slate-600">{t("MTH je údaj měřidla stroje a počítá se nezávisle na pracovních hodinách.")}</p>
        {svc && (
          <div className={`flex items-start gap-3 rounded-lg px-3 py-2 text-sm ${svc.service_state === "due" ? "bg-black text-[#FFD200]" : svc.service_state === "soon" ? "bg-amber-100 text-amber-950" : "bg-slate-100 text-slate-800"}`} data-testid="record-service-hint">
            <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
            <span><b>{svc.label}:</b> {remainingText(svc)} (pravidelný servis při {svc.next_service_mth} mth, interval {svc.service_interval_mth} mth).</span>
          </div>
        )}
      </Section>

      <Section defaultOpen={false} title="Prováděl jsem servis / opravu?" subtitle="Rozbalení ani skrytí nemaže již zapsané údaje." testid="section-service-gate" badge={(rec.service.length > 0 || rec.serviceDescription) ? <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">Servis vyplněn</span> : null}>
        {(
          <div className="mt-4 space-y-4" data-testid="service-block">
            <IntervalEditor label="Údržba / servis / oprava (časové úseky)" hint="Je součástí pracovní doby, nepřičítá se podruhé." items={rec.service} onChange={(v) => set("service", v)} testid="service" />
            <Field label="Popis servisu"><DictateTextarea value={rec.serviceDescription} onChange={(v) => set("serviceDescription", v)} testid="record-service-description-input" /></Field>
            <Field label="Popis opravy"><DictateTextarea value={rec.repairDescription} onChange={(v) => set("repairDescription", v)} testid="record-repair-description-input" /></Field>
            <Field label="Servis provedl">
              <div className="grid gap-2 sm:grid-cols-4">{SERVICE_ACTOR_OPTIONS.map(({ value, label }) => (
                <button key={value} type="button" onClick={() => set("serviceBy", rec.serviceBy === value ? "" : value)} className={`h-12 rounded-lg border-2 px-2 text-sm font-semibold ${rec.serviceBy === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:bg-slate-50"}`} data-testid={`record-service-by-${value}`}>{label}</button>))}</div>
            </Field>
            {rec.serviceBy === "external" && <Field label="Název externí servisní firmy"><Input value={rec.externalCompany} onChange={(e) => set("externalCompany", e.target.value)} className="h-12" data-testid="record-external-company-input" /></Field>}
            <label className={`flex min-h-[52px] items-start gap-3 rounded-lg border-2 px-3 py-2 ${canIntervalService ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-80"}`} data-testid="record-interval-service-row">
              <Checkbox checked={!!rec.intervalService} disabled={!canIntervalService} onCheckedChange={(v) => set("intervalService", v === true)} className="mt-0.5 h-6 w-6" data-testid="record-interval-service-checkbox" />
              <span className="font-medium">
                Proveden pravidelný servis dle intervalu ({selMachine?.service_interval_mth || 500} mth) – po potvrzení zápisu začne nový odpočet.
                {!canIntervalService && (
                  <span className="mt-1 flex items-start gap-1 text-xs font-normal text-slate-600"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Pravidelný servis může zapsat jen oprávněný mechanik nebo vedení podle zařazení účtu. Výběr externí firmy oprávnění nemění.</span>
                )}
              </span>
            </label>
            {renderPhotos("service", "Fotky ze servisu (štítky, vyměněné díly, stav po opravě)")}
          </div>
        )}
      </Section>

      <Section defaultOpen={false} title="Měl jsem přejezd mezi zakázkami (A → B)?" subtitle="Rozbalení ani skrytí nemaže již zapsané údaje." testid="section-travel-gate" badge={rec.travel?.length ? <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">Přejezd vyplněn</span> : null}>
        {(
          <div className="mt-4" data-testid="travel-block">
            <IntervalEditor label="Přejezd A → B" hint="Je součástí pracovní doby, ale nefakturuje se. Zadejte odkud, kam a čas od–do." items={rec.travel || []} onChange={(v) => set("travel", v)} testid="travel" withRoute
              places={[...new Set([...(wps.data || []).map((w) => w.name), ...sugg.site])]} />
          </div>
        )}
      </Section>

      <Section defaultOpen={false} title="Závady a provozní odchylky" subtitle="Vážnou závadu (STOP) uvidí vedení hned po odeslání" testid="section-faults" badge={rec.faults.some((f) => f.severity === "stop" && !f.resolved) ? <StatusBadge status="stop" /> : null}>
        {rec.faults.map((f, i) => (
          <div key={f.id} className={`space-y-3 rounded-xl border-2 p-3 ${f.severity === "stop" ? "border-black" : "border-slate-200"}`} data-testid={`fault-item-${i}`}>
            <div className="flex items-center justify-between"><div className="font-semibold">Závada {i + 1}</div><Button type="button" variant="ghost" size="sm" onClick={() => set("faults", rec.faults.filter((_, j) => j !== i))} data-testid={`fault-remove-${i}`}><Trash2 className="h-4 w-4" /></Button></div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setFault(i, "severity", "normal")} className={`h-12 rounded-lg border-2 font-semibold ${f.severity === "normal" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`} data-testid={`fault-severity-normal-${i}`}>Běžná</button>
              <button type="button" onClick={() => setFault(i, "severity", "stop")} className={`flex h-12 items-center justify-center gap-2 rounded-lg border-2 font-bold ${f.severity === "stop" ? "border-black bg-black text-[#FFD200]" : "border-slate-300"}`} data-testid={`fault-severity-stop-${i}`}><OctagonAlert className="h-5 w-5" />STOP – vážná</button>
            </div>
            <div className="grid grid-cols-2 gap-3"><Field label="Datum"><Input type="date" value={f.date} onChange={(e) => setFault(i, "date", e.target.value)} className="h-12" /></Field><Field label="Čas zjištění"><Input type="time" value={f.time} onChange={(e) => setFault(i, "time", e.target.value)} className="h-12" data-testid={`fault-time-${i}`} /></Field></div>
            <Field label="Popis závady"><DictateTextarea value={f.description} onChange={(v) => setFault(i, "description", v)} testid={`fault-description-${i}`} /></Field>
            <label className="flex min-h-[48px] items-center gap-3"><Checkbox checked={f.reportedToWorkshop} onCheckedChange={(v) => setFault(i, "reportedToWorkshop", v === true)} className="h-6 w-6" data-testid={`fault-reported-${i}`} />Nahlášeno vedoucímu servisu / dílně</label>
            <label className="flex min-h-[48px] items-center gap-3"><Checkbox checked={f.acknowledged} onCheckedChange={(v) => setFault(i, "acknowledged", v === true)} className="h-6 w-6" data-testid={`fault-acknowledged-${i}`} />Střídající obsluha byla seznámena</label>
            <label className="flex min-h-[48px] items-center gap-3"><Checkbox checked={f.resolved} onCheckedChange={(v) => setFault(i, "resolved", v === true)} className="h-6 w-6" data-testid={`fault-resolved-${i}`} />Závada odstraněna</label>
            {f.resolved && <Field label="Způsob odstranění"><DictateTextarea value={f.resolution} onChange={(v) => setFault(i, "resolution", v)} testid={`fault-resolution-${i}`} /></Field>}
          </div>))}
        <Button type="button" variant="outline" className="h-12" onClick={() => set("faults", [...rec.faults, { id: newId(), date: rec.date, time: new Date().toTimeString().slice(0, 5), description: "", severity: "normal", resolved: false, resolution: "", acknowledged: false, reportedToWorkshop: false }])} data-testid="fault-add-button"><Plus className="mr-1 h-4 w-4" />{t("Přidat závadu")}</Button>
      </Section>
      <button type="button" aria-expanded={additional} aria-controls="record-additional" onClick={() => setAdditional(!additional)} className="min-h-14 w-full rounded-xl border-2 bg-white px-4 text-left text-lg font-bold" data-testid="record-additional-toggle">Další údaje a přílohy · nic se nemaže</button>
      <div id="record-additional" hidden={!additional} className="space-y-4">
      <Section title="Doprava a další údaje" testid="section-extra-basic">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Směna"><Select value={rec.shift || "Denní"} onValueChange={(v) => set("shift", v)}><SelectTrigger className="h-12" data-testid="record-shift-select"><SelectValue /></SelectTrigger><SelectContent>{["Denní", "Odpolední", "Noční"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Obsluha (jméno)">
            <Input list="operator-list" value={rec.operator} onChange={(e) => set("operator", e.target.value)} className="h-12" data-testid="record-operator-input" />
            <datalist id="operator-list">{sugg.operator.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
          <Field label="Objednatel">
            <Input list="customer-list" value={rec.customer} onChange={(e) => set("customer", e.target.value)} className="h-12" data-testid="record-customer-input" />
            <datalist id="customer-list">{sugg.customer.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
          <Field label="Zakázka">
            <Input list="job-list" value={rec.job} onChange={(e) => set("job", e.target.value)} className="h-12" data-testid="record-job-input" />
            <datalist id="job-list">{sugg.job.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
          <Field label="Moje doba jízdy (H:MM)" hint="Vlastní jízdu zapisuje i spolujezdec. Nulová jízda = 0:00, nevyplněno není nula. Nepřičítá se znovu k pracovní době."><Input placeholder="0:45" value={rec.journeyEditing ? rec.drive : journeyText(rec) === "neověřeno" ? "" : journeyText(rec)} onChange={e => { const value = e.target.value; setRec(r => ({ ...r, drive: value, driveMinutes: durationMinutes(value), journeyEditing: true })); }} className="h-12" data-testid="record-drive-input" /></Field>
          {rec.drive && !rec.drive.includes(":") && rec.driveMinutes == null && <p role="alert" className="text-sm text-amber-900">Původní nejednoznačný údaj jízdy: {rec.drive}. Ověřte skutečnou dobu; údaj se automaticky nepřevádí na minuty.</p>}
          <Field label="Jel(a) jsem jako"><select value={rec.journeyRole || ""} onChange={e => { const role = e.target.value; setRec(r => role === "none" ? { ...r, journeyRole: role, drive: "0:00", driveMinutes: 0 } : { ...r, journeyRole: role }); }} className="h-12 w-full rounded border px-3"><option value="">Vyberte</option><option value="driver">Řidič</option><option value="passenger">Spolujezdec</option><option value="mixed">Řidič i spolujezdec</option><option value="none">Žádná jízda</option></select></Field>
          <p className="text-sm font-semibold">Čipování ve vozidle: neověřeno. Nezapomeňte se čipovat i jako spolujezdec a uvést všechny SPZ. Vyplnění aplikace čipnutí nepotvrzuje.</p>
          <Field label="SPZ vozidla (na pracoviště)">
            <Input list="vto-list" value={rec.vehiclesTo} onChange={(e) => set("vehiclesTo", e.target.value.toUpperCase())} className="h-12" data-testid="record-vehicles-to-input" />
            <datalist id="vto-list">{sugg.vehiclesTo.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
          <Field label="SPZ vozidla (z pracoviště)">
            <Input list="vfr-list" value={rec.vehiclesFrom} onChange={(e) => set("vehiclesFrom", e.target.value.toUpperCase())} className="h-12" data-testid="record-vehicles-from-input" />
            <datalist id="vfr-list">{sugg.vehiclesFrom.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
          <Field label="Ubytování"><Select value={rec.accommodation || "none"} onValueChange={(v) => set("accommodation", v === "none" ? "" : v)}><SelectTrigger className="h-12" data-testid="record-accommodation-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Neuvedeno</SelectItem><SelectItem value="yes">ANO</SelectItem><SelectItem value="no">NE</SelectItem></SelectContent></Select></Field>
          <Field label="Posádka / další osoby">
            <Input list="crew-list" value={rec.crew} onChange={(e) => set("crew", e.target.value)} className="h-12" data-testid="record-crew-input" />
            <datalist id="crew-list">{sugg.crew.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
        </div>
      </Section>

      <Section title="Kontroly stroje" subtitle="Zaškrtnutí nepotvrzuje bezpečnost ani odborné odstranění závady" testid="section-checks" defaultOpen={!id}>
        {[["dailyCheck", "Provedena denní kontrola a údržba stroje"], ["accessoryCheck", "Kontrola příslušenství stroje"], ["equipmentCheck", "Kontrola vybavení stroje"]].map(([k, l]) => (
          <label key={k} className="flex min-h-[52px] items-center gap-3 rounded-lg border border-slate-200 px-3"><Checkbox checked={rec[k]} onCheckedChange={(v) => set(k, v === true)} className="h-6 w-6" data-testid={`record-${k}-checkbox`} /><span className="font-medium">{t(l)}</span></label>))}
        <Field label="Stroj je provozuschopný, bez zjevných závad">
          <div className="grid grid-cols-3 gap-2">{[["yes", "Ano"], ["no", "Ne"], ["unknown", "Nevím"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => set("fit", v)} data-testid={`record-fit-${v}`} className={`h-12 rounded-lg border-2 font-semibold ${rec.fit === v ? (v === "no" ? "border-red-600 bg-red-600 text-white" : "border-slate-900 bg-slate-900 text-white") : "border-slate-300 bg-white"}`}>{t(l)}</button>))}</div>
        </Field>
      </Section>

      <Section title="Provozní kapaliny" testid="section-fluids" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Nafta (l)"><Input inputMode="decimal" value={rec.diesel} onChange={(e) => set("diesel", e.target.value)} className="h-12" data-testid="record-diesel-input" /></Field>
          <Field label="Hydr. olej (l)"><Input inputMode="decimal" value={rec.hydraulic} onChange={(e) => set("hydraulic", e.target.value)} className="h-12" data-testid="record-hydraulic-input" /></Field>
          <Field label="Mot. olej (l)"><Input inputMode="decimal" value={rec.oil} onChange={(e) => set("oil", e.target.value)} className="h-12" data-testid="record-oil-input" /></Field>
          <Field label="Jiné"><Input value={rec.otherFluid} onChange={(e) => set("otherFluid", e.target.value)} className="h-12" data-testid="record-other-fluid-input" /></Field>
        </div>
      </Section>

      <Section title="Poznámky a předání" testid="section-handover" defaultOpen={false}>
        <Field label="Poznámky"><DictateTextarea value={rec.notes} onChange={(v) => set("notes", v)} placeholder={t("Poznámky – můžete nadiktovat")} testid="record-notes-input" /></Field>
        <Field label="Pracoviště / stroj předal (popis)"><DictateTextarea value={rec.handover} onChange={(v) => set("handover", v)} testid="record-handover-input" /></Field>
        <Field label="Jméno předávajícího (hůlkovým písmem)"><Input value={rec.handoverName} onChange={(e) => set("handoverName", e.target.value.toUpperCase())} className="h-12" data-testid="record-handover-name-input" /></Field>
        <SignaturePad label="Podpis předávajícího" value={rec.handoverSignature} onChange={(v) => set("handoverSignature", v)} testid="handover-signature" />
        <SignaturePad label="Podpis obsluhy" value={rec.operatorSignature} onChange={(v) => set("operatorSignature", v)} testid="operator-signature" />
      </Section>

      <Section defaultOpen={false} title="Přílohy" subtitle="Doklad o tankování vč. stavu km, podklady pro fakturaci, fotky stroje" testid="section-attachments">
        <div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Druh přílohy"><Select value={attKind} onValueChange={setAttKind}><SelectTrigger className="h-12" data-testid="attachment-kind-select"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ATT_KINDS).map(([k, l]) => <SelectItem key={k} value={k}>{t(l)}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Stav km (u tankování)"><Input inputMode="numeric" value={attKm} onChange={(e) => setAttKm(e.target.value)} className="h-12" data-testid="attachment-km-input" /></Field>
          <div className="flex items-end"><label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-slate-900 bg-white font-semibold hover:bg-slate-50" data-testid="record-add-attachment-button"><Camera className="h-5 w-5" />{t("Vyfotit / přidat")}<input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onFile} data-testid="record-attachment-input" /></label></div>
        </div>
        <div className="space-y-2">{rec.attachments.filter((a) => (a.section || "general") === "general").map((a) => <AttachmentThumb key={a.id} att={a} onRemove={() => removeAtt(a.id)} />)}</div>
        <p className="text-xs text-slate-600">{t("Max. 15 MB na soubor. Bez připojení se soubor uloží v telefonu a nahraje se později.")}</p>
        </div>
      </Section>
      </div>

      {local && !server && <Button variant="ghost" className="text-red-700" onClick={async () => { await discardLocalRecord(rec.id); nav("/zapisy"); }} data-testid="record-discard-local">{t("Zahodit neodeslaný zápis z telefonu")}</Button>}

      <div className="sticky bottom-20 z-10 lg:bottom-0 rounded-xl border border-slate-200 bg-white p-3 shadow-md">
        {!id && <label className="mx-auto mb-2 flex max-w-6xl items-center gap-2 text-sm font-semibold text-slate-800" data-testid="record-next-machine-label">
          <input type="checkbox" className="h-5 w-5" checked={continueMachine} onChange={e => setContinueMachine(e.target.checked)} />
          Po uložení pokračovat druhým strojem (samostatné časy a motohodiny)
        </label>}
        <div className="mx-auto flex max-w-6xl gap-3">
          {!serverConfirmed && <Button type="button" variant="outline" className="h-14 flex-1 border-slate-300 text-base font-semibold" onClick={() => doSave(false)} data-testid="record-save-draft-button">{t("Uložit koncept")}</Button>}
          <Button type="button" className="btn-primary h-14 flex-[2] text-base font-semibold" onClick={onConfirm} data-testid="record-confirm-button">{t(serverConfirmed ? "Uložit opravu (nová revize)" : "Uložit a potvrdit")}</Button>
        </div>
      </div>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent className="max-w-md" data-testid="correction-reason-dialog">
          <DialogHeader><DialogTitle className="font-heading">{t("Důvod opravy")}</DialogTitle><DialogDescription>{t("Potvrzený zápis se nepřepisuje: vznikne nová revize a původní znění zůstane v historii.")}</DialogDescription></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="např. Špatně zadané datum" data-testid="record-revision-reason-input" />
          <DialogFooter><Button className="btn-primary h-12 w-full font-semibold" disabled={!reason.trim()} onClick={() => { setReasonOpen(false); doSave(true, reason.trim()); }} data-testid="record-revision-submit">{t("Uložit novou revizi")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
