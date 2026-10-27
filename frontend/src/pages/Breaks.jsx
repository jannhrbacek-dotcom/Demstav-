import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth, atLeast } from "@/lib/auth";
import { useCached } from "@/lib/data";
import { http, errText } from "@/lib/api";
import { pragueDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Field } from "@/components/Section";
const fixed = [{start:"12:00",end:"12:30"},{start:"15:30",end:"16:00"}];
export default function Breaks() {
  const {user} = useAuth();
  const q = useCached("/breaks");
  const [day,setDay] = useState(pragueDate());
  const [intervals,setIntervals] = useState(fixed);
  const [reason,setReason] = useState("");
  const [busy,setBusy] = useState(false);
  const [notes,setNotes] = useState({});
  const send = async () => {
    setBusy(true);
    try { await http.post("/breaks",{date:day,intervals,reason}); toast.success("Žádost odeslána vedení. Do schválení platí původní přestávky."); setReason(""); q.reload(); }
    catch(e){toast.error(errText(e));} finally {setBusy(false);}
  };
  const decide = async (r,decision) => {
    setBusy(true);
    try {await http.post(`/breaks/${r.id}/decision`,{decision,note:notes[r.id]||""}); q.reload();toast.success("Rozhodnutí uloženo. Výpočty se aktualizují po načtení přehledů.");}
    catch(e){toast.error(errText(e));} finally {setBusy(false);}
  };
  return <div className="space-y-5">
    <PageHeader title="Přestávky a žádosti o změnu" subtitle="Pevné přestávky: 12:00–12:30 a 15:30–16:00. Odečítá se jen jejich průnik s vaší směnou." />
    <div className="rounded-xl border bg-white p-4 space-y-4">
      <p>Nemusíte mačkat začátek ani konec přestávky. Pokud jste přestávku neměli nebo proběhla jindy, uveďte všechny skutečné přestávky za daný den a důvod. Změnu schválí vedení. Přestávka není prostoj stroje.</p>
      <p className="text-sm text-slate-600">Příklad: 06:00–16:00 znamená 9 hodin čisté práce. Při směně do 15:00 se odečte pouze půlhodina v poledne. Pravidlo platí od 27. 10. 2026; starší výkazy změní pouze schválená žádost.</p>
      <Field label="Den změny"><Input type="date" value={day} onChange={e=>setDay(e.target.value)} className="h-12" /></Field>
      <div className="space-y-2"><h2 className="font-semibold">Skutečné přestávky za celý den</h2>{intervals.length===0 && <p>Žádná přestávka se neuskutečnila.</p>}{intervals.map((v,i)=><div key={i} className="flex flex-wrap gap-2">
        <Input aria-label={`Přestávka ${i+1} od`} type="time" className="h-12 w-32" value={v.start} onChange={e=>setIntervals(intervals.map((x,n)=>n===i?{...x,start:e.target.value}:x))}/>
        <Input aria-label={`Přestávka ${i+1} do`} type="time" className="h-12 w-32" value={v.end} onChange={e=>setIntervals(intervals.map((x,n)=>n===i?{...x,end:e.target.value}:x))}/>
        <Button variant="outline" className="h-12" onClick={()=>setIntervals(intervals.filter((_,n)=>n!==i))}>Odebrat</Button>
      </div>)}<div className="flex flex-wrap gap-2"><Button variant="outline" className="h-12" disabled={intervals.length>=4} onClick={()=>setIntervals([...intervals,{start:"",end:""}])}>Přidat přestávku</Button><Button variant="outline" className="h-12" onClick={()=>setIntervals([])}>Žádná přestávka</Button><Button variant="outline" className="h-12" onClick={()=>setIntervals(fixed)}>Pevné časy</Button></div></div>
      <Field label="Důvod změny"><Textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Např. oběd až od 12:30 kvůli dokončení nakládky." /></Field>
      <Button className="btn-primary h-14 w-full font-semibold" disabled={busy||!reason.trim()||!day} onClick={send}>Odeslat žádost vedení</Button>
      <p className="text-sm">Žádost odešlete s internetem. Při chybě zůstanou vyplněné údaje v otevřeném formuláři.</p>
    </div>
    <h2 className="font-heading text-xl font-semibold">{atLeast(user,"manager")?"Žádosti zaměstnanců":"Moje žádosti"}</h2>
    {q.loading && <p>Načítání žádostí…</p>}
    {!q.loading && !q.data && <p>Žádosti se nepodařilo načíst. Zkontrolujte připojení a <button className="underline" onClick={q.reload}>zkuste to znovu</button>.</p>}
    {q.data?.requests?.length===0 && <p>Zatím žádné žádosti.</p>}
    {(q.data?.requests||[]).map(r=><div key={r.id} className="rounded-xl border bg-white p-4 space-y-3">
      <h3 className="font-semibold">{r.employee_name} · {r.date} · {{pending:"Čeká na schválení",approved:"Schváleno",rejected:"Zamítnuto"}[r.status]}</h3>
      <p>Požadované přestávky: {r.intervals.length?r.intervals.map(x=>`${x.start}–${x.end}`).join(", "):"žádné"}</p><p>Důvod: {r.reason}</p>
      {r.decision && <p className="text-sm">Rozhodl: {r.decision.actor_name} · {r.decision.note}</p>}
      {r.status==="pending" && r.employee_id!==user.id && atLeast(user,"manager") && <><Input aria-label="Poznámka k rozhodnutí" value={notes[r.id]||""} onChange={e=>setNotes({...notes,[r.id]:e.target.value})} placeholder="Důvod zamítnutí / poznámka"/><div className="flex gap-2"><Button className="btn-primary h-12" disabled={busy} onClick={()=>decide(r,"approve")}>Schválit</Button><Button variant="outline" className="h-12" disabled={busy||!notes[r.id]?.trim()} onClick={()=>decide(r,"reject")}>Zamítnout</Button></div></>}
    </div>)}
    <Link className="underline" to="/jak-na-to">Jak na to – návod k aplikaci</Link>
  </div>;
}
