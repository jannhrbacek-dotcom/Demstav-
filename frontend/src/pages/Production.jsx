import React, { useEffect, useState } from "react";
import { get, set, del } from "idb-keyval";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/Section";
import { useAuth, atLeast } from "@/lib/auth";
import { useCached } from "@/lib/data";
import { http, errText, downloadFile } from "@/lib/api";
import { addAttachment, saveProduction, useSync, localBlob, removeOp } from "@/lib/sync";
import { newId, pragueDate } from "@/lib/format";

const blank = () => ({ id: newId(), date: pragueDate(), customer: "", site: "", job: "", crew: "", machines: "", equipment: "", work: "", start: "", end: "", tonnes: "", shift: "Denní", shift_closed: false, customer_name: "", note: "", tickets: [], revision: 0 });
const inputClass = "mt-1 min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base";
function Field({ label, value, onChange, type = "text", multiline = false }) {
  const Tag = multiline ? "textarea" : "input";
  return <label className="block text-sm font-semibold">{label}<Tag className={inputClass} type={multiline ? undefined : type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>;
}

export default function Production() {
  const { user } = useAuth();
  const sync = useSync();
  const list = useCached("/production");
  const settings = useCached("/production/settings");
  const [report, setReport] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ids, setIds] = useState(null);
  const key = `u:${user.id}:production-draft`;
  useEffect(() => { let active = true; get(key).then((d) => { if (active) { setReport(d || null); setLoaded(true); } }).catch(() => toast.error("Nelze načíst rozepsaný výkaz z telefonu.")); return () => { active = false; }; }, [key]);
  useEffect(() => { if (loaded && report) set(key, report).catch(() => toast.error("Výkaz se nepodařilo uložit do telefonu. Nezavírejte stránku.")); }, [key, loaded, report]);
  const change = (k, v) => setReport((r) => ({ ...r, [k]: v }));
  const queued = sync.queue.filter((op) => op.type === "production");
  const all = new Map((list.data || []).map((r) => [r.id, r]));
  queued.forEach((op) => all.set(op.refId, { ...op.payload.report, pending: true, queueError: op.error }));
  const responsible = settings.data?.responsible_ids || [];
  const selectedIds = ids ?? responsible;
  const permitted = atLeast(user, "manager") || responsible.includes(user.id);
  const start = () => setReport({ ...blank(), crew: user.name });
  const upload = async (files) => {
    setBusy(true);
    try {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size > 15 * 1024 * 1024) { toast.error("Použijte JPG, PNG, WEBP nebo PDF do 15 MB."); continue; }
        const a = await addAttachment(file, { recordId: report.id, kind: "other", section: "general" });
        setReport((r) => ({ ...r, tickets: [...r.tickets, { attachment_id: a.id, name: a.name, number: "", fraction: "", tonnes: "" }] }));
      }
    } catch (e) { toast.error(errText(e, "Fotografii nelze uložit.")); }
    finally { setBusy(false); }
  };
  const preview = async (ticket) => {
    const blob = await localBlob(ticket.attachment_id);
    if (blob) {
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = ticket.name || "vazni-listek"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } else await downloadFile(`/attachments/${ticket.attachment_id}`, ticket.name || "vazni-listek.jpg");
  };
  const save = async (submit) => {
    if (submit && (!report.tickets.length || !report.start || !report.end || !report.customer || !report.site || !report.crew || !report.machines || !report.work || !report.shift_closed)) { toast.error("Doplňte povinné údaje a přiložte vážní lístek."); return; }
    setBusy(true);
    try { await saveProduction({ ...report, tonnes: known.length === report.tickets.length && known.length ? total : null }, submit); await del(key); setReport(null); toast.success("Uloženo do fronty. Stav přijetí serverem najdete níže nebo ve Frontě odesílání."); }
    catch { toast.error("Uložení selhalo. Výkaz zůstává rozepsaný."); }
    finally { setBusy(false); }
  };
  const number = (s) => Number(String(s).replace(',', '.'));
  const known = report?.tickets.filter((t) => t.tonnes !== "" && t.tonnes != null) || [];
  const total = known.reduce((n, t) => n + (number(t.tonnes) || 0), 0);
  return <div className="space-y-5">
    <PageHeader title="Výkaz práce a tonáže" subtitle="Jeden společný výkaz za posádku. Vyplňuje pouze ten, kdo jej dnes vede." />
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <p className="font-semibold">Máte dnes na starost společný výkaz?</p>
      <p className="text-sm text-slate-600">Pokud jej vede kolega, nic dalšího nevyplňujete. Výkaz nenahrazuje osobní šichtovnici ani deník stroje.</p>
      {responsible.includes(user.id) && <p className="text-sm font-semibold">Jste mezi obvyklými zpracovateli. Výkaz založte jen tehdy, když jej dnes vedete vy.</p>}
      {!permitted && <p>Výkaz zadává pověřený pracovník po skončení směny. Pověření nastavuje vedení.</p>}
      {!report && <Button className="btn-primary h-14 w-full" disabled={!loaded || !permitted} onClick={start}>Ano, dnes vedu společný výkaz</Button>}
    </div>
    {atLeast(user, "manager") && <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Obvyklí zpracovatelé výkazu</summary>
      <p className="my-3 text-sm">Vyberte skutečné účty, například Marcela Schmidta a Hanu Hynčicovou. Pověření připomene výkaz; nezakládá nové účty.</p>
      {settings.data?.people.map((p) => <label key={p.id} className="flex min-h-[48px] items-center gap-3"><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={(e) => setIds(e.target.checked ? [...selectedIds, p.id] : selectedIds.filter((id) => id !== p.id))} />{p.name}</label>)}
      <Button className="mt-3 h-12" onClick={async () => { try { await http.put('/production/settings', { responsible_ids: selectedIds }); settings.reload(); toast.success("Pověření uloženo."); } catch (e) { toast.error(errText(e)); } }}>Uložit pověření</Button>
    </details>}
    {report && <div className="rounded-xl border bg-white p-4 space-y-4">
      <p className="text-sm text-slate-600">Rozepsané údaje se průběžně ukládají v tomto telefonu. Fotografie lze přidávat i bez internetu.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {[['Datum *', 'date', 'date'], ['Odběratel *', 'customer'], ['Pracoviště *', 'site'], ['Stavba / akce / zakázka', 'job'], ['Posádka *', 'crew'], ['Stroje *', 'machines'], ['Přídavné pracovní zařízení', 'equipment'], ['Začátek práce *', 'start', 'time'], ['Konec práce *', 'end', 'time'], ['Směna (stejný název pro celou posádku)', 'shift'], ['Jméno zástupce odběratele', 'customer_name']].map(([label, k, type]) => <Field key={k} label={label} type={type} value={report[k]} onChange={(v) => change(k, v)} />)}
      </div>
      <Field label="Popis práce *" multiline value={report.work} onChange={(v) => change('work', v)} />
      <div className="rounded-lg border p-3 space-y-3"><h2 className="font-semibold">Fotografie vážních lístků *</h2>
        <p className="text-sm">Přiložte celý lístek včetně spodní části. Číslo dokladu a tuny zkontrolujte ručně. U více frakcí zadejte do pole tuny celkovou hmotnost celého lístku.</p>
        <label className="block font-semibold">Vyfotit lístek<input aria-label="Vyfotit vážní lístek" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className={inputClass} disabled={busy} onChange={(e) => { upload(Array.from(e.target.files)); e.target.value = ''; }} /></label>
        <label className="block font-semibold">Přidat fotografie nebo PDF<input aria-label="Přidat vážní lístky" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className={inputClass} disabled={busy} onChange={(e) => { upload(Array.from(e.target.files)); e.target.value = ''; }} /></label>
        {report.tickets.map((t, i) => <div key={t.attachment_id} className="rounded-lg bg-slate-50 p-3 space-y-2"><Button variant="outline" className="h-auto min-h-[48px] max-w-full whitespace-normal" onClick={() => preview(t).catch((e) => toast.error(errText(e)))}>{t.name || 'Otevřít lístek'}</Button>
          <div className="grid gap-3 sm:grid-cols-3">{[['Číslo lístku', 'number'], ['Frakce / materiál', 'fraction'], ['Celkem na lístku (t)', 'tonnes']].map(([label, k]) => <Field key={k} label={label} value={t[k]} onChange={(v) => change('tickets', report.tickets.map((ticket, j) => j === i ? { ...ticket, [k]: v } : ticket))} />)}</div>
          <Button variant="ghost" onClick={() => change('tickets', report.tickets.filter((_, j) => j !== i))}>Odebrat z výkazu</Button>
        </div>)}
        <p className="font-semibold">Automatická celková tonáž z vyplněných lístků: {total.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} t</p>
        {(known.length !== report.tickets.length || !known.length) && <p className="rounded-lg bg-amber-50 p-3 text-sm">Součet je neúplný. Doplňte hmotnost každého lístku; zatím lze uložit jen koncept.</p>}
      </div>
      <Field label="Poznámka / důvod opravy" multiline value={report.note} onChange={(v) => change('note', v)} />
      <label className="flex min-h-12 items-center gap-3 rounded border p-3 font-semibold"><input type="checkbox" checked={!!report.shift_closed} onChange={e => change('shift_closed', e.target.checked)} />Směna skončila a sesbíral(a) jsem všechny vážní lístky.</label>
      <p className="text-sm text-slate-600">Odevzdání není podpis odběratele. PDF obsahuje místo pro jeho podpis.</p>
      <div className="flex flex-wrap gap-3"><Button variant="outline" className="h-14" disabled={busy} onClick={() => save(false)}>Uložit koncept</Button><Button className="btn-primary h-14" disabled={busy} onClick={() => save(true)}>Odevzdat s lístky</Button>
        <Button variant="ghost" className="h-14" disabled={busy} onClick={async () => { if (window.confirm('Zahodit rozepsanou verzi v tomto telefonu?')) { await del(key); setReport(null); } }}>Zahodit rozepsanou verzi</Button></div>
    </div>}
    <h2 className="text-xl font-semibold">{atLeast(user, 'manager') ? 'Výkazy všech posádek' : 'Moje společné výkazy'}</h2>
    {list.error && <p className="rounded-lg bg-amber-50 p-3">{errText(list.error)} Výkazy ze serveru se nepodařilo načíst.</p>}
    {[...all.values()].sort((a, b) => b.date.localeCompare(a.date)).map((r) => <div key={r.id} className="rounded-xl border bg-white p-4 space-y-2">
      <p className="font-semibold">{r.date} · {r.site || 'Pracoviště neuvedeno'} · {r.tonnes ?? '-'} t</p>
      <p className="text-sm">{r.owner_name || user.name} · {r.pending ? 'Čeká na přijetí serverem' : r.status === 'submitted' ? 'Odevzdáno' : 'Koncept'} · {r.tickets.length} lístků</p>
      {(r.queueError || r.tonnage_warning) && <p className="text-sm text-amber-900">{r.queueError || r.tonnage_warning}</p>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-12" disabled={!!report || (r.pending && !r.queueError)} onClick={() => setReport(r)}>Otevřít / upravit</Button>{r.pending && r.queueError && <Button variant="outline" className="h-12" onClick={async () => {
        if (report || !window.confirm('Načíst poslední serverovou verzi a zahodit neodeslanou verzi tohoto výkazu?')) return;
        try {
          const { data } = await http.get('/production');
          const latest = data.find((item) => item.id === r.id);
          if (!latest) { toast.error('Výkaz zatím není na serveru. Otevřete a opravte svoji verzi.'); return; }
          for (const op of queued.filter((item) => item.refId === r.id)) await removeOp(op.opId);
          list.reload(); setReport(latest);
        } catch (e) { toast.error(errText(e)); }
      }}>Načíst serverovou verzi</Button>}<Button variant="outline" className="h-12" disabled={r.pending} onClick={() => downloadFile(`/production/${r.id}/pdf`, `DEMSTAV_vykaz_${r.date}.pdf`).catch((e) => toast.error(errText(e)))}>PDF včetně lístků</Button>{['xlsx', 'csv'].map(format => <Button key={format} variant="outline" className="h-12" disabled={r.pending} onClick={() => downloadFile(`/production/${r.id}/data?format=${format}`, `DEMSTAV_vazeni_${r.date}.${format}`).catch(e => toast.error(errText(e)))}>{format.toUpperCase()}</Button>)}</div>
    </div>)}
  </div>;
}
