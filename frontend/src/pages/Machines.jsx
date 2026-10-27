import React, { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Truck, Wrench } from "lucide-react";
import { remainingText } from "@/lib/serviceNotify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, Field, Empty } from "@/components/Section";
import { useCached } from "@/lib/data";
import { http, errText } from "@/lib/api";

export default function Machines() {
  const q = useCached("/machines");
  const [form, setForm] = useState(null);
  const save = async () => {
    try { if (form.id) await http.put(`/machines/${form.id}`, form); else await http.post("/machines", form); toast.success("Stroj uložen"); setForm(null); q.reload(); } catch (e) { toast.error(errText(e)); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Seznam strojů" subtitle="Nabízí se strojníkům při zápisu, aby se názvy nepsaly pokaždé jinak."
        actions={<Button className="btn-primary h-12 font-semibold" onClick={() => setForm({ label: "", type: "", internal_number: "", serial_number: "", plate: "", manufacturer: "", year: "", power_kw: "", weight_kg: "", operating_hours: "", note: "", service_interval_mth: 500, service_warn_mth: 100, last_service_mth: "", active: true })} data-testid="machine-create-button"><Plus className="mr-1 h-5 w-5" />Přidat stroj</Button>} />
      {!q.loading && !(q.data || []).length && <Empty icon={Truck} title="Zatím žádný stroj" text="Přidejte stroje, se kterými firma pracuje (např. Liebherr L566/3)." />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(q.data || []).map((m) => (
        <div key={m.id} className={`flex items-start justify-between rounded-xl border bg-white p-4 shadow-sm ${m.active ? "border-slate-200" : "border-dashed opacity-70"}`} data-testid="machine-item">
          <div><div className="font-heading text-lg font-semibold">{m.label}</div><div className="text-sm text-slate-600">{[m.type, m.internal_number && `int. č. ${m.internal_number}`, m.serial_number && `v. č. ${m.serial_number}`, m.plate && `SPZ ${m.plate}`].filter(Boolean).join(" · ") || "—"}</div>
            <div className="mt-1 text-xs text-slate-500" data-testid="machine-specs">{[m.year && `r. v. ${m.year}`, m.power_kw && `${m.power_kw} kW`, m.weight_kg && `${Number(m.weight_kg).toLocaleString("cs-CZ")} kg`, m.operating_hours != null && m.operating_hours !== "" && `MTH ${String(m.operating_hours).replace(".", ",")}`].filter(Boolean).join(" · ")}</div>
            {m.note && <div className="mt-1 text-xs text-slate-600">{m.note}</div>}
            {m.service_state && m.service_state !== "unknown" && (
              <div className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${m.service_state === "due" ? "bg-black text-[#FFD200]" : m.service_state === "soon" ? "bg-amber-200 text-amber-950" : "bg-slate-100 text-slate-800"}`} data-testid="machine-service-status">
                <Wrench className="h-3.5 w-3.5" />{remainingText(m)} · servis při {m.next_service_mth} mth
              </div>
            )}
            {m.service_state === "unknown" && <div className="mt-2 text-xs text-slate-500" data-testid="machine-service-status">Servisní interval: doplňte aktuální MTH</div>}{!m.active && <div className="text-xs font-semibold text-red-800">vyřazený</div>}</div>
          <Button variant="ghost" size="sm" onClick={() => setForm({ ...m })} data-testid="machine-edit-button"><Pencil className="h-4 w-4" /></Button>
        </div>))}</div>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-md" data-testid="machine-dialog">
          <DialogHeader><DialogTitle className="font-heading">{form?.id ? "Upravit stroj" : "Nový stroj"}</DialogTitle><DialogDescription>Servisní intervaly a karta stroje budou v další etapě.</DialogDescription></DialogHeader>
          {form && <div className="space-y-3">
            <Field label="Název stroje s číslem (zobrazí se v zápisu)" hint="Typ / číslo stroje, např. L566/3 nebo L576/7."><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="h-12" placeholder="např. L566/3" data-testid="machine-label-input" /></Field>
            <Field label="Typ / značka / model"><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-12" data-testid="machine-type-input" /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Interní číslo"><Input value={form.internal_number} onChange={(e) => setForm({ ...form, internal_number: e.target.value })} className="h-12" data-testid="machine-internal-input" /></Field>
              <Field label="SPZ"><Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} className="h-12" data-testid="machine-plate-input" /></Field></div>
            <Field label="VIN / PIN / výrobní číslo"><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} className="h-12" data-testid="machine-serial-input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Výrobce"><Input value={form.manufacturer || ""} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className="h-12" placeholder="Liebherr" data-testid="machine-manufacturer-input" /></Field>
              <Field label="Rok výroby"><Input inputMode="numeric" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })} className="h-12" data-testid="machine-year-input" /></Field>
              <Field label="Výkon motoru (kW)"><Input inputMode="decimal" value={form.power_kw ?? ""} onChange={(e) => setForm({ ...form, power_kw: e.target.value })} className="h-12" data-testid="machine-power-input" /></Field>
              <Field label="Celková hmotnost (kg)"><Input inputMode="decimal" value={form.weight_kg ?? ""} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} className="h-12" data-testid="machine-weight-input" /></Field>
            </div>
            <Field label="Aktuální motohodiny (MTH)" hint="Použije se jako začátek MTH u prvního zápisu na tento stroj."><Input inputMode="decimal" value={form.operating_hours ?? ""} onChange={(e) => setForm({ ...form, operating_hours: e.target.value })} className="h-12" placeholder="např. 2375,4" data-testid="machine-mth-input" /></Field>
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <div className="text-sm font-semibold">Pravidelný servis</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Interval (mth)"><Input inputMode="numeric" value={form.service_interval_mth ?? 500} onChange={(e) => setForm({ ...form, service_interval_mth: e.target.value.replace(/[^\d]/g, "") })} className="h-12" data-testid="machine-interval-input" /></Field>
                <Field label="Upozornit předem (mth)"><Input inputMode="numeric" value={form.service_warn_mth ?? 100} onChange={(e) => setForm({ ...form, service_warn_mth: e.target.value.replace(/[^\d]/g, "") })} className="h-12" data-testid="machine-warn-input" /></Field>
              </div>
              <Field label="MTH při posledním servisu" hint="Nepovinné. Bez údaje se servis plánuje na nejbližší násobek intervalu (např. 2500, 3000 mth)."><Input inputMode="decimal" value={form.last_service_mth ?? ""} onChange={(e) => setForm({ ...form, last_service_mth: e.target.value })} className="h-12" data-testid="machine-last-service-input" /></Field>
            </div>
            <Field label="Poznámka"><Input value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} className="h-12" data-testid="machine-note-input" /></Field>
            <label className="flex items-center gap-3"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="machine-active-switch" />V provozu</label>
          </div>}
          <DialogFooter><Button className="btn-primary h-12 w-full font-semibold" onClick={save} data-testid="machine-save-button">Uložit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
