import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileDown, KeyRound, LogOut, LayoutDashboard, ShieldCheck, Files, MapPin, Truck, Users, Smartphone, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/Section";
import { useAuth, atLeast } from "@/lib/auth";
import { useSync } from "@/lib/sync";

const L = ({ to, icon: I, label, testid }) => (<Link to={to} className="flex min-h-[60px] items-center gap-3 border-b border-slate-100 px-4 font-semibold last:border-0 hover:bg-slate-50" data-testid={testid}><I className="h-5 w-5" /><span className="flex-1">{label}</span><ChevronRight className="h-5 w-5 text-slate-400" /></Link>);

export default function More() {
  const { user, logout, simpleMode, setSimpleMode } = useAuth();
  const s = useSync();
  const nav = useNavigate();
  const [prompt, setPrompt] = useState(null);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
  useEffect(() => { const h = (e) => { e.preventDefault(); setPrompt(e); }; window.addEventListener("beforeinstallprompt", h); return () => window.removeEventListener("beforeinstallprompt", h); }, []);
  const out = () => { if (s.queue.length && !window.confirm(`V telefonu je ${s.queue.length} neodeslaných položek. Zůstanou uloženy a odešlou se po dalším přihlášení stejného účtu. Odhlásit?`)) return; logout(); nav("/login"); };
  return (
    <div className="space-y-4">
      <PageHeader title="Více" subtitle={`${user?.name} · ${user?.role_label}`} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <L to="/exporty" icon={FileDown} label="Exporty PDF (šichtovnice, deník)" testid="more-exports" />
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
