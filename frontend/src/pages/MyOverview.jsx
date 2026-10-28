import React, { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/Section";
import { useAuth, atLeast } from "@/lib/auth";
import { useCached } from "@/lib/data";
import { downloadFile, errText } from "@/lib/api";
import { dmy, pragueDate, weekRange } from "@/lib/format";
import { useLanguage } from "@/lib/language";

const n = (v) => (v === null || v === undefined || v === "" ? "—" : String(v).replace(".", ","));
const shift = (d, days) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + days); return x.toISOString().slice(0, 10); };

function Stat({ label, value, testid }) {
  const { t } = useLanguage();
  return <div className="rounded-xl bg-[#0B0F14] p-3 text-white" data-testid={testid}><div className="text-xs text-slate-300">{t(label)}</div><div className="font-heading text-2xl font-bold text-[#FFD200]">{value}</div></div>;
}

export default function MyOverview() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const mgr = atLeast(user, "manager");
  const [wf] = weekRange(pragueDate());
  const [from, setFrom] = useState(wf);
  const to = shift(from, 6);
  const [emp, setEmp] = useState("");
  const users = useCached("/users", { enabled: mgr });
  const q = useCached(`/my/summary?date_from=${from}&date_to=${to}${emp ? `&employee_id=${emp}` : ""}`);
  const d = q.data;
  const dl = async (path, name) => { try { await downloadFile(path, name); toast.success(t("Staženo")); } catch (e) { toast.error(errText(e)); } };
  const qs = `date_from=${from}&date_to=${to}${emp ? `&employee_id=${emp}` : mgr ? "" : ""}`;
  const empQs = emp ? `&employee_id=${emp}` : mgr ? `&employee_id=${user.id}` : "";

  return (
    <div className="space-y-4">
      <PageHeader title={t("Moje přehledy")} subtitle={t("Šichtovnice, deník stroje a směny za vybraný týden. Vidíte jen svá data.")} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="h-12 w-12" onClick={() => setFrom(shift(from, -7))} aria-label={t("Předchozí týden")} data-testid="overview-prev-week"><ChevronLeft className="h-5 w-5" /></Button>
        <div className="min-w-[200px] text-center font-heading text-lg font-semibold" data-testid="overview-week-label">{dmy(from)} – {dmy(to)}</div>
        <Button variant="outline" className="h-12 w-12" onClick={() => setFrom(shift(from, 7))} aria-label={t("Další týden")} data-testid="overview-next-week"><ChevronRight className="h-5 w-5" /></Button>
        {mgr && <Select value={emp || "me"} onValueChange={(v) => setEmp(v === "me" ? "" : v)}><SelectTrigger className="h-12 w-56" data-testid="overview-employee-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="me">Já ({user.name})</SelectItem>{(users.data || []).filter((u) => u.id !== user.id).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>}
      </div>
      {!d ? <p className="text-slate-600">{t("Načítám…")}</p> : (<>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Odpracováno (docházka)" value={`${n(d.totals.attendanceNet)} h`} testid="stat-attendance" />
          <Stat label="Šichtovnice celkem" value={`${n(d.totals.totalHours)} h`} testid="stat-timesheet" />
          <Stat label="Servis" value={`${n(d.totals.serviceHours)} h`} testid="stat-service" />
          <Stat label="Přejezdy" value={`${n(d.totals.travelHours)} h`} testid="stat-travel" />
          <Stat label="Motohodiny" value={`${n(d.totals.mth)} mth`} testid="stat-mth" />
        </div>
        {d.leaves.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" data-testid="overview-leaves">{d.leaves.map((l) => <div key={l.id}><b>{l.type_label}</b> {dmy(l.date_from)}{l.date_to !== l.date_from && ` – ${dmy(l.date_to)}`} {l.time_from && `${l.time_from}–${l.time_to}`} · {l.status_label}</div>)}</div>}
        <Tabs defaultValue="sicht">
          <TabsList className="h-12"><TabsTrigger value="sicht" className="h-10 px-4" data-testid="tab-timesheet">{t("Šichtovnice")}</TabsTrigger><TabsTrigger value="denik" className="h-10 px-4" data-testid="tab-diary">{t("Deník stroje")}</TabsTrigger><TabsTrigger value="smeny" className="h-10 px-4" data-testid="tab-shifts">{t("Směny")}</TabsTrigger></TabsList>
          <TabsContent value="sicht" className="space-y-2">
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><Table data-testid="timesheet-table"><TableHeader><TableRow><TableHead>{t("Datum")}</TableHead><TableHead>{t("Stroj")}</TableHead><TableHead>{t("Pracoviště")}</TableHead><TableHead>{t("Doba")}</TableHead><TableHead className="text-right">{t("Celkem")}</TableHead><TableHead className="text-right">{t("Servis")}</TableHead><TableHead className="text-right">{t("Prostoje")}</TableHead><TableHead className="text-right">{t("Přejezdy")}</TableHead><TableHead>{t("Stav")}</TableHead></TableRow></TableHeader>
              <TableBody>{d.timesheet.length === 0 && <TableRow><TableCell colSpan={9} className="text-slate-600">{t("Žádné zápisy v tomto týdnu.")}</TableCell></TableRow>}{d.timesheet.map((r) => <TableRow key={r["ID zápisu"]}><TableCell>{dmy(r.Datum)}</TableCell><TableCell className="font-semibold">{r.Stroj}</TableCell><TableCell>{r["Pracoviště"]}</TableCell><TableCell>{r["Pracovní doba"]}</TableCell><TableCell className="text-right">{n(r["Celkem h"])}</TableCell><TableCell className="text-right">{n(r["Servis h"])}</TableCell><TableCell className="text-right">{n(r["Prostoje h"])}</TableCell><TableCell className="text-right">{n(r["Přejezdy h"])}</TableCell><TableCell>{r.Stav}</TableCell></TableRow>)}</TableBody></Table></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11" onClick={() => dl(`/exports/sichtovnice.pdf?${qs}${empQs}&duplex=1`, `DEMSTAV_sichtovnice_${from}.pdf`)} data-testid="my-timesheet-pdf"><FileDown className="mr-1 h-4 w-4" />PDF</Button><Button variant="outline" className="h-11" onClick={() => dl(`/exports/data?dataset=timesheet&format=xlsx&${qs}${empQs}`, `DEMSTAV_sichtovnice_${from}.xlsx`)} data-testid="my-timesheet-xlsx"><FileDown className="mr-1 h-4 w-4" />XLSX</Button><Button variant="outline" className="h-11" onClick={() => dl(`/exports/data?dataset=timesheet&format=csv&${qs}${empQs}`, `DEMSTAV_sichtovnice_${from}.csv`)} data-testid="my-timesheet-csv"><FileDown className="mr-1 h-4 w-4" />CSV</Button></div>
          </TabsContent>
          <TabsContent value="denik" className="space-y-2">
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><Table data-testid="diary-table"><TableHeader><TableRow><TableHead>{t("Datum")}</TableHead><TableHead>{t("Stroj")}</TableHead><TableHead className="text-right">{t("MTH zač.")}</TableHead><TableHead className="text-right">{t("MTH konec")}</TableHead><TableHead className="text-right">{t("MTH")}</TableHead><TableHead className="text-right">{t("Nafta l")}</TableHead><TableHead>{t("Závady")}</TableHead><TableHead>{t("Servis")}</TableHead></TableRow></TableHeader>
              <TableBody>{d.timesheet.length === 0 && <TableRow><TableCell colSpan={8} className="text-slate-600">{t("Žádné zápisy v tomto týdnu.")}</TableCell></TableRow>}{d.timesheet.map((r) => <TableRow key={r["ID zápisu"]}><TableCell>{dmy(r.Datum)}</TableCell><TableCell className="font-semibold">{r.Stroj}</TableCell><TableCell className="text-right">{n(r["MTH začátek"])}</TableCell><TableCell className="text-right">{n(r["MTH konec"])}</TableCell><TableCell className="text-right">{n(r["MTH celkem"])}</TableCell><TableCell className="text-right">{n(r["Nafta l"])}</TableCell><TableCell>{r["Závady"] || "—"}</TableCell><TableCell>{r["Servis dle intervalu"] ? "servis dle intervalu" : r["Servis h"] ? `${n(r["Servis h"])} h` : "—"}</TableCell></TableRow>)}</TableBody></Table></div>
            <Button variant="outline" className="h-11" onClick={() => dl(`/exports/denik.pdf?${qs}${empQs}`, `DEMSTAV_provozni_denik_${from}.pdf`)} data-testid="my-diary-pdf"><FileDown className="mr-1 h-4 w-4" />{t("Deník stroje PDF")}</Button>
          </TabsContent>
          <TabsContent value="smeny" className="space-y-2">
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><Table data-testid="shifts-table"><TableHeader><TableRow><TableHead>{t("Datum")}</TableHead><TableHead>{t("Pracoviště")}</TableHead><TableHead>{t("Příchod")}</TableHead><TableHead>{t("Odchod")}</TableHead><TableHead className="text-right">{t("Přestávky")}</TableHead><TableHead className="text-right">{t("Přejezdy")}</TableHead><TableHead className="text-right">{t("Odpracováno")}</TableHead><TableHead>{t("Nepřítomnost / stav")}</TableHead></TableRow></TableHeader>
              <TableBody>{d.attendance.length === 0 && <TableRow><TableCell colSpan={8} className="text-slate-600">{t("Žádné směny v tomto týdnu.")}</TableCell></TableRow>}{d.attendance.map((r, i) => <TableRow key={i}><TableCell>{dmy(r.Datum)}</TableCell><TableCell>{r["Pracoviště"]}</TableCell><TableCell>{r["Příchod"] || "—"}</TableCell><TableCell>{r.Odchod || "—"}</TableCell><TableCell className="text-right">{n(r["Přestávky h"])}</TableCell><TableCell className="text-right">{n(r["Přejezdy h"])}</TableCell><TableCell className="text-right font-semibold">{n(r["Odpracováno h"])}</TableCell><TableCell>{r["Nepřítomnost"] || r.Stav}</TableCell></TableRow>)}</TableBody></Table></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11" onClick={() => dl(`/exports/data?dataset=attendance&format=xlsx&${qs}${empQs}`, `DEMSTAV_dochazka_${from}.xlsx`)} data-testid="my-shifts-xlsx"><FileDown className="mr-1 h-4 w-4" />XLSX</Button><Button variant="outline" className="h-11" onClick={() => dl(`/exports/data?dataset=attendance&format=csv&${qs}${empQs}`, `DEMSTAV_dochazka_${from}.csv`)} data-testid="my-shifts-csv"><FileDown className="mr-1 h-4 w-4" />CSV</Button></div>
          </TabsContent>
        </Tabs>
      </>)}
    </div>
  );
}
