import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, atLeast } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/Section";
export const guideKey = id => `demstav:guide:v1:${id}`;
const steps = [
  {title:"1. Začátek dne",to:"/dnes",button:"Dnes",text:"Na úvodní stránce Dnes vidíte směnu a tlačítko pro nový zápis. V Docházce zapište příchod. Podle pracoviště načtěte QR a povolte polohu. Příchod do práce ještě neznamená spuštění stroje."},
  {title:"2. Deník stroje",to:"/zapis/novy",button:"Nový zápis",text:"Vyberte datum, stroj, pracoviště a objednatele. Zadejte MTH na začátku a konci, celou pracovní dobu a stručně popište práci. Servis, přejezdy a prostoje vyplňte v příslušné části. Při střídání strojů založte pro každý samostatný zápis se skutečnými časy."},
  {title:"3. Přestávky automaticky",to:"/prestavky",button:"Přestávky a změny",text:"Přestávky jsou od 12:00 do 12:30 a od 15:30 do 16:00. Aplikace odečte jen část uvnitř směny. Celá směna 06:00–16:00 tedy dává 9 hodin čisté doby. Pokud přestávka nebyla nebo proběhla jindy, požádejte zde o změnu s důvodem. Do schválení platí původní výpočet."},
  {title:"4. Uložit a odeslat",to:"/fronta",button:"Fronta odesílání",text:"Rozpracovaný zápis můžete uložit a doplnit později. Před potvrzením zkontrolujte údaje a podpis. Bez internetu sledujte Frontu: položka uložená v telefonu ještě není přijata serverem. Po připojení zkontrolujte dokončení synchronizace; potvrzený zápis opravujte s uvedením důvodu."},
  {title:"5. Konec dne a šichtovnice",to:"/prehledy",button:"Moje přehledy",text:"V Docházce zapište odchod. Ve Více → Moje přehledy najdete vlastní šichtovnici, deník a směny. Ve Více → Exporty stáhnete přehledy v dostupných formátech. Zkontrolujte období a úplnost zápisů před odevzdáním."},
  {title:"6. Kde najdete pomoc",to:"/vice",button:"Více",text:"Ve Více zapnete Jednoduchý režim s většími tlačítky a textem, změníte heslo a otevřete tento návod znovu. Dovolenou, volno, lékaře a nemoc řešte v samostatné nabídce. Každý používá vlastní účet; přihlašovací údaje nesdílejte."},
];
export default function Guide() {
  const {user}=useAuth(); const nav=useNavigate(); const [step,setStep]=useState(0); const [all,setAll]=useState(false);
  const seen=()=>{try{localStorage.setItem(guideKey(user.id),"1");}catch(_){} }; const finish=()=>{seen();nav("/dnes");};
  const pages=atLeast(user,"manager")?[...steps,{title:"7. Vedení a schvalování",to:"/prehled",button:"Přehled vedení",text:"Přehled vedení ukazuje zaměstnance a jejich zápisy. V Kontrole výjimek řešíte docházku, v Přestávkách žádosti o změnu pauzy. V Uživatelích spravujete účty podle své role. Vedoucí provozu Jakub Karas má plná oprávnění včetně správy a schvalování. Vlastní žádosti vždy řeší jiné vedení."}]:steps;
  return <div className="mx-auto max-w-3xl space-y-5">
    <PageHeader title="Jak na to – průvodce DEMSTAV" subtitle="Krátké vysvětlení krok za krokem. Návod kdykoliv otevřete ve Více → Jak na to."/>
    <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-12" onClick={()=>setAll(!all)}>{all?"Průvodce krok za krokem":"Zobrazit celý návod"}</Button><Button variant="outline" className="h-12" onClick={finish}>Přejít do aplikace</Button></div>
    {!all && <><p aria-live="polite" className="font-semibold">Krok {step+1} z {pages.length}</p><progress className="w-full" value={step+1} max={pages.length} aria-label="Postup průvodce"/></>}
    {(all?pages:[pages[step]]).map(p=><article key={p.title} className="rounded-xl border bg-white p-5 space-y-4"><h2 className="font-heading text-2xl font-bold">{p.title}</h2><p className="text-lg leading-relaxed">{p.text}</p><Link className="inline-flex min-h-[48px] items-center rounded-lg bg-slate-100 px-4 font-semibold" onClick={seen} to={p.to}>Otevřít: {p.button}</Link></article>)}
    {!all && <div className="flex gap-3"><Button variant="outline" className="h-14 flex-1" disabled={step===0} onClick={()=>setStep(step-1)}>Zpět</Button><Button className="btn-primary h-14 flex-1 font-semibold" onClick={()=>step===pages.length-1?finish():setStep(step+1)}>{step===pages.length-1?"Hotovo, rozumím":"Další krok"}</Button></div>}
  </div>;
}
