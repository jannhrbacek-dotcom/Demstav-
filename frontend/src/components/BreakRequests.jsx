import { useLanguage } from "@/lib/language";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field } from "@/components/Section";
import { useCached } from "@/lib/data";
import { http, errText } from "@/lib/api";
import { FIXED_BREAKS } from "@/lib/worktime";
import { pragueDate, dmy } from "@/lib/format";

export default function BreakRequests({ initialDate, compact = false }) {
  const { t } = useLanguage();
  const requests = useCached("/break-requests?mine=1");
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [date, setDate] = useState(initialDate || pragueDate());
  const [breaks, setBreaks] = useState(FIXED_BREAKS.map(b => ({ ...b })));
  const [reason, setReason] = useState("");
  const submit = async () => {
    setBusy(true);
    try {
      await http.post("/break-requests", { date, breaks, reason });
      toast.success(t("Žádost o změnu přestávky odeslána vedoucímu."));
      requests.reload(); setOpen(false); setReason("");
    } catch (e) { toast.error(t(errText(e))); } finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" data-testid="automatic-breaks">
    <h2 className="text-lg font-bold">{t("Automatické přestávky")}</h2>
    <p>{t("12:00–12:30 a 15:30–16:00. Od 27. 10. 2026 se odečítá pouze část uvnitř směny. Přestávku nemusíte zapisovat ani vynechávat z času směny.")}</p>
    <p className="text-sm text-slate-600">{t("Přestávka byla jindy nebo neproběhla? Požádejte o změnu. Do schválení platí původní výpočet.")} <Link className="underline" to="/jak-na-to">{t("Jak na to")}</Link></p>
    <Button variant="outline" className="h-12 w-full" onClick={() => { setDate(initialDate || pragueDate()); setBreaks(FIXED_BREAKS.map(b => ({ ...b }))); setOpen(true); }} data-testid="break-change-request">{t("Požádat o změnu přestávky")}</Button>
    {!compact && (requests.data || []).map(r => <div key={r.id} className="border-t py-2 text-sm">
      <b>{dmy(r.date)} · {t(({ pending: "Čeká na schválení", approved: "Schváleno", rejected: "Zamítnuto" })[r.status])}</b>
      <div>{r.breaks.length ? r.breaks.map(b => `${b.start}–${b.end}`).join(", ") : t("Bez přestávek")} · {r.reason}</div>
      {r.decision && <div>{r.decision.by_name}: {r.decision.note || t("Schváleno")}</div>}
    </div>)}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{t("Změna přestávek")}</DialogTitle><DialogDescription>{t("Zadejte všechny skutečné přestávky za vybraný den. Tento seznam po schválení nahradí obě automatické přestávky v docházce i šichtovnici.")}</DialogDescription></DialogHeader>
      <Field label="Den"><Input type="date" min="2026-10-27" value={date} onChange={e => setDate(e.target.value)} className="h-12" /></Field>
      {breaks.map((b, i) => <div key={i} className="flex items-end gap-2">
        <Field label="Od"><Input type="time" value={b.start} onChange={e => setBreaks(breaks.map((v, j) => j === i ? { ...v, start: e.target.value } : v))} className="h-12" /></Field>
        <Field label="Do"><Input type="time" value={b.end} onChange={e => setBreaks(breaks.map((v, j) => j === i ? { ...v, end: e.target.value } : v))} className="h-12" /></Field>
        <Button variant="outline" className="h-12" onClick={() => setBreaks(breaks.filter((_, j) => j !== i))} aria-label={t("Odstranit přestávku {number}", { number: i + 1 })}>{t("Odebrat")}</Button>
      </div>)}
      {!breaks.length && <p className="font-semibold">{t("Žádáte den bez přestávek.")}</p>}
      <Button variant="outline" disabled={breaks.length >= 8} onClick={() => setBreaks([...breaks, { start: "", end: "" }])}>{t("Přidat přestávku")}</Button>
      <Button variant="outline" onClick={() => setBreaks([])}>{t("Žádná přestávka neproběhla")}</Button>
      <Field label="Důvod změny"><Textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} /></Field>
      <p className="text-sm">{t("Žádost vyžaduje připojení. Při chybě zůstane formulář otevřený.")}</p>
      <Button className="btn-primary h-12" disabled={busy || !reason.trim() || !date} onClick={submit}>{t(busy ? "Odesílám…" : "Odeslat ke schválení")}</Button>
    </DialogContent></Dialog>
  </section>;
}
