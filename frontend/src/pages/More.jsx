import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FileDown, KeyRound, LogOut, LayoutDashboard, ShieldCheck, Files, MapPin, Truck, Users, Smartphone, ChevronRight, Eye, BarChart3, CalendarDays, BellRing, BellOff, Settings, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/Section";
import { useAuth, atLeast } from "@/lib/auth";
import { useSync } from "@/lib/sync";
import { errText } from "@/lib/api";
import { pushSupported, pushPermission, getActiveSubscription, enablePush, disablePush, sendTestPush } from "@/lib/push";
import { LanguageSelect, useLanguage } from "@/lib/language";

const L = ({ to, icon: I, label, description, testid }) => {
  const { t } = useLanguage();
  return <Link to={to} className="flex min-h-[64px] items-center gap-3 border-b border-slate-100 px-4 py-3 font-semibold last:border-0 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-slate-900" data-testid={testid}>
    <I aria-hidden="true" className="h-5 w-5 shrink-0" />
    <span className="min-w-0 flex-1 break-words">{t(label)}{description && <span className="mt-1 block text-sm font-normal text-slate-600">{t(description)}</span>}</span>
    <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
  </Link>;
};

const Tile = ({ to, icon: I, label, description, tone, testid }) => {
  const { t } = useLanguage();
  return <Link to={to} data-testid={testid} className={`flex min-h-[148px] min-w-0 flex-col items-start rounded-2xl border p-4 shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${tone === "yellow" ? "border-amber-200 bg-amber-50 hover:bg-amber-100" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
    <span aria-hidden="true" className={`mb-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone === "yellow" ? "bg-amber-200" : tone === "blue" ? "bg-sky-100" : tone === "green" ? "bg-emerald-100" : "bg-orange-100"}`}><I className="h-6 w-6 text-slate-900" /></span>
    <span className="w-full break-words text-base font-bold leading-snug text-slate-900">{t(label)}</span>
    <span className="mt-1 w-full break-words text-sm leading-snug text-slate-600">{t(description)}</span>
  </Link>;
};

export default function More() {
  const { user, logout, simpleMode, setSimpleMode } = useAuth();
  const { t } = useLanguage();
  const s = useSync();
  const nav = useNavigate();
  const [prompt, setPrompt] = useState(null);
  const [pushState, setPushState] = useState({ supported: pushSupported(), permission: pushPermission(), subscribed: false, busy: false });
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
  useEffect(() => { const h = (e) => { e.preventDefault(); setPrompt(e); }; window.addEventListener("beforeinstallprompt", h); return () => window.removeEventListener("beforeinstallprompt", h); }, []);
  useEffect(() => { let m = true; (async () => { try { const sub = await getActiveSubscription(); if (m) setPushState((p) => ({ ...p, subscribed: !!sub, permission: pushPermission() })); } catch (_) { /* ignore */ } })(); return () => { m = false; }; }, []);
  const togglePush = async () => {
    setPushState((p) => ({ ...p, busy: true }));
    try {
      if (pushState.subscribed) { await disablePush(); setPushState((p) => ({ ...p, subscribed: false, busy: false })); toast.success("Notifikace vypnuty"); }
      else { await enablePush(); setPushState((p) => ({ ...p, subscribed: true, permission: pushPermission(), busy: false })); toast.success("Notifikace zapnuty"); }
    } catch (e) { setPushState((p) => ({ ...p, busy: false })); toast.error(e.response ? errText(e) : (e.message || "Nepodařilo se zapnout notifikace.")); }
  };
  const sendTest = async () => { try { const n = await sendTestPush(); toast.success(n ? "Testovací notifikace odeslána." : "Žádné aktivní zařízení pro notifikace."); } catch (e) { toast.error(e?.response?.data?.detail || "Chyba odeslání testu."); } };
  const out = () => { if (s.queue.length && !window.confirm(`V telefonu je ${s.queue.length} neodeslaných položek. Zůstanou uloženy a odešlou se po dalším přihlášení stejného účtu. Odhlásit?`)) return; logout(); nav("/login"); };
  return (
    <div className="space-y-4">
      <PageHeader title={t("Více")} subtitle={`${user?.name} · ${user?.role_label}`} />
      <section aria-labelledby="more-quick-title" className="space-y-3">
        <h2 id="more-quick-title" className="font-heading text-lg font-bold">{t("Rychlý přístup")}</h2>
        <div className="grid grid-cols-2 gap-3" data-testid="more-quick-access">
          <Tile to="/prehledy" icon={BarChart3} label="Moje přehledy" description="Šichtovnice, deník a směny" tone="yellow" testid="more-my-overview" />
          <Tile to="/stroje" icon={Truck} label="Stroje" description="Informace a servis" tone="blue" testid="more-machines" />
          <Tile to="/nepritomnost" icon={CalendarDays} label="Volno a absence" description="Dovolená, lékař, nemoc" tone="green" testid="more-absence" />
          <Tile to="/kalendar" icon={Users} label="Kalendář" description="Plán zaměstnanců" tone="orange" testid="more-calendar" />
        </div>
      </section>
      <section aria-labelledby="more-other-title" className="space-y-3">
        <h2 id="more-other-title" className="font-heading text-lg font-bold">{t("Další možnosti")}</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <L to="/vykazy-vazeni" icon={Files} label="Společný výkaz" description="Práce a vážní lístky" testid="more-production" />
          <L to="/exporty" icon={FileDown} label="Exporty a reporty" description="PDF, Excel, CSV" testid="more-exports" />
          <L to="/jak-na-to" icon={CircleHelp} label="Jak na to" testid="more-guide" />
          <details className="group" data-testid="more-account-settings">
            <summary className="flex min-h-[64px] cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-slate-900 [&::-webkit-details-marker]:hidden">
              <Settings aria-hidden="true" className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1"><span className="block font-semibold">{t("Nastavení účtu")}</span><span className="mt-1 block text-sm text-slate-600">{t("Heslo · jazyk · jednoduchý režim")}</span></span>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
            </summary>
            <div className="border-t border-slate-200 bg-slate-50">
              <L to="/zmena-hesla" icon={KeyRound} label="Změnit heslo" testid="more-change-password" />
              <div className="flex min-h-[60px] items-center justify-between gap-2 border-b border-slate-100 px-4" data-testid="more-language-row"><LanguageSelect /></div>
              <div className="flex min-h-[60px] items-center gap-3 px-4" data-testid="more-simple-mode-row">
                <Eye className="h-5 w-5" />
                <div className="flex-1">
                  <div className="font-semibold">{t("Jednoduchý režim")}</div>
                  <div className="text-xs text-slate-600">{t("Větší tlačítka i text; skryje volitelné sekce pro snadné ovládání.")}</div>
                </div>
                <Switch checked={simpleMode} onCheckedChange={setSimpleMode} data-testid="more-simple-mode-switch" aria-label={t("Jednoduchý režim")} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="push-panel">
              <div className="flex items-center gap-2 font-heading font-semibold"><BellRing className="h-5 w-5" />{t("Upozornění (push)")}</div>
              {!pushState.supported && <p className="mt-1 text-sm text-slate-700">{t("Tento prohlížeč push notifikace nepodporuje. Nainstalujte aplikaci na plochu a použijte moderní verzi Chrome/Edge/Safari.")}</p>}
              {pushState.supported && pushState.permission === "denied" && <p className="mt-1 text-sm text-amber-900">{t("Oznámení jsou v prohlížeči zablokována. Povolte je v nastavení prohlížeče pro tuto doménu.")}</p>}
              {pushState.supported && pushState.permission !== "denied" && (
                <>
                  <p className="mt-1 text-sm text-slate-700">{t(pushState.subscribed ? "Dostáváte oznámení i při zavřené aplikaci (nové žádosti o volno, STOP závady, blížící se servisy)." : "Zapněte, aby vám chodila oznámení i při zavřené aplikaci.")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button className={pushState.subscribed ? "h-12 border-2 border-slate-900 bg-white font-semibold text-slate-900 hover:bg-slate-50" : "btn-primary h-12 font-semibold"} onClick={togglePush} disabled={pushState.busy} data-testid="push-toggle">
                      {pushState.subscribed ? <><BellOff className="mr-2 h-5 w-5" />{t("Vypnout upozornění")}</> : <><BellRing className="mr-2 h-5 w-5" />{t("Zapnout upozornění")}</>}
                    </Button>
                    {pushState.subscribed && <Button variant="outline" className="h-12 font-semibold" onClick={sendTest} data-testid="push-test">{t("Poslat test")}</Button>}
                  </div>
                </>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="install-panel">
              <div className="flex items-center gap-2 font-heading font-semibold"><Smartphone className="h-5 w-5" />{t("Aplikace v telefonu")}</div>
              {standalone ? <p className="mt-1 text-sm text-emerald-800">{t("Aplikace běží jako nainstalovaná.")}</p>
                : prompt ? <Button className="btn-primary mt-2 h-12 font-semibold" onClick={async () => { prompt.prompt(); setPrompt(null); }} data-testid="install-button">{t("Přidat na plochu")}</Button>
                : <p className="mt-1 text-sm text-slate-700">{t("iPhone: v Safari klepněte na Sdílet → Přidat na plochu. Android: v Chrome nabídka ⋮ → Instalovat aplikaci.")}</p>}
              <p className="mt-2 text-xs text-slate-600">{t("Po prvním načtení se aplikace otevře i bez internetu; zápisy se ukládají do fronty v telefonu. Ikona na ploše sama o sobě neznamená ověřený offline provoz na vašem zařízení.")}</p>
            </div>
          </details>
        </div>
      </section>
      {atLeast(user, "manager") && <section aria-labelledby="more-management-title" className="space-y-3"><h2 id="more-management-title" className="font-heading text-lg font-bold">{t("Vedení a správa")}</h2><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <L to="/prehled" icon={LayoutDashboard} label="Přehled vedení" testid="more-overview" />
        <L to="/kontrola" icon={ShieldCheck} label="Kontrola výjimek docházky" testid="more-review" />
        <L to="/vsechny-zapisy" icon={Files} label="Všechny zápisy" testid="more-all-records" />
        <L to="/pracoviste" icon={MapPin} label="Pracoviště a QR" testid="more-workplaces" />
        <L to="/uzivatele" icon={Users} label="Uživatelé a přístupy" testid="more-users" />
      </div></section>}
      <Button variant="outline" className="h-14 w-full text-base font-semibold text-red-700" onClick={out} data-testid="more-logout-button"><LogOut className="mr-2 h-5 w-5" />{t("Odhlásit")}</Button>
    </div>
  );
}
