import React from "react";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { Sun, ClipboardList, Clock3, Cloud, CloudAlert, CloudOff, CloudUpload, CircleHelp, Menu, LayoutDashboard, ShieldCheck, Files, MapPin, Users, Truck, FileDown, LogOut, RefreshCw, Eye, CalendarDays, BarChart3 } from "lucide-react";
import { useAuth, atLeast } from "@/lib/auth";
import { useSync, syncNow } from "@/lib/sync";
import { Button } from "@/components/ui/button";
import { ReloginDialog } from "@/components/ReloginDialog";

export function SimpleModeToggle({ className = "" }) {
  const { simpleMode, setSimpleMode } = useAuth();
  return (
    <button type="button" role="switch" aria-checked={simpleMode} aria-label="Jednoduchý režim"
      onClick={() => setSimpleMode(!simpleMode)} data-testid="simple-mode-toggle"
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-white/20 px-2 text-[11px] font-semibold transition-colors ${simpleMode ? "bg-[#FFD200] text-slate-950" : "bg-white/10 text-white hover:bg-white/20"} ${className}`}
      title="Jednoduchý režim: větší text a snadné ovládání">
      <Eye className="h-4 w-4" /><span className="hidden sm:inline">{simpleMode ? "Zap." : "Jedn."}</span>
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
  const [expanded, setExpanded] = React.useState(false);
  const failed = s.queue.some(o => ["error", "conflict", "needs_reason"].includes(o.state));
  const waiting = s.queue.length > 0;
  const stale = !s.lastVerifiedAt || Date.now() - new Date(s.lastVerifiedAt).getTime() > 5 * 60 * 1000;
  const state = failed ? "failed" : !s.online || (stale && !waiting) ? "offline" : waiting ? "pending" : "synced";
  const meta = {
    synced: { label: "Synchronizováno a potvrzeno serverem", Icon: Cloud, color: "text-emerald-400" },
    pending: { label: "Čeká na odeslání", Icon: CloudUpload, color: "text-amber-400" },
    failed: { label: "Vyžaduje opravu synchronizace", Icon: CloudAlert, color: "text-red-400" },
    offline: { label: "Offline nebo server nebyl ověřen", Icon: CloudOff, color: "text-slate-300" },
  }[state];
  return <div className="relative" data-testid="sync-indicator">
    <button type="button" onClick={() => setExpanded(!expanded)} aria-label={meta.label} title={meta.label}
      aria-expanded={expanded} className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/20 bg-white/10" data-testid={state === "offline" ? "offline-indicator" : "sync-cloud-button"}>
      <meta.Icon className={`h-5 w-5 ${meta.color}`} aria-hidden="true" />
      {waiting && <span className="absolute -right-1 -top-1 rounded-full bg-[#FFD200] px-1 text-[10px] font-bold text-slate-950">{s.queue.length}</span>}
    </button>
    {expanded && <div role="status" className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-xl">
      <p className="font-semibold">{meta.label}</p>
      <p className="mt-1">{s.queue.length} položek ve frontě.</p>
      {s.lastError && <p className="mt-1 text-red-700">{s.lastError}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => syncNow()} className="min-h-11 flex-1 rounded-lg bg-[#FFD200] px-2 font-semibold text-slate-900"><RefreshCw className="mr-1 inline h-4 w-4" />Opakovat</button>
        <Link to="/fronta" onClick={() => setExpanded(false)} className="flex min-h-11 items-center rounded-lg border px-3 font-semibold">Detail</Link>
      </div>
    </div>}
  </div>;
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const s = useSync();
  const nav = useNavigate();
  const loc = useLocation();
  const help = <Link to="/jak-na-to" state={{ returnTo: loc.pathname, context: loc.pathname }} data-testid="header-guide"
    className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2 text-xs font-semibold text-white" aria-label="Jak na to" title="Jak na to">
    <CircleHelp className="h-5 w-5" /><span className="hidden min-[390px]:inline">Jak na to</span>
  </Link>;
  const isMgr = atLeast(user, "manager");
  const mobileNav = isMgr ? [
    {to: '/prehled', label: 'Přehled', icon: LayoutDashboard, testid: 'nav-overview'},
    {to: '/kontrola', label: 'Ke kontrole', icon: ShieldCheck, testid: 'nav-review'},
    {to: '/kalendar', label: 'Tým', icon: CalendarDays, testid: 'nav-team'},
    employeeNav[0], employeeNav[4],
  ] : employeeNav;
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
        <div className="flex items-center justify-between gap-2"><Logo />{help}</div>
        <div className="mt-6 space-y-1">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Můj den</div>
          {employeeNav.filter((n) => n.to !== "/vice" && (n.to !== "/fronta" || s.queue.length > 0)).map(item)}
          {item({ to: "/jak-na-to", label: "Jak na to", icon: Eye, testid: "nav-guide" })}
          {item({ to: "/prehledy", label: "Moje přehledy", icon: BarChart3, testid: "nav-my-overview" })}
          {item({ to: "/nepritomnost", label: "Dovolená a absence", icon: CalendarDays, testid: "nav-absence" })}
          {item({ to: "/kalendar", label: "Kalendář týmu", icon: CalendarDays, testid: "nav-team-calendar" })}
          {item({ to: "/exporty", label: "Exporty a reporty", icon: FileDown, testid: "nav-exports" })}
        </div>
        {isMgr && <div className="mt-6 space-y-1"><div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vedení</div>{managerNav.map(item)}</div>}
        <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
          <div className="px-1"><div className="truncate text-sm font-semibold text-white" data-testid="sidebar-user-name">{user?.name}</div><div className="text-xs text-slate-400" data-testid="sidebar-user-role">{user?.role_label}{user?.username && ` · ${user.username}`}</div></div>
          <SimpleModeToggle className="w-full" />
          <Button variant="ghost" className="w-full justify-start text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => { logout(); nav("/login"); }} data-testid="logout-button"><LogOut className="mr-2 h-4 w-4" />Odhlásit</Button>
        </div>
      </aside>

      <header className="dark sticky top-0 z-20 flex items-center justify-between gap-2 bg-[#0B0F14] px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2"><Logo />{help}</div>
        <div className="flex items-center gap-1.5"><SimpleModeToggle /><SyncPill /></div>
      </header>

      <main className="lg:pl-64">
        <div className="hidden items-center justify-end gap-3 border-b border-slate-200 bg-[#0B0F14] px-8 py-2 lg:flex"><SimpleModeToggle /><SyncPill /></div>
        {!s.online && <div className="hazard-stripe h-1.5" />}
        <div className="mx-auto w-full max-w-6xl min-w-0 overflow-x-hidden px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">{children}</div>
      </main>

      <nav className="dark safe-bottom fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-white/10 bg-[#0B0F14] lg:hidden" data-testid="mobile-bottom-nav">
        {mobileNav.filter((n) => n.to !== "/fronta" || s.queue.length > 0).map((n) => (
          <NavLink key={n.to} to={n.to} data-testid={`m-${n.testid}`} className={({ isActive }) => `relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${isActive ? "text-[#FFD200]" : "text-slate-300"}`}>
            {({ isActive }) => (<>{isActive && <span className="absolute top-0 h-1 w-10 rounded-b bg-[#FFD200]" />}<n.icon className="h-6 w-6" />{n.label}
              {n.to === "/fronta" && s.queue.length > 0 && <span className="absolute right-3 top-2 rounded bg-amber-400 px-1 text-[10px] text-slate-900">{s.queue.length}</span>}</>)}
          </NavLink>
        ))}
      </nav>
      <ReloginDialog />
    </div>
  );
}
