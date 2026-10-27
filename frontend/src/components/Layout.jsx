import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Sun, ClipboardList, Clock3, CloudUpload, Menu, LayoutDashboard, ShieldCheck, Files, MapPin, Users, Truck, FileDown, LogOut, WifiOff, RefreshCw, Eye, CalendarDays, BarChart3 } from "lucide-react";
import { useAuth, atLeast } from "@/lib/auth";
import { useSync, syncNow } from "@/lib/sync";
import { Button } from "@/components/ui/button";
import { ReloginDialog } from "@/components/ReloginDialog";

export function SimpleModeToggle({ className = "" }) {
  const { simpleMode, setSimpleMode } = useAuth();
  return (
    <button type="button" onClick={() => setSimpleMode(!simpleMode)} data-testid="simple-mode-toggle"
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${simpleMode ? "bg-[#FFD200] text-slate-900" : "bg-white/10 text-slate-100 hover:bg-white/20"} ${className}`}
      title="Jednoduchý režim: větší tlačítka a text pro snadné ovládání.">
      <Eye className="h-4 w-4" />{simpleMode ? "Jednoduché zapnuto" : "Jednoduchý režim"}
    </button>
  );
}

const employeeNav = [
  { to: "/dnes", label: "Dnes", icon: Sun, testid: "nav-today" },
  { to: "/zapisy", label: "Zápisy", icon: ClipboardList, testid: "nav-records" },
  { to: "/dochazka", label: "Docházka", icon: Clock3, testid: "nav-attendance" },
  { to: "/fronta", label: "Fronta", icon: CloudUpload, testid: "nav-queue" },
  { to: "/vice", label: "Více", icon: Menu, testid: "nav-more" },
];
const managerNav = [
  { to: "/prehled", label: "Přehled vedení", icon: LayoutDashboard, testid: "nav-overview", role: "manager" },
  { to: "/kontrola", label: "Kontrola výjimek", icon: ShieldCheck, testid: "nav-review", role: "manager" },
  { to: "/vsechny-zapisy", label: "Všechny zápisy", icon: Files, testid: "nav-all-records", role: "manager" },
  { to: "/pracoviste", label: "Pracoviště", icon: MapPin, testid: "nav-workplaces", role: "manager" },
  { to: "/stroje", label: "Stroje", icon: Truck, testid: "nav-machines", role: "manager" },
  { to: "/uzivatele", label: "Uživatelé", icon: Users, testid: "nav-users", role: "manager" },
];

function Logo() {
  return (
    <div className="leading-none">
      <div className="font-heading text-xl font-bold tracking-tight text-white">DEMSTAV</div>
      <div className="mt-0.5 flex items-center gap-2"><span className="text-[10px] font-semibold tracking-[0.35em] text-slate-300">OPERATIONS</span></div>
      <div className="mt-1.5 h-[3px] w-full bg-[#FFD200]" />
    </div>
  );
}

export function SyncPill() {
  const s = useSync();
  const n = s.queue.length;
  if (!s.online) return <div className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900" data-testid="offline-indicator"><WifiOff className="h-4 w-4" />Offline · {n} čeká</div>;
  if (n) return <button onClick={() => syncNow()} className="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900" data-testid="sync-indicator"><RefreshCw className={`h-4 w-4 ${s.syncing ? "animate-spin" : ""}`} />{n} neodeslaných</button>;
  return <div className="flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-900" data-testid="sync-indicator"><CloudUpload className="h-4 w-4" />Vše odesláno</div>;
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const s = useSync();
  const nav = useNavigate();
  const isMgr = atLeast(user, "manager");
  const item = (n) => (
    <NavLink key={n.to} to={n.to} data-testid={n.testid}
      className={({ isActive }) => `flex min-h-[48px] items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 ${isActive ? "bg-[#FFD200] text-slate-900" : "text-slate-200 hover:bg-white/10"}`}>
      <n.icon className="h-5 w-5" />{n.label}
      {n.to === "/fronta" && s.queue.length > 0 && <span className="ml-auto rounded bg-amber-400 px-1.5 text-xs text-slate-900">{s.queue.length}</span>}
    </NavLink>
  );
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <aside className="dark fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#0B0F14] px-4 py-5 lg:flex" data-testid="desktop-sidebar">
        <Logo />
        <div className="mt-6 space-y-1">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Můj den</div>
          {employeeNav.filter((n) => n.to !== "/vice").map(item)}
          {item({ to: "/prehledy", label: "Moje přehledy", icon: BarChart3, testid: "nav-my-overview" })}
          {item({ to: "/nepritomnost", label: "Dovolená a absence", icon: CalendarDays, testid: "nav-absence" })}
          {item({ to: "/exporty", label: "Exporty a reporty", icon: FileDown, testid: "nav-exports" })}
        </div>
        {isMgr && <div className="mt-6 space-y-1"><div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vedení</div>{managerNav.map(item)}</div>}
        <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
          <div className="px-1"><div className="truncate text-sm font-semibold text-white" data-testid="sidebar-user-name">{user?.name}</div><div className="text-xs text-slate-400" data-testid="sidebar-user-role">{user?.role_label}{user?.username && ` · ${user.username}`}</div></div>
          <SimpleModeToggle className="w-full justify-center" />
          <Button variant="ghost" className="w-full justify-start text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => { logout(); nav("/login"); }} data-testid="logout-button"><LogOut className="mr-2 h-4 w-4" />Odhlásit</Button>
        </div>
      </aside>

      <header className="dark sticky top-0 z-20 flex items-center justify-between gap-2 bg-[#0B0F14] px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-2"><SimpleModeToggle /><SyncPill /></div>
      </header>

      <main className="lg:pl-64">
        <div className="hidden items-center justify-end gap-3 border-b border-slate-200 bg-white px-8 py-3 lg:flex"><SyncPill /></div>
        {!s.online && <div className="hazard-stripe h-1.5" />}
        <div className="mx-auto w-full max-w-6xl min-w-0 overflow-x-hidden px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">{children}</div>
      </main>

      <nav className="dark safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-[#0B0F14] lg:hidden" data-testid="mobile-bottom-nav">
        {employeeNav.map((n) => (
          <NavLink key={n.to} to={n.to} data-testid={`m-${n.testid}`} className={({ isActive }) => `relative flex min-h-[64px] flex-col items-center justify-center gap-1 text-[11px] font-semibold ${isActive ? "text-[#FFD200]" : "text-slate-300"}`}>
            {({ isActive }) => (<>{isActive && <span className="absolute top-0 h-1 w-10 rounded-b bg-[#FFD200]" />}<n.icon className="h-6 w-6" />{n.label}
              {n.to === "/fronta" && s.queue.length > 0 && <span className="absolute right-3 top-2 rounded bg-amber-400 px-1 text-[10px] text-slate-900">{s.queue.length}</span>}</>)}
          </NavLink>
        ))}
      </nav>
      <ReloginDialog />
    </div>
  );
}
