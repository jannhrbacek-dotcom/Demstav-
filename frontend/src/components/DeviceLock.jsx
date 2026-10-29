import React, { createContext, useContext, useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { readDeviceLock, devicePinSupported, enableDeviceLock, disableDeviceLock, verifyDevicePin, validatePin, storageKey } from "@/lib/deviceLock";
const Ctx = createContext(null);
export const useDeviceLock = () => useContext(Ctx);

export function DeviceLockProvider({ children }) {
  const { user, login } = useAuth();
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [resetByPassword, setResetByPassword] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState(0);
  useEffect(() => {
    const present = !!(user?.id && readDeviceLock(user.id));
    setEnabled(present); setLocked(present); setPin(""); setError(""); setFailed(0);
    setResetByPassword(false); setPassword(""); setBlockedUntil(0);
  }, [user?.id]);
  useEffect(() => {
    let hiddenAt = null;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt !== null && Date.now() - hiddenAt > 120000 && enabled) {
        setLocked(true); setPin("");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled]);

  const unlock = async (e) => {
    e.preventDefault(); setError("");
    if (resetByPassword) {
      try {
        await login(user.username || user.email, password);
        localStorage.removeItem(storageKey(user.id));
        setEnabled(false); setLocked(false); setPassword(""); setResetByPassword(false);
      } catch (_) { setError(t("Nesprávné heslo. Zkuste to znovu.")); }
      return;
    }
    if (Date.now() < blockedUntil) { setError(t("Příliš mnoho pokusů. Počkejte minutu.")); return; }
    if (await verifyDevicePin(user.id, pin)) {setLocked(false);setFailed(0);setBlockedUntil(0);setPin("");return;}
    const count = failed + 1;
    if (count >= 5) {setFailed(0);setBlockedUntil(Date.now() + 60000);setError(t("Příliš mnoho pokusů. Počkejte minutu."));}
    else {setFailed(count);setError(t("Nesprávný PIN."));}
    setPin("");
  };
  return <Ctx.Provider value={{
    enabled, locked, supported: devicePinSupported(),
    async enable(pinValue) { await enableDeviceLock(user.id, pinValue); setEnabled(true); setLocked(false); },
    async disable(pinValue) { const ok = await disableDeviceLock(user.id, pinValue); if (ok) {setEnabled(false);setLocked(false);} return ok; },
    lockNow() { if(enabled) {setPin("");setLocked(true);} },
  }}>
    {children}
    {user?.id && enabled && locked && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0B0F14] p-5" role="dialog" aria-modal="true" aria-labelledby="lock-title" data-testid="device-locked-screen">
      <form onSubmit={unlock} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-slate-950"><LockKeyhole className="h-9 w-9" /><div><div className="font-heading text-xl font-black">DEMSTAV</div><h1 id="lock-title" className="font-semibold">{t("Aplikace je zamčená")}</h1></div></div>
        <p className="text-sm text-slate-700">{t("Rozpracované zápisy zůstávají v telefonu. Odemkněte obrazovku.")}</p>
        {!resetByPassword ? <label className="block space-y-1">
          <span className="font-semibold">{t("PIN zařízení")}</span>
          <input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]*" minLength={6} maxLength={8} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,8))} required className="h-14 w-full rounded-lg border border-slate-400 px-4 text-2xl tracking-widest" data-testid="device-lock-pin" />
        </label> : <label className="block space-y-1"><span className="font-semibold">{t("Heslo k firemnímu účtu")}</span>
          <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required className="h-14 w-full rounded-lg border border-slate-400 px-4" data-testid="device-recovery-password" />
        </label>}
        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
        <button type="submit" className="btn-primary h-14 w-full rounded-lg font-bold" data-testid="device-unlock-button">{t(resetByPassword ? "Ověřit heslo a vypnout PIN" : "Odemknout")}</button>
        <button type="button" className="min-h-11 w-full text-sm font-semibold text-slate-800 underline" onClick={()=>{setResetByPassword(!resetByPassword);setError("");}} data-testid="device-recovery-switch">{t(resetByPassword ? "Zpět na PIN" : "Zapomněli jste PIN? Přihlásit se heslem")}</button>
        <p className="text-xs text-slate-600">{t("PIN je jen zámek obrazovky. Data prohlížeče nešifruje; skutečné oprávnění chrání přihlášení k účtu.")}</p>
      </form>
    </div>}
  </Ctx.Provider>;
}
export function DeviceLockSettings() {
  const lock = useDeviceLock();
  const { t } = useLanguage();
  const [pin, setPin] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!lock) return null;
  const submit = async (e) => {
    e.preventDefault();setError("");
    if (!lock.enabled && (!validatePin(pin) || pin !== repeat)) {
      setError(t("PIN musí mít 6 až 8 číslic a oba zápisy se musí shodovat.")); return;
    }
    setBusy(true);
    try {
      if (lock.enabled) {
        if (!await lock.disable(pin)) setError(t("Nesprávný PIN."));
      } else await lock.enable(pin);
      setPin(""); setRepeat("");
    } catch (_) {setError(t("PIN se nepodařilo nastavit. Zkontrolujte zabezpečené připojení."));}
    finally {setBusy(false);}
  };
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="device-lock-settings">
    <div className="flex items-center gap-2 font-heading font-semibold"><ShieldCheck className="h-5 w-5" />{t("Zabezpečení obrazovky")}</div>
    <p className="text-sm text-slate-700">{t("Volitelný PIN pouze pro tento telefon. Je to zámek zobrazení, ne šifrování dat ani náhrada přihlášení.")}</p>
    {!lock.supported ? <p className="text-sm text-red-700">{t("Toto zařízení zabezpečený PIN nepodporuje.")}</p>
      : <form onSubmit={submit} className="space-y-2">
        <label className="block text-sm font-semibold">{t(lock.enabled ? "Současný PIN" : "Nový PIN (6–8 číslic)")}
          <input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]*" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,8))} className="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3" required minLength={6} maxLength={8} data-testid="device-settings-pin" />
        </label>
        {!lock.enabled && <label className="block text-sm font-semibold">{t("Zopakovat PIN")}
          <input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]*" value={repeat} onChange={e=>setRepeat(e.target.value.replace(/\D/g,"").slice(0,8))} className="mt-1 h-12 w-full rounded-lg border border-slate-300 px-3" required minLength={6} maxLength={8} data-testid="device-settings-repeat" />
        </label>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary min-h-12 w-full rounded-lg font-semibold" data-testid="device-settings-save">{t(lock.enabled ? "Vypnout PIN" : "Zapnout PIN")}</button>
      </form>}
    {lock.enabled && <button type="button" className="min-h-11 w-full rounded-lg border border-slate-400 px-3 font-semibold" onClick={()=>lock.lockNow()} data-testid="device-lock-now">{t("Zamknout aplikaci nyní")}</button>}
  </section>;
}
