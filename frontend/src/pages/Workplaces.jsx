import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Pencil, QrCode, MonitorSmartphone, LocateFixed, MapPin } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Field, Empty } from "@/components/Section";
import { useCached } from "@/lib/data";
import { http, errText } from "@/lib/api";
import { MODE_LABELS } from "@/lib/format";

const EMPTY = { name: "", address: "", mode: "gps_or_qr", qr_mode: "dynamic", latitude: "", longitude: "", radius: 150, max_accuracy: 50, active: true };

export default function Workplaces() {
  const q = useCached("/workplaces?all=1");
  const [form, setForm] = useState(null);
  const [staticQr, setStaticQr] = useState(null);
  const save = async () => {
    const body = { ...form, latitude: form.latitude === "" ? "" : Number(form.latitude), longitude: form.longitude === "" ? "" : Number(form.longitude), radius: Number(form.radius), max_accuracy: Number(form.max_accuracy) };
    try { if (form.id) await http.put(`/workplaces/${form.id}`, body); else await http.post("/workplaces", body); toast.success("Pracoviště uloženo"); setForm(null); q.reload(); } catch (e) { toast.error(errText(e)); }
  };
  const locate = () => navigator.geolocation?.getCurrentPosition((p) => setForm((f) => ({ ...f, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })), () => toast.error("Polohu nelze zjistit."), { enableHighAccuracy: true, timeout: 15000 });
  const issueStatic = async (w) => { if (!window.confirm("Vytvořit nový statický QR? Předchozí QR tohoto pracoviště přestane platit.")) return; try { const { data } = await http.post(`/workplaces/${w.id}/qr/static`); setStaticQr({ ...data, name: w.name }); q.reload(); } catch (e) { toast.error(errText(e)); } };
  const toDynamic = async (w) => { try { await http.post(`/workplaces/${w.id}/qr/rotate`); toast.success("Zapnut časově omezený QR; staré kódy neplatí."); q.reload(); } catch (e) { toast.error(errText(e)); } };
  return (
    <div className="space-y-4">
      <PageHeader title="Pracoviště" subtitle="Název, adresa a způsob ověření docházky. GPS se použije jen při konkrétní události, nikoli k trvalému sledování."
        actions={<Button className="btn-primary h-12 font-semibold" onClick={() => setForm({ ...EMPTY })} data-testid="workplace-create-button"><Plus className="mr-1 h-5 w-5" />{(q.data || []).length ? "Nové pracoviště" : "Založit první pracoviště"}</Button>} />
      {!q.loading && !(q.data || []).length && <Empty icon={MapPin} title="Zatím žádné pracoviště" text="Bez pracoviště nelze zapisovat docházku. Ruční režim nevyžaduje souřadnice." />}
      <div className="grid gap-3 lg:grid-cols-2">{(q.data || []).map((w) => (
        <div key={w.id} className={`space-y-3 rounded-xl border bg-white p-4 shadow-sm ${w.active ? "border-slate-200" : "border-dashed border-slate-300 opacity-70"}`} data-testid="workplace-item">
          <div className="flex items-start justify-between gap-2"><div><div className="font-heading text-lg font-semibold">{w.name}</div><div className="text-sm text-slate-600">{w.address}</div></div>
            <Button variant="ghost" size="sm" onClick={() => setForm({ ...EMPTY, ...w, latitude: w.has_location ? w.latitude : "", longitude: w.has_location ? w.longitude : "" })} data-testid="workplace-edit-button"><Pencil className="h-4 w-4" /></Button></div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded bg-slate-900 px-2 py-1 text-white">{MODE_LABELS[w.mode]}</span>{w.mode.includes("gps") && <span className="rounded bg-slate-100 px-2 py-1">okruh {w.radius} m · přesnost ≤ {w.max_accuracy} m</span>}{w.mode.includes("qr") && <span className="rounded bg-slate-100 px-2 py-1">QR {w.qr_mode === "dynamic" ? "časově omezený" : "statický"} v{w.qr_version}</span>}{!w.active && <span className="rounded bg-red-100 px-2 py-1 text-red-900">neaktivní</span>}</div>
          {w.mode.includes("qr") && <div className="flex flex-wrap gap-2">
            {w.qr_mode === "dynamic" ? <Link to={`/pracoviste/${w.id}/qr`} target="_blank"><Button variant="outline" className="h-11" data-testid="workplace-qr-display-button"><MonitorSmartphone className="mr-1 h-4 w-4" />Zobrazit QR na tabletu</Button></Link>
              : <Button variant="outline" className="h-11" onClick={() => toDynamic(w)} data-testid="workplace-qr-dynamic-button">Přepnout na časově omezený QR</Button>}
            <Button variant="outline" className="h-11" onClick={() => issueStatic(w)} data-testid="workplace-qr-static-button"><QrCode className="mr-1 h-4 w-4" />Statický QR k vytištění</Button>
          </div>}
        </div>))}</div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" data-testid="workplace-dialog">
          <DialogHeader><DialogTitle className="font-heading">{form?.id ? "Upravit pracoviště" : "Nové pracoviště"}</DialogTitle><DialogDescription>Poloměr 150 m je jen výchozí příklad, nikoli zákonná hodnota.</DialogDescription></DialogHeader>
          {form && <div className="space-y-3">
            <Field label="Název"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12" data-testid="workplace-name-input" /></Field>
            <Field label="Adresa"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-12" data-testid="workplace-address-input" /></Field>
            <Field label="Ověření docházky"><Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}><SelectTrigger className="h-12" data-testid="workplace-mode-select"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MODE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></Field>
            {form.mode.includes("qr") && !form.id && <Field label="Typ QR"><Select value={form.qr_mode} onValueChange={(v) => setForm({ ...form, qr_mode: v })}><SelectTrigger className="h-12" data-testid="workplace-qr-mode-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dynamic">Časově omezený podepsaný (tablet na pracovišti)</SelectItem><SelectItem value="static">Statický (vytištěný – lze vyfotit a přeposlat)</SelectItem></SelectContent></Select></Field>}
            {form.mode.includes("gps") && <>
              <div className="grid grid-cols-2 gap-3"><Field label="Zem. šířka"><Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="h-12" data-testid="workplace-lat-input" /></Field><Field label="Zem. délka"><Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="h-12" data-testid="workplace-lng-input" /></Field></div>
              <Button type="button" variant="outline" className="h-11" onClick={locate} data-testid="workplace-locate-button"><LocateFixed className="mr-1 h-4 w-4" />Použít moji aktuální polohu</Button>
              <div className="grid grid-cols-2 gap-3"><Field label="Poloměr (m)"><Input type="number" value={form.radius} onChange={(e) => setForm({ ...form, radius: e.target.value })} className="h-12" data-testid="workplace-radius-input" /></Field><Field label="Max. nepřesnost GPS (m)"><Input type="number" value={form.max_accuracy} onChange={(e) => setForm({ ...form, max_accuracy: e.target.value })} className="h-12" data-testid="workplace-accuracy-input" /></Field></div>
            </>}
            <label className="flex items-center gap-3"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="workplace-active-switch" />Aktivní</label>
          </div>}
          <DialogFooter><Button className="btn-primary h-12 w-full font-semibold" onClick={save} data-testid="workplace-save-button">Uložit pracoviště</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!staticQr} onOpenChange={(o) => !o && setStaticQr(null)}>
        <DialogContent className="max-w-sm" data-testid="static-qr-dialog">
          <DialogHeader><DialogTitle className="font-heading">Statický QR – {staticQr?.name}</DialogTitle><DialogDescription>Vytištěte a vyvěste. Kód se zobrazí jen nyní; server ukládá pouze jeho otisk.</DialogDescription></DialogHeader>
          {staticQr && <div className="flex flex-col items-center gap-3"><QRCodeSVG value={staticQr.value} size={220} /><code className="break-all rounded bg-slate-100 p-2 text-xs" data-testid="static-qr-value">{staticQr.value}</code><Button variant="outline" onClick={() => window.print()}>Tisk</Button></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
