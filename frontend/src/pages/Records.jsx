import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ClipboardList, OctagonAlert, FileJson } from "lucide-react";
import { MachineFilter } from "@/components/MachineFilter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Empty } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { useCached, mergedRecords } from "@/lib/data";
import { useSync } from "@/lib/sync";
import { dmy } from "@/lib/format";
import { timeBreakdown, fmtH } from "@/lib/worktime";
import { useLanguage } from "@/lib/language";

export default function Records({ all = false }) {
  const s = useSync();
  const { t } = useLanguage();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [emp, setEmp] = useState("all");
  const [status, setStatus] = useState("all");
  const [machine, setMachine] = useState("");
  const qs = new URLSearchParams({ limit: "500", ...(all ? {} : { mine: "1" }), ...(from ? { date_from: from } : {}), ...(to ? { date_to: to } : {}), ...(all && emp !== "all" ? { employee_id: emp } : {}), ...(status !== "all" ? { status } : {}) }).toString();
  const recs = useCached(`/records?${qs}`);
  const machines = useCached("/machines");
  const machineOptions = useMemo(() => [...new Set([...(machines.data || []).map((m) => m.label), ...(recs.data || []).map((r) => r.machine), ...(!all ? Object.values(s.records).map((entry) => entry.record?.machine) : [])].filter(Boolean))].sort((a, b) => a.localeCompare(b, "cs")), [machines.data, recs.data, s.records, all]);
  const users = useCached("/users", { enabled: all });
  const list = useMemo(() => {
    const m = all ? (recs.data || []).map((r) => ({ record: r, state: r.status === "confirmed" ? "confirmed" : "draft" })) : mergedRecords(recs.data, s.records);
    return m.filter((x) => !machine || (x.record.machine || "").toLowerCase().includes(machine.toLowerCase()));
  }, [recs.data, s.records, all, machine]);

  return (
    <div>
      <PageHeader title={t(all ? "Všechny zápisy" : "Moje zápisy")} subtitle={all ? "Zápisy zaměstnanců se zobrazí automaticky po přijetí serverem – bez posílání PDF." : "Deník stroje a šichtovnice. Stav ukazuje, zda je zápis jen v telefonu, nebo už na serveru."}
        actions={!all && <div className="flex flex-wrap gap-2"><Link to="/zapis/novy"><Button className="btn-primary h-12 font-semibold" data-testid="records-new-button"><Plus className="mr-1 h-5 w-5" />{t("Nový zápis")}</Button></Link><Link to="/zapisy/import"><Button variant="outline" className="h-12 font-semibold" data-testid="records-import-button"><FileJson className="mr-1 h-5 w-5" />{t("Import JSON")}</Button></Link></div>} />
      <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="records-filters">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11" aria-label="Od" data-testid="records-filter-from" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11" aria-label="Do" data-testid="records-filter-to" />
        <MachineFilter value={machine} onChange={setMachine} options={machineOptions} />
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-11" data-testid="records-filter-status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t("Všechny stavy")}</SelectItem><SelectItem value="draft">{t("Koncepty")}</SelectItem><SelectItem value="confirmed">{t("Potvrzené")}</SelectItem></SelectContent></Select>
        {all && <Select value={emp} onValueChange={setEmp}><SelectTrigger className="h-11" data-testid="records-filter-employee"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t("Všichni zaměstnanci")}</SelectItem>{(users.data || []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>}
      </div>
      {recs.fromCache && <p className="mb-3 text-xs font-medium text-amber-800">{t("Offline – zobrazena poslední stažená data.")}</p>}
      {!recs.loading && list.length === 0 && <Empty icon={ClipboardList} title={t("Žádné zápisy")} text={t("Pro zvolený filtr zatím nic není.")} />}
      <div className="space-y-1.5">
        {list.map(({ record: r, state }) => {
          const b = timeBreakdown(r);
          const stop = (r.faults || []).some((f) => f.severity === "stop" && !f.resolved);
          return (
            <Link key={r.id} to={all ? `/detail/${r.id}` : state === "confirmed" || state === "draft" ? `/detail/${r.id}` : `/zapis/${r.id}`}
              className="flex min-h-[54px] items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-colors hover:bg-slate-50" data-testid="records-item-card">
              <div className="w-[49px] shrink-0 text-center" data-testid="records-card-date">
                <div className="font-heading text-[13px] font-bold leading-4">{dmy(r.date).slice(0, 6)}</div>
                <div className="text-[10px] leading-3 text-slate-500">{r.date?.slice(0, 4)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold leading-[18px] text-slate-900">{r.machine || t("Bez stroje")} {all && <span className="font-normal text-slate-600">· {r.owner_name}</span>}</div>
                <div className="truncate text-xs leading-[17px] text-slate-600">{r.site || "—"} · {fmtH(b.totalHours)} h{b.serviceHours ? ` · ${t("Servis")} ${fmtH(b.serviceHours)} h` : ""}{r.revision > 1 ? ` · ${t("revize")} ${r.revision}` : ""}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5" data-testid="records-card-status">{stop && <StatusBadge status="stop" />}<StatusBadge status={state} testid="records-item-status-badge" /></div>
            </Link>
          );
        })}
      </div>
      {list.some((x) => (x.record.faults || []).some((f) => f.severity === "stop" && !f.resolved)) && <p className="mt-3 flex items-center gap-1 text-xs text-slate-600"><OctagonAlert className="h-3.5 w-3.5" />STOP = neodstraněná vážná závada</p>}
    </div>
  );
}
