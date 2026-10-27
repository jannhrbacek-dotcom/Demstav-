import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, atLeast } from "@/lib/auth";
import { errText } from "@/lib/api";

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const u = await login(email.trim(), password);
      nav(u.must_change_password ? "/zmena-hesla" : atLeast(u, "manager") && window.innerWidth >= 1024 ? "/prehled" : "/dnes", { replace: true });
    } catch (ex) { setErr(errText(ex)); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="dark relative overflow-hidden bg-[#0B0F14] px-6 pb-10 pt-12">
        <div className="mx-auto max-w-md">
          <div className="font-heading text-4xl font-bold tracking-tight text-white">DEMSTAV</div>
          <div className="mt-1 text-xs font-semibold tracking-[0.4em] text-slate-300">G R O U P · OPERATIONS</div>
          <div className="mt-3 h-1 w-40 bg-[#FFD200]" />
          <p className="mt-5 text-base text-slate-200">Provozní deník stroje, šichtovnice a docházka. Zapište jednou – vedoucí to uvidí hned po odeslání.</p>
        </div>
        <div className="hazard-stripe absolute inset-x-0 bottom-0 h-2" />
      </div>
      <form onSubmit={submit} className="mx-auto -mt-4 max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-md" data-testid="login-form">
        <h1 className="font-heading text-2xl font-semibold text-slate-900">Přihlášení</h1>
        <label className="block space-y-1.5"><span className="text-sm font-semibold">Přihlašovací jméno nebo e-mail</span>
          <Input type="text" autoCapitalize="none" autoCorrect="off" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-14 text-base" data-testid="login-email-input" required /></label>
        <label className="block space-y-1.5"><span className="text-sm font-semibold">Heslo</span>
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-14 text-base" data-testid="login-password-input" required /></label>
        {err && <Alert variant="destructive" data-testid="login-error-alert"><AlertDescription>{err}</AlertDescription></Alert>}
        <Button type="submit" disabled={busy} className="btn-primary h-16 w-full text-lg font-semibold" data-testid="login-submit-button">{busy ? "Přihlašuji…" : "Přihlásit"}</Button>
        <p className="text-xs text-slate-600">Účet vám založí správce a předá dočasné heslo. Při prvním přihlášení si ho změníte.</p>

      </form>
    </div>
  );
}
