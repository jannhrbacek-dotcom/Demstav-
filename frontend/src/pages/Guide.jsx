import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, atLeast } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { UK_GUIDE } from "@/lib/guideUk";

export const guideKey = (id) => `demstav:guide:v1:${id}`;
export const GUIDE_PDF = "/help/demstav-guide-cz-uk.pdf";
export const guideContextStep = (context = "", manager = false) => {
  if (context.startsWith("/dochazka")) return 1;
  if (context.startsWith("/zapis") || context.startsWith("/detail/")) return 3;
  if (context === "/fronta") return 5;
  if (["/nepritomnost", "/kalendar", "/prehledy", "/exporty", "/vice", "/vykazy-vazeni"].includes(context)) return 6;
  if (manager && ["/prehled", "/kontrola", "/vsechny-zapisy", "/pracoviste", "/stroje", "/uzivatele"].some(path => context === path || context.startsWith(`${path}/`))) return 7;
  return 0;
};
const FEATURES = [
  ["/dnes", "Dnes", "Hlavní kroky pracovního dne a upozornění."],
  ["/dochazka", "Docházka", "Příchod, odchod, přejezd, QR/GPS, přestávky a žádosti o opravu."],
  ["/zapis/novy", "Nový zápis", "Práce, MTH, servis, prostoje, jízdy, závady, přílohy a přepis fotografie s kontrolou."],
  ["/zapisy", "Moje zápisy", "Historie, detail, opravy s důvodem a pokračování dalším strojem."],
  ["/zapisy/import", "Import zápisů", "Hromadný import ze souboru JSON; nejdříve zkontrolujte náhled."],
  ["/fronta", "Fronta", "Neodeslané položky, opakování odeslání a řešení konfliktů."],
  ["/prehledy", "Moje přehledy", "Šichtovnice, strojní deník a směny."],
  ["/vykazy-vazeni", "Společný výkaz práce a vážní lístky", "Výkazy a tonáž z úplných lístků; zadávání podle přiděleného oprávnění."],
  ["/nepritomnost", "Dovolená a absence", "Žádosti o volno, lékaře či nemoc a jejich stav."],
  ["/kalendar", "Kalendář týmu", "Sdílený přehled schválených nepřítomností."],
  ["/exporty", "Exporty a reporty", "PDF, XLSX, CSV a předávání výkazů podle oprávnění."],
  ["/zmena-hesla", "Změnit heslo", "Změna vlastního přihlašovacího hesla."],
  ["/vice", "Nastavení a telefon", "Jazyk, jednoduchý režim, upozornění, instalace na plochu a odhlášení."],
];
const MANAGER_FEATURES = [
  ["/prehled", "Přehled vedení", "Souhrny týmu, docházky a zápisů."],
  ["/kontrola", "Kontrola výjimek", "Schvalování oprav docházky a změn přestávek."],
  ["/vsechny-zapisy", "Všechny zápisy", "Kontrola zápisů celého týmu."],
  ["/pracoviste", "Pracoviště a QR", "Evidence pracovišť, polohy a zobrazení QR kódů."],
  ["/stroje", "Seznam strojů", "Evidence strojů, motohodiny a servisní intervaly."],
  ["/uzivatele", "Uživatelé a přístupy", "Účty a role; změny podle oprávnění."],
];
const STEPS = [
  { title: "Vítejte v DEMSTAVu", text: "Aplikace nahrazuje papírové zápisy. Docházka zaznamenává, kdy jste v práci. Zápis stroje popisuje práci, motohodiny a servis. Ze zápisů vzniká šichtovnice pro vedení.", action: "Dnes", to: "/dnes", task: "Na stránce Dnes najdete hlavní tlačítka pro svůj pracovní den." },
  { title: "1. Příchod a odchod", text: "V Docházce vyberte pracoviště a klepněte na Příchod. Podle pracoviště naskenujete QR nebo povolíte ověření polohy. Na konci směny dejte Odchod. Příchod sám nespouští stroj ani nezakládá jeho deník.", action: "Otevřít docházku", to: "/dochazka", task: "Chybí událost nebo je čas chybný? Použijte Požádat o opravu a napište důvod." },
  { title: "2. Přestávky se počítají samy", text: "Od 27. 10. 2026 platí přestávky 12:00–12:30 a 15:30–16:00. Aplikace odečte jen část, během které trvá směna. Zadejte celou směnu, například 6:00–15:00: čistá doba bude 8 hodin 30 minut.", action: "Přestávky a žádosti", to: "/dochazka", task: "Byla pauza jindy nebo nebyla vůbec? Požádat o změnu přestávky → datum → všechny skutečné přestávky nebo Žádná → důvod → odeslat. Do schválení vedoucím zůstává původní odečet." },
  { title: "3. Zápis práce a stroje", text: "Otevřete nový zápis. Zkontrolujte datum, vyberte stroj a pracoviště, doplňte pracovní dobu, motohodiny a popis práce. Při střídání strojů zvolte po uložení pokračování dalším strojem. Každý stroj má vlastní zápis, časy a motohodiny. Servis a prostoje zapisujte do odpovídajících částí. Jízda je vaše vlastní doba H:MM; zapisuje ji také spolujezdec. Nezapomeňte se ve vozidle čipovat i jako spolujezdec a uvést všechny SPZ. Aplikace čipnutí sama neověřuje.", action: "Nový zápis", to: "/zapis/novy", task: "Pracovní doba je celá směna; automatické přestávky nemusíte ručně vyřezávat. Servis uvnitř směny se nepřičítá podruhé." },
  { title: "4. Uložení, potvrzení a fotografie", text: "Rozpracovaný zápis uložte a před potvrzením zkontrolujte povinné údaje. Doklady a fotografie přidejte do příloh příslušného zápisu. Společnou tonáž zadává pověřený pracovník až po skončení směny z kompletních vážních lístků. Potvrzený zápis lze opravit s uvedením důvodu; historie změn zůstává dohledatelná.", action: "Moje zápisy", to: "/zapisy", task: "Po uložení zkontrolujte stav odeslání. Uloženo v telefonu ještě neznamená přijato serverem." },
  { title: "5. Když není internet", text: "Po předchozím načtení aplikace se zápisy ukládají v telefonu a čekají ve Frontě. Po obnovení spojení proběhne odeslání. Ověřte zelený mráček v horní liště. Chyby nebo konflikty otevřete ve Frontě a vyřešte podle uvedené zprávy.", action: "Otevřít frontu", to: "/fronta", task: "Dokud jsou v telefonu neodeslané položky, nemažte data aplikace. Žádost o změnu přestávky odesílejte s připojením." },
  { title: "6. Přehledy a další možnosti", text: "V Moje přehledy zkontrolujete šichtovnici, deník a směny. V Exportech stáhnete výstupy. V nabídce Více najdete dovolenou a absence, změnu hesla a Jednoduchý režim s větším textem a tlačítky.", action: "Moje přehledy", to: "/prehledy", task: "Návod otevřete kdykoliv nahoře vedle loga DEMSTAV. Sdílený kalendář najdete na stránce Dnes nebo přes Více." },
];
export default function Guide() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const nav = useNavigate(), loc = useLocation();
  const context = loc.state?.context || "";
  const contextStep = guideContextStep(context, atLeast(user, "manager"));
  const [step, setStep] = useState(Math.min(contextStep, atLeast(user, "manager") ? 7 : 6));
  const baseSteps = atLeast(user, "manager") ? [...STEPS, { title: "7. Přehled a schvalování pro vedení", text: "V Přehledu vedení vidíte zaměstnance, docházku a zápisy. Kontrola výjimek obsahuje žádosti o opravy a změny přestávek. Před rozhodnutím ověřte datum, skutečné časy a důvod. Zamítnutí vyžaduje poznámku.", action: "Kontrola výjimek", to: "/kontrola", task: "Vedoucí provozu má plnou správu uživatelů, strojů a pracovišť, všechny exporty i schvalování. Vlastní žádost o přestávku nebo nepřítomnost schvaluje jiný oprávněný člověk." }] : STEPS;
  const steps = language === "uk" ? baseSteps.map((entry, index) => ({ ...entry, ...UK_GUIDE[index] })) : baseSteps;
  const finish = (to) => { localStorage.setItem(guideKey(user.id), "1"); nav(to || loc.state?.returnTo || "/dnes", { replace: true }); };
  const current = steps[step];
  return <main className="mx-auto max-w-2xl space-y-5" data-testid="app-guide">
    <section className="rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="guide-brochure-title" data-testid="guide-brochure">
      <h2 id="guide-brochure-title" className="text-xl font-bold">{t("Brožura aplikace")}</h2>
      <p className="mt-2 text-sm text-slate-700">{t("Česká a ukrajinská příručka v PDF. Postupy, přehled funkcí a digitální ukázka deníku.")}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a href={GUIDE_PDF} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-lg bg-slate-900 px-4 font-semibold text-white" data-testid="guide-pdf-open">{t("Otevřít brožuru")}</a>
        <a href={GUIDE_PDF} download="DEMSTAV-prirucka-CZ-UK.pdf" className="inline-flex min-h-12 items-center rounded-lg border border-slate-300 px-4 font-semibold" data-testid="guide-pdf-download">{t("Stáhnout PDF")}</a>
      </div>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-600">{t("Jak na to")} · {step + 1} {language === "uk" ? "/" : "z"} {steps.length}</p><h1 className="mt-2 text-3xl font-bold">{current.title}</h1></div>
      <Button variant="outline" className="h-11" onClick={() => setStep(0)} data-testid="guide-restart">{t("Celý tutoriál od začátku")}</Button></div>
    <progress className="h-3 w-full accent-yellow-500" value={step + 1} max={steps.length} aria-label={t("Postup průvodcem")} />
    <article className="space-y-5 rounded-xl border bg-white p-5 text-lg leading-relaxed" aria-live="polite">
      <p>{current.text}</p><p className="rounded-lg bg-amber-50 p-4">{current.task}</p>
      <Button variant="outline" className="min-h-12 w-full whitespace-normal" onClick={() => finish(current.to)}>{current.action}</Button>
    </article>
    <div className="flex gap-3"><Button variant="outline" className="h-14 flex-1 text-lg" disabled={step === 0} onClick={() => setStep(step - 1)}>{t("Zpět")}</Button>
      <Button className="btn-primary h-14 flex-1 text-lg" onClick={() => step + 1 < steps.length ? setStep(step + 1) : finish()}>{t(step + 1 < steps.length ? "Další" : "Rozumím, začít")}</Button></div>
    <button className="min-h-12 w-full underline" onClick={() => finish()}>{t("Přeskočit prohlídku – návod najdu v nabídce Jak na to")}</button>
    <section aria-labelledby="guide-functions-title" className="space-y-3" data-testid="guide-functions">
      <h2 id="guide-functions-title" className="text-xl font-bold">{t("Přehled funkcí")}</h2>
      <p className="text-sm text-slate-600">{t("Otevřete přímo část aplikace, kterou potřebujete. Dostupné akce závisí na vašem oprávnění.")}</p>
      {[{ title: "Pro zaměstnance", entries: FEATURES }, ...(atLeast(user, "manager") ? [{ title: "Pro vedení", entries: MANAGER_FEATURES }] : [])].map(group => <div key={group.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <h3 className="bg-slate-50 px-4 py-3 font-bold">{t(group.title)}</h3>
        <ul className="divide-y divide-slate-100">{group.entries.map(([to, title, description]) => <li key={to}>
          <Link to={to} onClick={() => localStorage.setItem(guideKey(user.id), "1")} className="block px-4 py-3 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600">
            <span className="font-semibold underline decoration-slate-300 underline-offset-4">{t(title)}</span>
            <span className="mt-1 block text-sm leading-relaxed text-slate-600">{t(description)}</span>
          </Link>
        </li>)}</ul>
      </div>)}
    </section>
  </main>;
}
