import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pencil, ArrowLeft, FileDown, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/Section";
import { StatusBadge } from "@/components/StatusBadge";
import { AttachmentThumb } from "@/components/AttachmentThumb";
import { useAuth } from "@/lib/auth";
import { http, errText, downloadFile } from "@/lib/api";
import { useSync } from "@/lib/sync";
import { dmy, dateTime, SERVICE_BY } from "@/lib/format";
import { timeBreakdown, fmtH } from "@/lib/worktime";
import { journeyText } from "@/lib/journey";

const iv = (a) => (a || []).map((i) => `${i.start}–${i.end}`).join(", ") || "—";
const Row = ({ k, v }) => (<div className="grid grid-cols-[150px_1fr] gap-2 border-b border-slate-100 py-2 text-sm"><div className="font-medium text-slate-600">{k}</div><div className="whitespace-pre-wrap text-slate-900">{v || "—"}</div></div>);

export default function RecordDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const s = useSync();
  const [r, setR] = useState(null);
  const [versions, setVersions] = useState([]);
  const [err, setErr] = useState("");
  const [integ, setInteg] = useState(null);
  useEffect(() => {
    http.get(`/records/${id}`).then(({ data }) => setR(data)).catch((e) => { const loc = s.records[id]; if (loc) setR(loc.record); else setErr(errText(e)); });
    http.get(`/records/${id}/versions`).then(({ data }) => setVersions(data)).catch(() => {});
    http.get(`/records/${id}/integrity`).then(({ data }) => setInteg(data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (err) return <p className="text-red-700">{err}</p>;
  if (!r) return <p className="text-slate-600">Načítám…</p>;
  const b = timeBreakdown(r);
  const own = r.owner_id === user.id || !r.owner_id || user.role === "operations_manager";
  const exp = async () => { try { await downloadFile(`/exports/denik.pdf?date_from=${r.date}&date_to=${r.date}&machine=${encodeURIComponent(r.machine)}${r.owner_id ? `&employee_id=${r.owner_id}` : ""}`, `DEMSTAV_provozni_denik_${r.date}.pdf`); } catch (e) { toast.error(errText(e)); } };
  return (
    <div className="space-y-4">
      <PageHeader title={`${r.machine || "Zápis"} · ${dmy(r.date)}`} subtitle={`${r.owner_name || r.operator} · revize ${r.revision} · ID ${r.id}`}
        actions={<>
          <StatusBadge status={r.status === "confirmed" ? "confirmed" : "draft"} />
          <Button variant="outline" className="h-10" onClick={exp} data-testid="detail-export-diary"><FileDown className="mr-1 h-4 w-4" />Deník PDF</Button>
          {own && <Link to={`/zapis/${r.id}`}><Button className="btn-primary h-10 font-semibold" data-testid="detail-edit-button"><Pencil className="mr-1 h-4 w-4" />{r.status === "confirmed" ? "Opravit" : "Upravit"}</Button></Link>}
          <Button variant="ghost" className="h-10" onClick={() => nav(-1)}><ArrowLeft className="mr-1 h-4 w-4" />Zpět</Button>
        </>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2" data-testid="detail-fields">
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg bg-[#0B0F14] p-3 text-white sm:grid-cols-4">
            <div><div className="text-xs text-slate-300">Celkem</div><div className="font-heading text-xl font-bold text-[#FFD200]">{fmtH(b.totalHours)} h</div></div>
            <div><div className="text-xs text-slate-300">Ostatní práce</div><div className="font-heading text-xl font-bold">{fmtH(b.workHours)} h</div></div>
            <div><div className="text-xs text-slate-300">Servis</div><div className="font-heading text-xl font-bold">{fmtH(b.serviceHours)} h</div></div>
            <div><div className="text-xs text-slate-300">Prostoje</div><div className="font-heading text-xl font-bold">{fmtH(b.downtimeHours)} h</div></div>
          </div>
          <Row k="Objednatel" v={r.customer} /><Row k="Pracoviště" v={r.site} /><Row k="Zakázka" v={r.job} /><Row k="Směna / posádka" v={[r.shift, r.operator, r.crew].filter(Boolean).join(" · ")} />
          <Row k="Moje doba jízdy" v={journeyText(r)} /><Row k="Čipování ve vozidle" v="neověřeno" /><Row k="SPZ na / z" v={`${r.vehiclesTo || "—"} / ${r.vehiclesFrom || "—"}`} /><Row k="Ubytování" v={{ yes: "ANO", no: "NE" }[r.accommodation]} />
          <Row k="Pracovní doba" v={iv(b.totalIntervals)} /><Row k="Servis" v={iv(b.serviceIntervals)} /><Row k="Prostoje" v={iv(b.downtimeIntervals) + (r.downtimeReason ? ` – ${r.downtimeReason}` : "")} />
          <Row k="MTH" v={`${r.mthStart || "—"} → ${r.mthEnd || "—"}`} /><Row k="Práce" v={r.work} />
          <Row k="Kontroly" v={[r.dailyCheck && "denní kontrola", r.accessoryCheck && "příslušenství", r.equipmentCheck && "vybavení", r.fit === "yes" ? "provozuschopný" : r.fit === "no" ? "NEPROVOZUSCHOPNÝ" : null].filter(Boolean).join(", ")} />
          <Row k="Servis / oprava" v={[r.serviceDescription, r.repairDescription, SERVICE_BY[r.serviceBy], r.externalCompany].filter(Boolean).join("\n")} />
          <Row k="Kapaliny" v={[r.diesel && `nafta ${r.diesel}`, r.hydraulic && `hydr. ${r.hydraulic}`, r.oil && `mot. olej ${r.oil}`, r.otherFluid].filter(Boolean).join(", ")} />
          <Row k="Poznámky" v={r.notes} /><Row k="Předání" v={[r.handover, r.handoverName].filter(Boolean).join(" – ")} />
          {(r.faults || []).map((f, i) => <div key={f.id} className={`mt-2 rounded-lg border-2 p-3 text-sm ${f.severity === "stop" ? "border-black" : "border-slate-200"}`} data-testid="detail-fault"><div className="mb-1 flex items-center gap-2 font-semibold">{f.severity === "stop" && <StatusBadge status="stop" />}Závada {i + 1} · {dmy(f.date)} {f.time}</div><div>{f.description}</div><div className="mt-1 text-slate-600">{f.resolved ? `Odstraněno: ${f.resolution}` : "Neodstraněno"}{f.acknowledged ? " · střídající obsluha seznámena" : ""}</div></div>)}
          {r.intervalService && <div className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950" data-testid="detail-interval-service">Proveden pravidelný servis dle intervalu při {r.mthEnd} mth</div>}
          {[["timesheet", "Fotky k šichtovnici"], ["service", "Fotky ze servisu"], ["general", "Přílohy"]].map(([sec, lab]) => {
            const list = (r.attachments || []).filter((a) => (a.section || "general") === sec);
            return list.length > 0 && <div key={sec} className="mt-3 space-y-2" data-testid={`detail-attachments-${sec}`}><div className="text-sm font-semibold">{lab}</div>{list.map((a) => <AttachmentThumb key={a.id} att={a} />)}</div>;
          })}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="detail-versions">
          <div className="mb-2 font-heading font-semibold">Historie revizí</div>
          {integ && integ.versions > 0 && (
            <div className={`mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${integ.ok ? "bg-emerald-50 text-emerald-950" : "bg-red-50 text-red-900"}`} data-testid="detail-integrity">
              {integ.ok ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <div className="font-semibold">{integ.ok ? "Integrita ověřena" : `Narušená integrita (revize ${integ.broken_at})`}</div>
                <div className="text-xs">{integ.ok ? `Řetěz otisků ${integ.versions} revizí je neporušený.` : "Obsah uložené revize neodpovídá jejímu otisku – kontaktujte správce."}</div>
                {integ.head && <div className="mt-1 break-all font-mono text-[11px]" data-testid="detail-integrity-hash">SHA-256: {integ.head}</div>}
              </div>
            </div>
          )}
          {versions.length === 0 && <p className="text-sm text-slate-600">Historie je dostupná po přijetí serverem.</p>}
          <ol className="space-y-3">{versions.map((v) => (
            <li key={v.revision} className="border-l-4 border-[#FFD200] pl-3 text-sm" data-testid="detail-version-item">
              <div className="font-semibold">Revize {v.revision} · {v.status === "confirmed" ? "potvrzeno" : "koncept"}</div>
              <div className="text-slate-600">{dateTime(v.at)} · účet {v.author_name}</div>
              <div className="text-slate-600">{fmtH(v.payload.breakdown.totalHours)} h · {v.payload.date} · {v.payload.machine}</div>
              {v.correction_reason && <div className="mt-1 rounded bg-blue-50 px-2 py-1 text-blue-950">Důvod opravy: {v.correction_reason}</div>}
              {v.hash && <div className="mt-1 font-mono text-[11px] text-slate-500">otisk {v.hash.slice(0, 16)}…</div>}
            </li>))}</ol>
          <p className="mt-3 text-xs text-slate-600">Server ukládá autora, čas a obsah každé revize. Vyplněné jméno ani obrázek podpisu samy o sobě nedokazují, kdo zápis potvrdil – rozhoduje přihlášený účet.</p>
        </div>
      </div>
    </div>
  );
}
