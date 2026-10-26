import React, { useState } from "react";
import { toast } from "sonner";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Field } from "@/components/Section";
import { useAuth, atLeast } from "@/lib/auth";
import { useCached } from "@/lib/data";
import { useSync } from "@/lib/sync";
import { downloadFile, errText } from "@/lib/api";
import { pragueDate, weekRange } from "@/lib/format";

export default function Exports() {
  const { user } = useAuth();
  const s = useSync();
  const mgr = atLeast(user, "manager");
  const [wf, wt] = weekRange(pragueDate());
  const [from, setFrom] = useState(wf);
  const [to, setTo] = useState(wt);
  const [emp, setEmp] = useState(mgr ? "all" : user.id);
  const [machine, setMachine] = useState("");
  const [drafts, setDrafts] = useState(true);
  const [busy, setBusy] = useState("");
  const users = useCached("/users", { enabled: mgr });
  const machines = useCached("/machines");
  const q = () => new URLSearchParams({ date_from: from, date_to: to, include_drafts: drafts ? "1" : "0", ...(mgr && emp !== "all" ? { employee_id: emp } : {}) });
  const run = async (kind) => {
    setBusy(kind);
    try {
      const p = q(); if (kind === "denik" && machine) p.set("machine", machine);
      await downloadFile(`/exports/${kind === "sicht" ? "sichtovnice" : "denik"}.pdf?${p}`, `DEMSTAV_${kind === "sicht" ? "sichtovnice" : "provozni_denik"}_${from}_${to}.pdf`);
      toast.success("PDF staženo");
    } catch (e) { toast.error(errText(e)); } finally { setBusy(""); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title="Exporty PDF" subtitle="Podle firemních vzorů. Vznikají ze stejných uložených zápisů a stejného výpočtu jako obrazovka." />
      {s.queue.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">V telefonu čeká {s.queue.length} neodeslaných položek – export obsahuje jen to, co už přijal server.</div>}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <Field label="Od"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-12" data-testid="export-from-input" /></Field>
        <Field label="Do"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-12" data-testid="export-to-input" /></Field>
        {mgr && <Field label="Zaměstnanec"><Select value={emp} onValueChange={setEmp}><SelectTrigger className="h-12" data-testid="export-employee-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Všichni (každý zvlášť)</SelectItem>{(users.data || []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></Field>}
        <Field label="Stroj (jen pro provozní deník)"><Select value={machine || "all"} onValueChange={(v) => setMachine(v === "all" ? "" : v)}><SelectTrigger className="h-12" data-testid="export-machine-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Všechny stroje</SelectItem>{(machines.data || []).map((m) => <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>)}</SelectContent></Select></Field>
        <label className="flex items-center gap-3 sm:col-span-2"><Switch checked={drafts} onCheckedChange={setDrafts} data-testid="export-include-drafts-switch" /><span className="text-sm font-medium">Zahrnout nepotvrzené koncepty (PDF je označí jako PRACOVNÍ VERZE)</span></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button className="btn-primary h-20 text-base font-semibold" disabled={!!busy || !s.online} onClick={() => run("sicht")} data-testid="export-timesheet-button">{busy === "sicht" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileDown className="mr-2 h-6 w-6" />}Týdenní výkaz (šichtovnice)</Button>
        <Button variant="outline" className="h-20 border-2 border-slate-900 text-base font-semibold" disabled={!!busy || !s.online} onClick={() => run("denik")} data-testid="export-diary-button">{busy === "denik" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileDown className="mr-2 h-6 w-6" />}Provozní deník stroje</Button>
      </div>
      {!s.online && <p className="text-sm text-amber-800">Export vyžaduje připojení k serveru.</p>}
      <p className="text-xs text-slate-600">Šichtovnice: 13 sloupců původního formuláře, servisní příloha, textové doplnění s revizemi a přiložené doklady. Součty počítají každou minutu zaměstnance jen jednou i při střídání strojů. PDF je výstup pro čtení a tisk, nikoli úplná záloha historie.</p>
    </div>
  );
}
