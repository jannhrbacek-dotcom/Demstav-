import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useSync } from "@/lib/sync";
import { errText } from "@/lib/api";

/** Session expiry never deletes local data: user signs in again and the queue continues. */
export function ReloginDialog() {
  const { user, login, expired } = useAuth();
  const s = useSync();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const open = !!user && (expired || s.needsLogin) && navigator.onLine;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await login(user.email, pw); setPw(""); } catch (ex) { setErr(errText(ex)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md [&>button]:hidden" data-testid="relogin-dialog">
        <DialogHeader><DialogTitle className="font-heading">Přihlášení vypršelo</DialogTitle>
          <DialogDescription>Vaše rozepsané a neodeslané záznamy ({s.queue.length}) zůstávají uložené v telefonu. Po přihlášení se odešlou.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="text-sm font-semibold">{user?.email}</div>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Heslo" className="h-12" data-testid="relogin-password-input" autoFocus />
          {err && <p className="text-sm font-medium text-red-700" data-testid="relogin-error">{err}</p>}
          <Button type="submit" disabled={busy || !pw} className="btn-primary h-12 w-full text-base font-semibold" data-testid="relogin-submit-button">Přihlásit a odeslat</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
