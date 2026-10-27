import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FileDown, KeyRound, LogOut, LayoutDashboard, ShieldCheck, Files, MapPin, Truck, Users, Smartphone, ChevronRight, Eye, BarChart3, CalendarDays, BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/Section";
import { useAuth, atLeast } from "@/lib/auth";
import { useSync } from "@/lib/sync";
import { errText } from "@/lib/api";
import { pushSupported, pushPermission, getActiveSubscription, enablePush, disablePush, sendTestPush } from "@/lib/push";

const L = ({ to, icon: I, label, testid }) => (<Link to={to} className="flex min-h-[60px] items-center gap-3 border-b border-slate-100 px-4 font-semibold last:border-0 hover:bg-slate-50" data-testid={testid}><I className="h-5 w-5" /><span className="flex-1">{label}</span><ChevronRight className="h-5 w-5 text-slate-400" /></Link>);

export default function More() {
  const { user, logout, simpleMode, setSimpleMode } = useAuth();
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
      <PageHeader title="Více" subtitle={`${user?.name} · ${user?.role_label}`} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <L to="/prehledy" icon={BarChart3} label="Moje přehledy (šichtovnice, deník, směny)" testid="more-my-overview" />
        <L to="/nepritomnost" icon={CalendarDays} label="Dovolená, volno, lékař, nemoc" testid="more-absence" />
        <L to="/exporty" icon={FileDown} label="Exporty a reporty (PDF, XLSX, CSV)" testid="more-exports" />
        <L to="/zmena-hesla" icon={KeyRound} label="Změnit heslo" testid="more-change-password" />
        <div className="flex min-h-[60px] items-center gap-3 px-4" data-testid="more-simple-mode-row">
          <Eye className="h-5 w-5" />
          <div className="flex-1">
            <div className="font-semibold">Jednoduchý režim</div>
            <div className="text-xs text-slate-600">Větší tlačítka i text; skryje volitelné sekce pro snadné ovládání.</div>
          </div>
          <Switch checked={simpleMode} onCheckedChange={setSimpleMode} data-testid="more-simple-mode-switch" />
        </div>
      </div>
      {atLeast(user, "manager") && <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <L to="/prehled" icon={LayoutDashboard} label="Přehled vedení" testid="more-overview" />
        <L to="/kontrola" icon={ShieldCheck} label="Kontrola výjimek docházky" testid="more-review" />
        <L to="/vsechny-zapisy" icon={Files} label="Všechny zápisy" testid="more-all-records" />
        <L to="/pracoviste" icon={MapPin} label="Pracoviště a QR" testid="more-workplaces" />
        <L to="/stroje" icon={Truck} label="Seznam strojů" testid="more-machines" />
        <L to="/uzivatele" icon={Users} label="Uživatelé a přístupy" testid="more-users" />
      </div>}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="push-panel">
        <div className="flex items-center gap-2 font-heading font-semibold"><BellRing className="h-5 w-5" />Upozornění (push)</div>
        {!pushState.supported && <p className="mt-1 text-sm text-slate-700">Tento prohlížeč push notifikace nepodporuje. Nainstalujte aplikaci na plochu a použijte moderní verzi Chrome/Edge/Safari.</p>}
        {pushState.supported && pushState.permission === "denied" && <p className="mt-1 text-sm text-amber-900">Oznámení jsou v prohlížeči zablokována. Povolte je v nastavení prohlížeče pro tuto doménu.</p>}
        {pushState.supported && pushState.permission !== "denied" && (
          <>
            <p className="mt-1 text-sm text-slate-700">{pushState.subscribed ? "Dostáváte oznámení i při zavřené aplikaci (nové žádosti o volno, STOP závady, blížící se servisy)." : "Zapněte, aby vám chodila oznámení i při zavřené aplikaci."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className={pushState.subscribed ? "h-12 border-2 border-slate-900 bg-white font-semibold text-slate-900 hover:bg-slate-50" : "btn-primary h-12 font-semibold"} onClick={togglePush} disabled={pushState.busy} data-testid="push-toggle">
                {pushState.subscribed ? <><BellOff className="mr-2 h-5 w-5" />Vypnout upozornění</> : <><BellRing className="mr-2 h-5 w-5" />Zapnout upozornění</>}
              </Button>
              {pushState.subscribed && <Button variant="outline" className="h-12 font-semibold" onClick={sendTest} data-testid="push-test">Poslat test</Button>}
            </div>
          </>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="install-panel">
        <div className="flex items-center gap-2 font-heading font-semibold"><Smartphone className="h-5 w-5" />Aplikace v telefonu</div>
        {standalone ? <p className="mt-1 text-sm text-emerald-800">Aplikace běží jako nainstalovaná.</p>
          : prompt ? <Button className="btn-primary mt-2 h-12 font-semibold" onClick={async () => { prompt.prompt(); setPrompt(null); }} data-testid="install-button">Přidat na plochu</Button>
          : <p className="mt-1 text-sm text-slate-700">iPhone: v Safari klepněte na Sdílet → Přidat na plochu. Android: v Chrome nabídka ⋮ → Instalovat aplikaci.</p>}
        <p className="mt-2 text-xs text-slate-600">Po prvním načtení se aplikace otevře i bez internetu; zápisy se ukládají do fronty v telefonu. Ikona na ploše sama o sobě neznamená ověřený offline provoz na vašem zařízení.</p>
      </div>
      <Button variant="outline" className="h-14 w-full text-base font-semibold text-red-700" onClick={out} data-testid="more-logout-button"><LogOut className="mr-2 h-5 w-5" />Odhlásit</Button>
    </div>
  );
}
