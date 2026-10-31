import React, { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Truck } from "lucide-react";
import { remainingText } from "@/lib/serviceNotify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, Field, Empty } from "@/components/Section";
import { useCached } from "@/lib/data";
import { http, errText } from "@/lib/api";
import { useAuth, atLeast } from "@/lib/auth";

export default function Machines({ serviceOnly = false }) {
  const { user } = useAuth();
  const canEdit = atLeast(user, "manager");
  const q = useCached("/machines");
  const [form, setForm] = useState(null);
  const save = async () => {
    if (!canEdit) return;
    try { if (form.id) await http.put(`/machines/${form.id}`, form); else await http.post("/machines", form); toast.success("Stroj uložen"); setForm(null); q.reload(); } catch (e) { toast.error(errText(e)); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title={serviceOnly ? "Servis strojů" : "Seznam strojů"} subtitle={serviceOnly ? "Vyberte stroj pro přehled servisních intervalů." : "Vyberte stroj pro zobrazení tabulky údajů."}
        actions={canEdit && <Button className="btn-primary h-12 font-semibold" onClick={() => setForm({ label: "", type: "", internal_number: "", serial_number: "", plate: "", manufacturer: "", year: "", power_kw: "", weight_kg: "", operating_hours: "", note: "", service_interval_mth: 500, service_warn_mth: 100, last_service_mth: "", active: true })} data-testid="machine-create-button"><Plus className="mr-1 h-5 w-5" />Přidat stroj</Button>} />
      {!q.loading && !(q.data || []).length && <Empty icon={Truck} title="Zatím žádný stroj" text={canEdit ? "Přidejte stroje, se kterými firma pracuje (např. Liebherr L566/3)." : "Seznam strojů doplní vedení."} />}
      <div className="space-y-2">{[...(q.data || [])].sort((a, b) => a.label.localeCompare(b.label, "cs", { numeric: true })).map((m) => (
        <details key={m.id} className="rounded-xl border border-slate-200 bg-white" data-testid="machine-item">
          <summary className="cursor-pointer px-4 py-3 font-heading font-semibold focus-visible:outline focus-visible:outline-2">{m.label}</summary>
          <div className="border-t border-slate-200 p-4">
            <table className="w-full text-sm" aria-label={`${serviceOnly ? "Servis" : "Údaje stroje"} ${m.label}`}><tbody>
              {(serviceOnly ? [] : [["Typ", m.type], ["Interní číslo", m.internal_number], ["Výrobní číslo / VIN", m.serial_number], ["SPZ", m.plate], ["Výrobce", m.manufacturer], ["Rok výroby", m.year], ["Výkon (kW)", m.power_kw], ["Hmotnost (kg)", m.weight_kg]]).concat([
                ["Aktuální MTH", m.current_mth ?? m.operating_hours], ["Servisní stav", m.service_state === "unknown" || !m.service_state ? "Aktuální MTH nejsou známé" : remainingText(m)],
                ["Další servis (MTH)", m.next_service_mth], ["Interval (MTH)", m.service_interval_mth ?? 500], ["Upozornění předem (MTH)", m.service_warn_mth ?? 100], ["Poslední servis (MTH)", m.last_service_mth],
                ["Stav stroje", m.active ? "V provozu" : "Vyřazený"], ["Poznámka", m.note]
              ]).map(([label, value]) => <tr key={label} className="border-b border-slate-100 last:border-0"><th scope="row" className="w-1/2 py-2 pr-3 text-left align-top font-medium text-slate-600">{label}</th><td className="break-words py-2 align-top">{value === null || value === undefined || value === "" ? "—" : String(value)}</td></tr>)}
            </tbody></table>
            {canEdit && <Button variant="outline" className="mt-3" onClick={() => setForm({ ...m })} data-testid="machine-edit-button"><Pencil className="mr-2 h-4 w-4" />Upravit stroj</Button>}
          </div>
        </details>))}</div>
      <Dialog open={canEdit && !!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-md" data-testid="machine-dialog">
          <DialogHeader><DialogTitle className="font-heading">{form?.id ? "Upravit stroj" : "Nový stroj"}</DialogTitle><DialogDescription>Úprava evidence stroje a pravidelného servisu.</DialogDescription></DialogHeader>
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
