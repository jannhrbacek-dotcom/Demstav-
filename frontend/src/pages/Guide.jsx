import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, atLeast } from "@/lib/auth";

export const guideKey = (id) => `demstav:guide:v1:${id}`;
const STEPS = [
  { title: "Vítejte v DEMSTAVu", text: "Aplikace nahrazuje papírové zápisy. Docházka zaznamenává, kdy jste v práci. Zápis stroje popisuje práci, motohodiny a servis. Ze zápisů vzniká šichtovnice pro vedení.", action: "Dnes", to: "/dnes", task: "Na stránce Dnes najdete hlavní tlačítka pro svůj pracovní den." },
  { title: "1. Příchod a odchod", text: "V Docházce vyberte pracoviště a klepněte na Příchod. Podle pracoviště naskenujete QR nebo povolíte ověření polohy. Na konci směny dejte Odchod. Příchod sám nespouští stroj ani nezakládá jeho deník.", action: "Otevřít docházku", to: "/dochazka", task: "Chybí událost nebo je čas chybný? Použijte Požádat o opravu a napište důvod." },
  { title: "2. Přestávky se počítají samy", text: "Od 27. 10. 2026 platí přestávky 12:00–12:30 a 15:30–16:00. Aplikace odečte jen část, během které trvá směna. Zadejte celou směnu, například 6:00–15:00: čistá doba bude 8 hodin 30 minut.", action: "Přestávky a žádosti", to: "/dochazka", task: "Byla pauza jindy nebo nebyla vůbec? Požádat o změnu přestávky → datum → všechny skutečné přestávky nebo Žádná → důvod → odeslat. Do schválení vedoucím zůstává původní odečet." },
  { title: "3. Zápis práce a stroje", text: "Otevřete nový zápis. Zkontrolujte datum, vyberte stroj a pracoviště, doplňte pracovní dobu, motohodiny a popis práce. Při střídání strojů vytvořte pro každý samostatný zápis se skutečnými časy. Servis a prostoje zapisujte do odpovídajících částí.", action: "Nový zápis", to: "/zapis/novy", task: "Pracovní doba je celá směna; automatické přestávky nemusíte ručně vyřezávat. Servis uvnitř směny se nepřičítá podruhé." },
  { title: "4. Uložení, potvrzení a fotografie", text: "Rozpracovaný zápis uložte a před potvrzením zkontrolujte povinné údaje. Doklady a fotografie přidejte do příloh příslušného zápisu. Potvrzený zápis lze opravit s uvedením důvodu; historie změn zůstává dohledatelná.", action: "Moje zápisy", to: "/zapisy", task: "Po uložení zkontrolujte stav odeslání. Uloženo v telefonu ještě neznamená přijato serverem." },
  { title: "5. Když není internet", text: "Po předchozím načtení aplikace se zápisy ukládají v telefonu a čekají ve Frontě. Po obnovení spojení proběhne odeslání. Zkontrolujte hlášení Vše odesláno. Chyby nebo konflikty otevřete ve Frontě a vyřešte podle uvedené zprávy.", action: "Otevřít frontu", to: "/fronta", task: "Dokud jsou v telefonu neodeslané položky, nemažte data aplikace. Žádost o změnu přestávky odesílejte s připojením." },
  { title: "6. Přehledy a další možnosti", text: "V Moje přehledy zkontrolujete šichtovnici, deník a směny. V Exportech stáhnete výstupy. V nabídce Více najdete dovolenou a absence, změnu hesla a Jednoduchý režim s větším textem a tlačítky.", action: "Moje přehledy", to: "/prehledy", task: "Tento návod otevřete kdykoliv přes Více → Jak na to. Na počítači je také v levém menu." },
];
export default function Guide() {
  const { user } = useAuth();
  const nav = useNavigate(), loc = useLocation();
  const [step, setStep] = useState(0);
  const steps = atLeast(user, "manager") ? [...STEPS, { title: "7. Přehled a schvalování pro vedení", text: "V Přehledu vedení vidíte zaměstnance, docházku a zápisy. Kontrola výjimek obsahuje žádosti o opravy a změny přestávek. Před rozhodnutím ověřte datum, skutečné časy a důvod. Zamítnutí vyžaduje poznámku.", action: "Kontrola výjimek", to: "/kontrola", task: "Vedoucí provozu má plnou správu uživatelů, strojů a pracovišť, všechny exporty i schvalování. Vlastní žádost o přestávku nebo nepřítomnost schvaluje jiný oprávněný člověk." }] : STEPS;
  const finish = (to) => { localStorage.setItem(guideKey(user.id), "1"); nav(to || loc.state?.returnTo || "/dnes", { replace: true }); };
  const current = steps[step];
  return <main className="mx-auto max-w-2xl space-y-5" data-testid="app-guide">
    <div><p className="text-sm font-semibold text-slate-600">Jak na to · {step + 1} z {steps.length}</p><h1 className="mt-2 text-3xl font-bold">{current.title}</h1></div>
    <progress className="h-3 w-full accent-yellow-500" value={step + 1} max={steps.length} aria-label="Postup průvodcem" />
    <article className="space-y-5 rounded-xl border bg-white p-5 text-lg leading-relaxed" aria-live="polite">
      <p>{current.text}</p><p className="rounded-lg bg-amber-50 p-4">{current.task}</p>
      <Button variant="outline" className="min-h-12 w-full whitespace-normal" onClick={() => finish(current.to)}>{current.action}</Button>
    </article>
    <div className="flex gap-3"><Button variant="outline" className="h-14 flex-1 text-lg" disabled={step === 0} onClick={() => setStep(step - 1)}>Zpět</Button>
      <Button className="btn-primary h-14 flex-1 text-lg" onClick={() => step + 1 < steps.length ? setStep(step + 1) : finish()}>{step + 1 < steps.length ? "Další" : "Rozumím, začít"}</Button></div>
    <button className="min-h-12 w-full underline" onClick={() => finish()}>Přeskočit prohlídku – návod najdu v nabídce Jak na to</button>
  </main>;
}
