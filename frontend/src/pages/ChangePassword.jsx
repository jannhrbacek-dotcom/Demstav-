import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { errText } from "@/lib/api";

export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const nav = useNavigate();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (pw !== pw2) { setErr("Hesla se neshodují."); return; }
    try { await changePassword(cur, pw); toast.success("Heslo změněno"); nav("/dnes", { replace: true }); } catch (ex) { setErr(errText(ex)); }
  };
  return (
    <div className="flex min-h-screen items-start justify-center bg-[#F5F7FA] px-4 pt-12">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-md" data-testid="password-change-form">
        <div className="h-1 w-24 bg-[#FFD200]" />
        <h1 className="font-heading text-2xl font-semibold">{user?.must_change_password ? "Nastavte si vlastní heslo" : "Změna hesla"}</h1>
        {user?.must_change_password && <p className="text-sm text-slate-700">Přihlásili jste se dočasným heslem od správce. Z bezpečnostních důvodů si teď nastavte vlastní (alespoň 8 znaků, písmeno i číslice).</p>}
        <Input type="password" placeholder="Současné / dočasné heslo" value={cur} onChange={(e) => setCur(e.target.value)} className="h-14" data-testid="password-change-current-input" required />
        <Input type="password" placeholder="Nové heslo" value={pw} onChange={(e) => setPw(e.target.value)} className="h-14" data-testid="password-change-new-input" required />
        <Input type="password" placeholder="Nové heslo znovu" value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-14" data-testid="password-change-confirm-input" required />
        {err && <Alert variant="destructive" data-testid="password-change-error"><AlertDescription>{err}</AlertDescription></Alert>}
        <Button type="submit" className="btn-primary h-14 w-full text-base font-semibold" data-testid="password-change-submit-button">Uložit nové heslo</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={async () => { if (user?.must_change_password) { if (await logout()) nav("/login"); } else nav(-1); }} data-testid="password-change-cancel">{user?.must_change_password ? "Odhlásit" : "Zpět"}</Button>
      </form>
    </div>
  );
}

