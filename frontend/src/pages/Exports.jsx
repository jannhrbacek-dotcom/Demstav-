import React, { useState } from "react";
import { toast } from "sonner";
import { FileDown, Loader2, CalendarClock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Field } from "@/components/Section";
import { useAuth, atLeast } from "@/lib/auth";
import { useCached } from "@/lib/data";
import { useSync } from "@/lib/sync";
import { http, downloadFile, errText } from "@/lib/api";
import { dmy, dateTime, pragueDate, weekRange } from "@/lib/format";
import { POSITIONS } from "@/lib/roles";

const ALL = "all";

export default function Exports() {
  const { user } = useAuth();
  const s = useSync();
  const mgr = atLeast(user, "manager");
  const [wf, wt] = weekRange(pragueDate());
  const [from, setFrom] = useState(wf);
  const [to, setTo] = useState(wt);
  const [emp, setEmp] = useState(mgr ? ALL : user.id);
  const [machine, setMachine] = useState("");
  const [wpId, setWpId] = useState("");
  const [status, setStatus] = useState("");
  const [position, setPosition] = useState("");
  const [drafts, setDrafts] = useState(true);
  const [duplex, setDuplex] = useState(true);
  const [busy, setBusy] = useState("");
  const users = useCached("/users", { enabled: mgr });
  const machines = useCached("/machines");
  const wps = useCached("/workplaces");
  const weekly = useCached("/exports/weekly", { enabled: mgr });
  const base = () => new URLSearchParams({ date_from: from, date_to: to, ...(mgr && emp !== ALL ? { employee_id: emp } : {}) });

  const run = async (key, path, name) => {
    setBusy(key);
    try { await downloadFile(path, name); toast.success("Staženo"); } catch (e) { toast.error(errText(e)); } finally { setBusy(""); }
  };
  const pdf = (kind) => {
    const p = base(); p.set("include_drafts", drafts ? "1" : "0");
    if (kind === "denik" && machine) p.set("machine", machine);
    if (kind === "sicht" && duplex) p.set("duplex", "1");
    run(kind, `/exports/${kind === "sicht" ? "sichtovnice" : "denik"}.pdf?${p}`, `DEMSTAV_${kind === "sicht" ? "sichtovnice" : "provozni_denik"}_${from}_${to}.pdf`);
  };
  const data = (dataset, format) => {
    const p = base(); p.set("dataset", dataset); p.set("format", format);
    if (dataset === "machine_log") p.set("include_drafts", drafts ? "1" : "0");
    if (machine && (dataset === "timesheet" || dataset === "machine_log")) p.set("machine", machine);
    if (wpId) { if (dataset === "attendance") p.set("workplace_id", wpId); else p.set("workplace", (wps.data || []).find((w) => w.id === wpId)?.name || ""); }
    if (status) p.set("status", dataset === "attendance" ? (status === "pending" ? "pending" : "") : (status === "pending" ? "" : status));
    if (position) p.set("position", position);
    const nameMap = { timesheet: "sichtovnice", attendance: "dochazka", machine_log: "stavebni_denik_stroje" };
    run(`${dataset}-${format}`, `/exports/data?${p}`, `DEMSTAV_${nameMap[dataset]}_${from}_${to}.${format}`);
  };
  const genWeek = async () => {
    setBusy("gen");
    try { await http.post("/exports/weekly/generate", {}, { timeout: 120000 }); toast.success("Týdenní export připraven"); weekly.reload(); } catch (e) { toast.error(errText(e)); } finally { setBusy(""); }
  };
  const Btn = ({ k, onClick, children, testid, primary }) => (
    <Button className={primary ? "btn-primary h-14 font-semibold" : "h-14 border-2 border-slate-900 font-semibold"} variant={primary ? "default" : "outline"} disabled={!!busy || !s.online} onClick={onClick} data-testid={testid}>
      {busy === k ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileDown className="mr-2 h-5 w-5" />}{children}
    </Button>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Exporty a reporty" subtitle="PDF podle firemních vzorů a data do XLSX / CSV podle libovolného filtru." />
      {s.queue.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">V telefonu čeká {s.queue.length} neodeslaných položek – export obsahuje jen to, co už přijal server.</div>}

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3" data-testid="export-filters">
        <Field label="Od"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-12" data-testid="export-from-input" /></Field>
        <Field label="Do"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-12" data-testid="export-to-input" /></Field>
        {mgr && <Field label="Zaměstnanec"><Select value={emp} onValueChange={setEmp}><SelectTrigger className="h-12" data-testid="export-employee-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Všichni</SelectItem>{(users.data || []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></Field>}
        {mgr && <Field label="Zařazení"><Select value={position || ALL} onValueChange={(v) => setPosition(v === ALL ? "" : v)}><SelectTrigger className="h-12" data-testid="export-position-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Všechna zařazení</SelectItem>{POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></Field>}
        <Field label="Stroj"><Select value={machine || ALL} onValueChange={(v) => setMachine(v === ALL ? "" : v)}><SelectTrigger className="h-12" data-testid="export-machine-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Všechny stroje</SelectItem>{(machines.data || []).map((m) => <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Pracoviště"><Select value={wpId || ALL} onValueChange={(v) => setWpId(v === ALL ? "" : v)}><SelectTrigger className="h-12" data-testid="export-workplace-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Všechna pracoviště</SelectItem>{(wps.data || []).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Stav"><Select value={status || ALL} onValueChange={(v) => setStatus(v === ALL ? "" : v)}><SelectTrigger className="h-12" data-testid="export-status-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Vše</SelectItem><SelectItem value="confirmed">Jen potvrzené zápisy</SelectItem><SelectItem value="draft">Jen koncepty</SelectItem><SelectItem value="pending">Docházka s výjimkou ke schválení</SelectItem></SelectContent></Select></Field>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-heading text-lg font-semibold">PDF podle firemních vzorů</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-3"><Switch checked={drafts} onCheckedChange={setDrafts} data-testid="export-include-drafts-switch" /><span className="text-sm font-medium">Zahrnout koncepty (označí se PRACOVNÍ VERZE)</span></label>
          <label className="flex items-center gap-3"><Switch checked={duplex} onCheckedChange={setDuplex} data-testid="export-duplex-switch" /><span className="text-sm font-medium">Šichtovnice pro oboustranný tisk</span></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Btn k="sicht" primary onClick={() => pdf("sicht")} testid="export-timesheet-button">Šichtovnice PDF</Btn>
          <Btn k="denik" onClick={() => pdf("denik")} testid="export-diary-button">Provozní deník stroje PDF</Btn>
        </div>
        <p className="text-xs text-slate-600">Oboustranný tisk: lícní strana = týdenní výkaz, rub = popis servisů a závad; každý výkaz začíná na novém listu (případně se vloží prázdná strana).</p>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-heading text-lg font-semibold">Data do XLSX a CSV</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Btn k="attendance-xlsx" onClick={() => data("attendance", "xlsx")} testid="export-attendance-xlsx">Docházka a směny XLSX</Btn>
          <Btn k="attendance-csv" onClick={() => data("attendance", "csv")} testid="export-attendance-csv">Docházka a směny CSV</Btn>
          <Btn k="timesheet-xlsx" onClick={() => data("timesheet", "xlsx")} testid="export-timesheet-xlsx">Šichtovnice XLSX</Btn>
          <Btn k="timesheet-csv" onClick={() => data("timesheet", "csv")} testid="export-timesheet-csv">Šichtovnice CSV</Btn>
        </div>
        <p className="text-xs text-slate-600">CSV je oddělené středníkem s desetinnou čárkou – Excel ho otevře česky. Docházka obsahuje i schválené a čekající nepřítomnosti.</p>
        <div className="mt-2 border-t border-slate-100 pt-3">
          <h3 className="font-heading text-base font-semibold">Stavební deník stroje – XLSX s listy per stroj</h3>
          <p className="mb-2 text-xs text-slate-600">Vygeneruje přehledový list + jeden list pro každý stroj. Řádek na den: kontroly, MTH, závady, servis, popis práce, autor, revize i otisk pro audit.</p>
          <Btn k="machine-log-xlsx" primary onClick={() => data("machine_log", "xlsx")} testid="export-machine-log-xlsx">Stavební deník stroje XLSX</Btn>
        </div>
      </section>

      {mgr && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="weekly-exports">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><CalendarClock className="h-5 w-5" />Automatické týdenní exporty</h2>
            <Button variant="outline" className="h-11" disabled={!!busy || !s.online} onClick={genWeek} data-testid="weekly-generate-button">{busy === "gen" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}Připravit minulý týden teď</Button>
          </div>
          <p className="text-xs text-slate-600">Každé pondělí v 5:00 se samo připraví: šichtovnice všech zaměstnanců za minulý týden (PDF oboustranně, XLSX, CSV).</p>
          {(weekly.data || []).length === 0 && <p className="text-sm text-slate-600">Zatím žádný připravený týden.</p>}
          {(weekly.data || []).map((w) => (
            <div key={w.week} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3" data-testid="weekly-export-item">
              <div className="min-w-0 flex-1"><div className="font-semibold">Týden {dmy(w.week)} – {dmy(w.week_end)}</div><div className="text-xs text-slate-600">{w.records} zápisů · {w.employees} zaměstnanců · připraveno {dateTime(w.generated_at)} ({w.generated_by})</div></div>
              {["pdf", "xlsx", "csv"].map((f) => <Button key={f} variant="outline" className="h-10" disabled={!!busy} onClick={() => run(`w-${w.week}-${f}`, `/exports/weekly/${w.week}/${f}`, `DEMSTAV_sichtovnice_tyden_${w.week}.${f}`)} data-testid={`weekly-download-${f}`}><FileDown className="mr-1 h-4 w-4" />{f.toUpperCase()}</Button>)}
            </div>
          ))}
        </section>
      )}
      {!s.online && <p className="text-sm text-amber-800">Export vyžaduje připojení k serveru.</p>}
    </div>
  );
}
