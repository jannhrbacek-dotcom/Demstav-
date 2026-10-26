import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Camera, OctagonAlert, History, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Section, Field, PageHeader } from "@/components/Section";
import { IntervalEditor } from "@/components/IntervalEditor";
import { SignaturePad } from "@/components/SignaturePad";
import { StatusBadge } from "@/components/StatusBadge";
import { AttachmentThumb } from "@/components/AttachmentThumb";
import { useAuth } from "@/lib/auth";
import { useCached, mergedRecords } from "@/lib/data";
import { http } from "@/lib/api";
import { useSync, saveRecordLocal, addAttachment, discardLocalRecord } from "@/lib/sync";
import { newId, pragueDate, ATT_KINDS } from "@/lib/format";
import { timeBreakdown, fmtH } from "@/lib/worktime";

const blank = (user, last, date) => ({
  id: newId(), revision: 0, status: "draft", date, shift: "Denní", operator: user?.name || "", crew: "",
  machine: last?.machine || "", customer: last?.customer || "", site: last?.site || "", job: last?.job || "", drive: last?.drive || "",
  vehiclesTo: last?.vehiclesTo || "", vehiclesFrom: last?.vehiclesFrom || "", accommodation: last?.accommodation || "",
  billing: [{ start: "", end: "" }], service: [], downtime: [], downtimeReason: "", workTimeMode: "shift", work: "", mthStart: last?.mthEnd || "", mthEnd: "",
  dailyCheck: false, accessoryCheck: false, equipmentCheck: false, fit: "unknown", notes: "", handover: "", handoverName: "", handoverSignature: "", operatorSignature: "",
  diesel: "", hydraulic: "", oil: "", otherFluid: "", serviceDescription: "", repairDescription: "", serviceBy: "", externalCompany: "", workshopSignature: "",
  faults: [], attachments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

const num = (v) => (v && /^\d+(?:[.,]\d{1,3})?$/.test(v) ? Number(v.replace(",", ".")) : null);
function validate(r, confirm) {
  const e = [];
  const b = timeBreakdown(r);
  if (r.drive && !/^\d{1,3}$/.test(r.drive)) e.push("Jízda *: zadejte celé číslo.");
  for (const k of ["mthStart", "mthEnd", "diesel", "hydraulic", "oil"]) if (r[k] && num(r[k]) === null) e.push(`Pole ${k === "mthStart" ? "MTH začátek" : k === "mthEnd" ? "MTH konec" : k}: zadejte číslo.`);
  for (const [k, l] of [["billing", "pracovní doba"], ["service", "servis"], ["downtime", "prostoj"]]) r[k].forEach((i, n) => { if ((confirm && (!i.start || !i.end)) || (i.start && i.end && i.start === i.end)) e.push(`Doplňte platný čas od–do (${l}, řádek ${n + 1}).`); });
  r.faults.forEach((f, n) => { if (!f.description.trim()) e.push(`Doplňte popis závady ${n + 1}.`); if (confirm && !f.time) e.push(`Doplňte čas nahlášení závady ${n + 1}.`); if (confirm && f.resolved && !f.resolution.trim()) e.push(`Doplňte způsob odstranění závady ${n + 1}.`); });
  if (confirm) {
    if (!r.machine.trim()) e.push("Vyberte stroj.");
    if (!r.operator.trim()) e.push("Doplňte jméno obsluhy.");
    if (!r.billing.length) e.push("Doplňte alespoň jeden úsek pracovní doby.");
    if (!r.mthStart || !r.mthEnd) e.push("Povinnost psát začátek a konec MTH.");
    else if (num(r.mthEnd) !== null && num(r.mthStart) !== null && num(r.mthEnd) < num(r.mthStart)) e.push("Konečný stav MTH nesmí být nižší než počáteční.");
    if (b.serviceOutsideShift) e.push("Servis musí ležet uvnitř pracovní doby.");
    if (b.downtimeOutsideShift) e.push("Prostoj musí ležet uvnitř pracovní doby.");
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
  const nav = useNavigate();
  const s = useSync();
  const machines = useCached("/machines");
  const wps = useCached("/workplaces");
  const mine = useCached("/records?mine=1&limit=200");
  const [rec, setRec] = useState(null);
  const [server, setServer] = useState(null);
  const [errors, setErrors] = useState([]);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [attKind, setAttKind] = useState("photo");
  const [attKm, setAttKm] = useState("");

  // Chytrý našeptávač – unikátní hodnoty z posledních zápisů tohoto uživatele.
  const sugg = useMemo(() => {
    const merged = mergedRecords(mine.data, s.records).map((x) => x.record);
    const uniq = (k) => [...new Set(merged.map((r) => (r?.[k] || "").toString().trim()).filter(Boolean))].slice(0, 50);
    return {
      machine: uniq("machine"), customer: uniq("customer"), site: uniq("site"), job: uniq("job"),
      operator: uniq("operator"), crew: uniq("crew"), vehiclesTo: uniq("vehiclesTo"), vehiclesFrom: uniq("vehiclesFrom"),
      downtimeReason: uniq("downtimeReason"), work: uniq("work"),
    };
  }, [mine.data, s.records]);
  const lastRecord = useMemo(() => mergedRecords(mine.data, s.records)[0]?.record || null, [mine.data, s.records]);

  useEffect(() => {
    if (rec || mine.loading) return;
    if (!id) {
      const last = mergedRecords(mine.data, s.records)[0]?.record;
      setRec(blank(user, last, pragueDate()));
      return;
    }
    const loc = s.records[id];
    const srv = (mine.data || []).find((r) => r.id === id);
    const load = async () => {
      let full = srv;
      try { full = (await http.get(`/records/${id}`)).data; } catch { /* offline */ }
      if (full && full.owner_id && full.owner_id !== user.id) { nav(`/detail/${id}`, { replace: true }); return; }
      setServer(full || null);
      setRec(loc ? { ...loc.record } : full ? { ...full } : null);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mine.loading]);

  const bd = useMemo(() => (rec ? timeBreakdown(rec) : null), [rec]);
  const local = rec ? s.records[rec.id] : null;
  const serverConfirmed = (server?.status || local?.record?.status) === "confirmed" && (local?.serverRevision || server?.revision || 0) > 0;
  const status = local ? local.localState : server ? (server.status === "confirmed" ? "confirmed" : "draft") : "local";
  if (!rec) return <div className="py-10 text-center text-slate-600" data-testid="record-loading">{mine.loading ? "Načítám…" : "Zápis nenalezen."}</div>;

  const set = (k, v) => setRec((r) => ({ ...r, [k]: v }));
  const setFault = (i, k, v) => set("faults", rec.faults.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  const mthDiff = num(rec.mthStart) !== null && num(rec.mthEnd) !== null ? Math.round((num(rec.mthEnd) - num(rec.mthStart)) * 1000) / 1000 : null;

  const doSave = async (confirm, correctionReason = "") => {
    const e = validate(rec, confirm);
    setErrors(e);
    if (e.length) { toast.error(e[0]); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const clean = { ...rec, billing: rec.billing.filter((i) => i.start || i.end), service: rec.service.filter((i) => i.start || i.end), downtime: rec.downtime.filter((i) => i.start || i.end) };
    await saveRecordLocal(clean, { confirm, correctionReason, baseRevision: local?.serverRevision ?? server?.revision ?? 0 });
    toast.success(navigator.onLine ? (confirm ? "Zápis uložen a odesílá se k potvrzení" : "Koncept uložen a odesílá se") : "Uloženo v telefonu – čeká na odeslání");
    nav("/zapisy");
  };
  const onConfirm = () => (serverConfirmed ? setReasonOpen(true) : doSave(true));
  const onFile = async (ev) => {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";
    for (const f of files) {
      if (f.size > 15 * 1024 * 1024) { toast.error(`${f.name}: soubor je větší než 15 MB.`); continue; }
      const att = await addAttachment(f, { kind: attKind, km: attKm, recordId: rec.id });
      setRec((r) => ({ ...r, attachments: [...r.attachments, att] }));
    }
    setAttKm("");
  };
  const wpOptions = wps.data || [];

  return (
    <div className="space-y-4 pb-24">
      <PageHeader title={id ? "Úprava zápisu" : "Nový denní zápis"} subtitle="Provozní deník stroje a šichtovnice – vyplníte jednou, promítne se do obou."
        actions={<>
          <StatusBadge status={status} testid="record-status-badge" />
          {id && server && <Link to={`/detail/${rec.id}`}><Button variant="outline" className="h-10" data-testid="record-history-link"><History className="mr-1 h-4 w-4" />Historie</Button></Link>}
          <Button variant="ghost" className="h-10" onClick={() => nav(-1)} data-testid="record-back-button"><ArrowLeft className="mr-1 h-4 w-4" />Zpět</Button>
        </>} />
      {serverConfirmed && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950" data-testid="record-correction-note">Zápis je potvrzený (revize {local?.serverRevision || server?.revision}). Úprava vytvoří novou revizi s důvodem opravy; původní znění zůstane v historii.</div>}
      {local?.localState === "conflict" && <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950">Zápis byl mezitím změněn jinde. Konflikt vyřešte ve <Link to="/fronta" className="font-semibold underline">Frontě</Link>.</div>}
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
              job: lastRecord.job || r.job, drive: lastRecord.drive || r.drive, vehiclesTo: lastRecord.vehiclesTo || r.vehiclesTo,
              vehiclesFrom: lastRecord.vehiclesFrom || r.vehiclesFrom, accommodation: lastRecord.accommodation || r.accommodation,
              crew: lastRecord.crew || r.crew, mthStart: lastRecord.mthEnd || r.mthStart, shift: lastRecord.shift || r.shift,
            }))}>Načíst z minula</Button>
        </div>
      )}

      <Section title="1. Základ" subtitle="Datum, stroj, objednatel, pracoviště" testid="section-basic">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Datum"><Input type="date" value={rec.date} onChange={(e) => set("date", e.target.value)} className="h-12" data-testid="record-date-input" /></Field>
          <Field label="Směna"><Select value={rec.shift || "Denní"} onValueChange={(v) => set("shift", v)}><SelectTrigger className="h-12" data-testid="record-shift-select"><SelectValue /></SelectTrigger><SelectContent>{["Denní", "Odpolední", "Noční"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Stroj" hint="Vyberte ze seznamu nebo napište.">
            <Input list="machine-list" value={rec.machine} onChange={(e) => set("machine", e.target.value)} className="h-12" placeholder="např. Liebherr L566/3" data-testid="record-machine-input" />
            <datalist id="machine-list">{(machines.data || []).filter((m) => m.active).map((m) => <option key={m.id} value={m.label}>{m.internal_number ? `č. ${m.internal_number}` : ""}</option>)}</datalist>
          </Field>
          <Field label="Obsluha (jméno)">
            <Input list="operator-list" value={rec.operator} onChange={(e) => set("operator", e.target.value)} className="h-12" data-testid="record-operator-input" />
            <datalist id="operator-list">{sugg.operator.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
          <Field label="Objednatel">
            <Input list="customer-list" value={rec.customer} onChange={(e) => set("customer", e.target.value)} className="h-12" data-testid="record-customer-input" />
            <datalist id="customer-list">{sugg.customer.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
          <Field label="Pracoviště / dílna (stavba)">
            <Input list="site-list" value={rec.site} onChange={(e) => set("site", e.target.value)} className="h-12" data-testid="record-site-input" />
            <datalist id="site-list">{[...new Set([...wpOptions.map((w) => w.name), ...sugg.site])].map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
          <Field label="Zakázka">
            <Input list="job-list" value={rec.job} onChange={(e) => set("job", e.target.value)} className="h-12" data-testid="record-job-input" />
            <datalist id="job-list">{sugg.job.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
          <Field label="Jízda *" hint="Číslo podle původního firemního formuláře (např. počet osob ve vozidle)."><Input inputMode="numeric" value={rec.drive} onChange={(e) => set("drive", e.target.value.replace(/[^\d]/g, "").slice(0, 3))} className="h-12" data-testid="record-drive-input" /></Field>
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

      <Section title="2. Pracovní čas" subtitle="Celá pracovní doba; servis a prostoje leží uvnitř ní" testid="section-time">
        <IntervalEditor label="Pracovní doba (celá směna)" hint="Nezapočítávanou přestávku vynechte – zadejte dva úseky (např. 06:00–11:30 a 12:00–15:30)." items={rec.billing} onChange={(v) => set("billing", v)} testid="billing" />
        <IntervalEditor label="Údržba / servis / oprava" hint="Je součástí pracovní doby, nepřičítá se podruhé." items={rec.service} onChange={(v) => set("service", v)} testid="service" />
        <IntervalEditor label="Prostoje" hint="Samostatná kategorie uvnitř pracovní doby (např. čekání na materiál). Není to přestávka." items={rec.downtime} onChange={(v) => set("downtime", v)} testid="downtime" />
        {rec.downtime.length > 0 && <Field label="Důvod prostoje"><Input value={rec.downtimeReason} onChange={(e) => set("downtimeReason", e.target.value)} className="h-12" data-testid="record-downtime-reason-input" /></Field>}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#0B0F14] p-4 text-white sm:grid-cols-4" data-testid="record-time-breakdown">
          <div><div className="text-xs text-slate-300">Celkem</div><div className="font-heading text-2xl font-bold text-[#FFD200]" data-testid="breakdown-total">{fmtH(bd.totalHours)} h</div></div>
          <div><div className="text-xs text-slate-300">Ostatní práce</div><div className="font-heading text-2xl font-bold" data-testid="breakdown-work">{fmtH(bd.workHours)} h</div></div>
          <div><div className="text-xs text-slate-300">Servis</div><div className="font-heading text-2xl font-bold" data-testid="breakdown-service">{fmtH(bd.serviceHours)} h</div></div>
          <div><div className="text-xs text-slate-300">Prostoje</div><div className="font-heading text-2xl font-bold" data-testid="breakdown-downtime">{fmtH(bd.downtimeHours)} h</div></div>
          <div className="col-span-2 text-xs text-slate-300 sm:col-span-4">Celkem = ostatní práce + servis + prostoje. {bd.serviceOutsideShift && <span className="font-semibold text-[#FFD200]">Pozor: část servisu leží mimo pracovní dobu.</span>} {bd.downtimeOutsideShift && <span className="font-semibold text-[#FFD200]">Pozor: část prostoje leží mimo pracovní dobu.</span>}</div>
        </div>
        <Field label="Provedená práce"><Textarea value={rec.work} onChange={(e) => set("work", e.target.value)} placeholder="např. Třídění, nakládka…" data-testid="record-work-input" /></Field>
      </Section>

      <Section title="3. Motohodiny (MTH)" subtitle="Povinnost psát začátek a konec MTH" testid="section-mth">
        <div className="grid grid-cols-3 gap-3">
          <Field label="MTH začátek"><Input inputMode="decimal" value={rec.mthStart} onChange={(e) => set("mthStart", e.target.value)} className="h-12 text-lg" data-testid="record-mth-start-input" /></Field>
          <Field label="MTH konec"><Input inputMode="decimal" value={rec.mthEnd} onChange={(e) => set("mthEnd", e.target.value)} className="h-12 text-lg" data-testid="record-mth-end-input" /></Field>
          <Field label="Rozdíl"><div className={`flex h-12 items-center rounded-md border px-3 text-lg font-semibold ${mthDiff !== null && mthDiff < 0 ? "border-red-300 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50"}`} data-testid="record-mth-diff">{mthDiff === null ? "—" : String(mthDiff).replace(".", ",")}</div></Field>
        </div>
        <p className="text-xs text-slate-600">MTH je údaj měřidla stroje a počítá se nezávisle na pracovních hodinách.</p>
      </Section>

      <Section title="4. Kontroly stroje" subtitle="Zaškrtnutí nepotvrzuje bezpečnost ani odborné odstranění závady" testid="section-checks" defaultOpen={!id}>
        {[["dailyCheck", "Provedena denní kontrola a údržba stroje"], ["accessoryCheck", "Kontrola příslušenství stroje"], ["equipmentCheck", "Kontrola vybavení stroje"]].map(([k, l]) => (
          <label key={k} className="flex min-h-[52px] items-center gap-3 rounded-lg border border-slate-200 px-3"><Checkbox checked={rec[k]} onCheckedChange={(v) => set(k, v === true)} className="h-6 w-6" data-testid={`record-${k}-checkbox`} /><span className="font-medium">{l}</span></label>))}
        <Field label="Stroj je provozuschopný, bez zjevných závad">
          <div className="grid grid-cols-3 gap-2">{[["yes", "Ano"], ["no", "Ne"], ["unknown", "Nevím"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => set("fit", v)} data-testid={`record-fit-${v}`} className={`h-12 rounded-lg border-2 font-semibold ${rec.fit === v ? (v === "no" ? "border-red-600 bg-red-600 text-white" : "border-slate-900 bg-slate-900 text-white") : "border-slate-300 bg-white"}`}>{l}</button>))}</div>
        </Field>
      </Section>

      <Section title="5. Závady a provozní odchylky" subtitle="Vážnou závadu (STOP) uvidí vedení hned po odeslání" testid="section-faults" badge={rec.faults.some((f) => f.severity === "stop" && !f.resolved) ? <StatusBadge status="stop" /> : null}>
        {rec.faults.map((f, i) => (
          <div key={f.id} className={`space-y-3 rounded-xl border-2 p-3 ${f.severity === "stop" ? "border-black" : "border-slate-200"}`} data-testid={`fault-item-${i}`}>
            <div className="flex items-center justify-between"><div className="font-semibold">Závada {i + 1}</div><Button type="button" variant="ghost" size="sm" onClick={() => set("faults", rec.faults.filter((_, j) => j !== i))} data-testid={`fault-remove-${i}`}><Trash2 className="h-4 w-4" /></Button></div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setFault(i, "severity", "normal")} className={`h-12 rounded-lg border-2 font-semibold ${f.severity === "normal" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`} data-testid={`fault-severity-normal-${i}`}>Běžná</button>
              <button type="button" onClick={() => setFault(i, "severity", "stop")} className={`flex h-12 items-center justify-center gap-2 rounded-lg border-2 font-bold ${f.severity === "stop" ? "border-black bg-black text-[#FFD200]" : "border-slate-300"}`} data-testid={`fault-severity-stop-${i}`}><OctagonAlert className="h-5 w-5" />STOP – vážná</button>
            </div>
            <div className="grid grid-cols-2 gap-3"><Field label="Datum"><Input type="date" value={f.date} onChange={(e) => setFault(i, "date", e.target.value)} className="h-12" /></Field><Field label="Čas zjištění"><Input type="time" value={f.time} onChange={(e) => setFault(i, "time", e.target.value)} className="h-12" data-testid={`fault-time-${i}`} /></Field></div>
            <Field label="Popis závady"><Textarea value={f.description} onChange={(e) => setFault(i, "description", e.target.value)} data-testid={`fault-description-${i}`} /></Field>
            <label className="flex min-h-[48px] items-center gap-3"><Checkbox checked={f.reportedToWorkshop} onCheckedChange={(v) => setFault(i, "reportedToWorkshop", v === true)} className="h-6 w-6" data-testid={`fault-reported-${i}`} />Nahlášeno vedoucímu servisu / dílně</label>
            <label className="flex min-h-[48px] items-center gap-3"><Checkbox checked={f.acknowledged} onCheckedChange={(v) => setFault(i, "acknowledged", v === true)} className="h-6 w-6" data-testid={`fault-acknowledged-${i}`} />Střídající obsluha byla seznámena</label>
            <label className="flex min-h-[48px] items-center gap-3"><Checkbox checked={f.resolved} onCheckedChange={(v) => setFault(i, "resolved", v === true)} className="h-6 w-6" data-testid={`fault-resolved-${i}`} />Závada odstraněna</label>
            {f.resolved && <Field label="Způsob odstranění"><Textarea value={f.resolution} onChange={(e) => setFault(i, "resolution", e.target.value)} data-testid={`fault-resolution-${i}`} /></Field>}
          </div>))}
        <Button type="button" variant="outline" className="h-12" onClick={() => set("faults", [...rec.faults, { id: newId(), date: rec.date, time: new Date().toTimeString().slice(0, 5), description: "", severity: "normal", resolved: false, resolution: "", acknowledged: false, reportedToWorkshop: false }])} data-testid="fault-add-button"><Plus className="mr-1 h-4 w-4" />Přidat závadu</Button>
      </Section>

      <Section title="6. Servis a oprava" subtitle="Bez popisu nelze servisní čas započítat" testid="section-service" defaultOpen={rec.service.length > 0 || !!rec.serviceDescription}>
        <Field label="Popis servisu"><Textarea value={rec.serviceDescription} onChange={(e) => set("serviceDescription", e.target.value)} data-testid="record-service-description-input" /></Field>
        <Field label="Popis opravy"><Textarea value={rec.repairDescription} onChange={(e) => set("repairDescription", e.target.value)} data-testid="record-repair-description-input" /></Field>
        <Field label="Servis provedl">
          <div className="grid gap-2 sm:grid-cols-3">{[["operator", "Strojník"], ["workshop", "Dílna – výjezd"], ["external", "Cizí firma"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => set("serviceBy", rec.serviceBy === v ? "" : v)} className={`h-12 rounded-lg border-2 font-semibold ${rec.serviceBy === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`} data-testid={`record-service-by-${v}`}>{l}</button>))}</div>
        </Field>
        {rec.serviceBy === "external" && <Field label="Název cizí firmy"><Input value={rec.externalCompany} onChange={(e) => set("externalCompany", e.target.value)} className="h-12" data-testid="record-external-company-input" /></Field>}
      </Section>

      <Section title="7. Provozní kapaliny" testid="section-fluids" defaultOpen={false}>
        <div data-simple="optional" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Nafta (l)"><Input inputMode="decimal" value={rec.diesel} onChange={(e) => set("diesel", e.target.value)} className="h-12" data-testid="record-diesel-input" /></Field>
          <Field label="Hydr. olej (l)"><Input inputMode="decimal" value={rec.hydraulic} onChange={(e) => set("hydraulic", e.target.value)} className="h-12" data-testid="record-hydraulic-input" /></Field>
          <Field label="Mot. olej (l)"><Input inputMode="decimal" value={rec.oil} onChange={(e) => set("oil", e.target.value)} className="h-12" data-testid="record-oil-input" /></Field>
          <Field label="Jiné"><Input value={rec.otherFluid} onChange={(e) => set("otherFluid", e.target.value)} className="h-12" data-testid="record-other-fluid-input" /></Field>
        </div>
      </Section>

      <Section title="8. Poznámky a předání" testid="section-handover" defaultOpen={false}>
        <Field label="Poznámky"><Textarea value={rec.notes} onChange={(e) => set("notes", e.target.value)} data-testid="record-notes-input" /></Field>
        <Field label="Pracoviště / stroj předal (popis)"><Textarea value={rec.handover} onChange={(e) => set("handover", e.target.value)} data-testid="record-handover-input" /></Field>
        <Field label="Jméno předávajícího (hůlkovým písmem)"><Input value={rec.handoverName} onChange={(e) => set("handoverName", e.target.value.toUpperCase())} className="h-12" data-testid="record-handover-name-input" /></Field>
        <SignaturePad label="Podpis předávajícího" value={rec.handoverSignature} onChange={(v) => set("handoverSignature", v)} testid="handover-signature" />
        <SignaturePad label="Podpis obsluhy" value={rec.operatorSignature} onChange={(v) => set("operatorSignature", v)} testid="operator-signature" />
      </Section>

      <Section title="9. Přílohy" subtitle="Doklad o tankování vč. stavu km, podklady pro fakturaci, fotky stroje" testid="section-attachments">
        <div data-simple="optional">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Druh přílohy"><Select value={attKind} onValueChange={setAttKind}><SelectTrigger className="h-12" data-testid="attachment-kind-select"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ATT_KINDS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Stav km (u tankování)"><Input inputMode="numeric" value={attKm} onChange={(e) => setAttKm(e.target.value)} className="h-12" data-testid="attachment-km-input" /></Field>
          <div className="flex items-end"><label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-slate-900 bg-white font-semibold hover:bg-slate-50" data-testid="record-add-attachment-button"><Camera className="h-5 w-5" />Vyfotit / přidat<input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onFile} data-testid="record-attachment-input" /></label></div>
        </div>
        <div className="space-y-2">{rec.attachments.map((a) => <AttachmentThumb key={a.id} att={a} onRemove={() => set("attachments", rec.attachments.filter((x) => x.id !== a.id))} />)}</div>
        <p className="text-xs text-slate-600">Max. 15 MB na soubor. Bez připojení se soubor uloží v telefonu a nahraje se později.</p>
        </div>
      </Section>

      {local && !server && <Button variant="ghost" className="text-red-700" onClick={async () => { await discardLocalRecord(rec.id); nav("/zapisy"); }} data-testid="record-discard-local">Zahodit neodeslaný zápis z telefonu</Button>}

      <div className="fixed inset-x-0 bottom-[64px] z-20 border-t border-slate-200 bg-white px-4 py-3 shadow-md lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-6xl gap-3">
          {!serverConfirmed && <Button type="button" variant="outline" className="h-14 flex-1 border-slate-300 text-base font-semibold" onClick={() => doSave(false)} data-testid="record-save-draft-button">Uložit koncept</Button>}
          <Button type="button" className="btn-primary h-14 flex-[2] text-base font-semibold" onClick={onConfirm} data-testid="record-confirm-button">{serverConfirmed ? "Uložit opravu (nová revize)" : "Uložit a potvrdit"}</Button>
        </div>
      </div>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent className="max-w-md" data-testid="correction-reason-dialog">
          <DialogHeader><DialogTitle className="font-heading">Důvod opravy</DialogTitle><DialogDescription>Potvrzený zápis se nepřepisuje: vznikne nová revize a původní znění zůstane v historii.</DialogDescription></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="např. Špatně zadané datum" data-testid="record-revision-reason-input" />
          <DialogFooter><Button className="btn-primary h-12 w-full font-semibold" disabled={!reason.trim()} onClick={() => { setReasonOpen(false); doSave(true, reason.trim()); }} data-testid="record-revision-submit">Uložit novou revizi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
