import React, { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Truck } from "lucide-react";
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
        actions={<Button className="btn-primary h-12 font-semibold" onClick={() => setForm({ label: "", type: "", internal_number: "", serial_number: "", plate: "", active: true })} data-testid="machine-create-button"><Plus className="mr-1 h-5 w-5" />Přidat stroj</Button>} />
      {!q.loading && !(q.data || []).length && <Empty icon={Truck} title="Zatím žádný stroj" text="Přidejte stroje, se kterými firma pracuje (např. Liebherr L566/3)." />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(q.data || []).map((m) => (
        <div key={m.id} className={`flex items-start justify-between rounded-xl border bg-white p-4 shadow-sm ${m.active ? "border-slate-200" : "border-dashed opacity-70"}`} data-testid="machine-item">
          <div><div className="font-heading text-lg font-semibold">{m.label}</div><div className="text-sm text-slate-600">{[m.type, m.internal_number && `int. č. ${m.internal_number}`, m.serial_number && `v. č. ${m.serial_number}`, m.plate && `SPZ ${m.plate}`].filter(Boolean).join(" · ") || "—"}</div>{!m.active && <div className="text-xs font-semibold text-red-800">vyřazený</div>}</div>
          <Button variant="ghost" size="sm" onClick={() => setForm({ ...m })} data-testid="machine-edit-button"><Pencil className="h-4 w-4" /></Button>
        </div>))}</div>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-md" data-testid="machine-dialog">
          <DialogHeader><DialogTitle className="font-heading">{form?.id ? "Upravit stroj" : "Nový stroj"}</DialogTitle><DialogDescription>Servisní intervaly a karta stroje budou v další etapě.</DialogDescription></DialogHeader>
          {form && <div className="space-y-3">
            <Field label="Název (jak se zobrazí v zápisu)"><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="h-12" placeholder="Liebherr L566/3" data-testid="machine-label-input" /></Field>
            <Field label="Typ / značka / model"><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-12" data-testid="machine-type-input" /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Interní číslo"><Input value={form.internal_number} onChange={(e) => setForm({ ...form, internal_number: e.target.value })} className="h-12" data-testid="machine-internal-input" /></Field>
              <Field label="SPZ"><Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} className="h-12" data-testid="machine-plate-input" /></Field></div>
            <Field label="VIN / výrobní číslo"><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} className="h-12" data-testid="machine-serial-input" /></Field>
            <label className="flex items-center gap-3"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="machine-active-switch" />V provozu</label>
          </div>}
          <DialogFooter><Button className="btn-primary h-12 w-full font-semibold" onClick={save} data-testid="machine-save-button">Uložit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
