import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BookOpenText, Camera, Clock3, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth, atLeast } from "@/lib/auth";
import { errText } from "@/lib/api";
import { LanguageSelect, useLanguage } from "@/lib/language";

const featureCards = [
  { Icon: Clock3, title: "Docházka na jeden dotyk", text: "Příchod, odchod, přestávky a žádosti o opravu." },
  { Icon: BookOpenText, title: "Deník a šichtovnice", text: "Stroj, práce, MTH a servis bez přepisování papírů." },
  { Icon: Camera, title: "Přepis z fotografie", text: "Vyfoťte zápis, zkontrolujte návrh a potvrďte údaje." },
];

export default function Login() {
  const { login, user } = useAuth();
  const { t } = useLanguage();
  const nav = useNavigate();
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const u = await login(email.trim(), password);
      nav(u.must_change_password ? "/zmena-hesla" : atLeast(u, "manager") && window.innerWidth >= 1024 ? "/prehled" : "/dnes", { replace: true });
    } catch (ex) { setErr(errText(ex)); } finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-[#F5F7FA]" data-testid="welcome-screen">
    <div className="dark relative overflow-hidden bg-[#0B0F14] px-5 pb-16 pt-6 text-white lg:pb-24 lg:pt-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-3">
          <div><div className="font-heading text-3xl font-black tracking-tight md:text-4xl">DEMSTAV</div>
            <div className="mt-1 text-xs font-semibold tracking-[0.35em] text-slate-300">GROUP · OPERATIONS</div>
            <div className="mt-2 h-1 w-32 bg-[#FFD200]" /></div>
          <LanguageSelect compact dark />
        </div>
        <div className="mt-9 grid items-center gap-8 lg:grid-cols-2">
          <section className="max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD200]/60 px-3 py-1 text-xs font-semibold text-[#FFD200]"><ShieldCheck className="h-4 w-4" />{t("Digitální provozní evidence")}</div>
            <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">{t("Váš pracovní den přehledně na jednom místě")}</h1>
            <p className="text-base leading-relaxed text-slate-200">{t("Provozní deník stroje, šichtovnice a docházka. Zapište jednou – vedoucí to uvidí hned po odeslání.")}</p>
          </section>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1" data-testid="welcome-features">
            {featureCards.map(({ Icon, title, text }) => <div key={title} className="flex items-start gap-3 rounded-xl border border-slate-700 bg-white/5 p-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FFD200] text-slate-950"><Icon className="h-6 w-6" /></div>
              <div><h2 className="font-semibold">{t(title)}</h2><p className="mt-1 text-sm text-slate-300">{t(text)}</p></div>
            </div>)}
          </div>
        </div>
      </div>
      <div className="hazard-stripe absolute inset-x-0 bottom-0 h-2" />
    </div>
    <div className="mx-auto grid max-w-5xl gap-5 px-4 pb-12 lg:grid-cols-2">
      <form onSubmit={submit} className="relative -mt-10 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-7 lg:-mt-12" data-testid="login-form">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-heading text-2xl font-bold text-slate-900">{t("Přihlášení")}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{t("Firemní účet")}</span></div>
        <label className="block space-y-1.5"><span className="text-sm font-semibold">{t("Přihlašovací jméno nebo e-mail")}</span>
          <Input type="text" autoCapitalize="none" autoCorrect="off" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="h-14 text-base" data-testid="login-email-input" required /></label>
        <label className="block space-y-1.5"><span className="text-sm font-semibold">{t("Heslo")}</span>
          <div className="relative"><Input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="h-14 pr-14 text-base" data-testid="login-password-input" required />
          <button type="button" className="absolute right-1 top-1 flex h-12 w-12 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100" onClick={() => setShowPassword(v=>!v)} aria-label={t(showPassword ? "Skrýt heslo" : "Zobrazit heslo")} data-testid="login-password-toggle">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></label>
        {err && <Alert variant="destructive" data-testid="login-error-alert"><AlertDescription>{err}</AlertDescription></Alert>}
        <Button type="submit" disabled={busy} className="btn-primary h-16 w-full gap-2 text-lg font-bold" data-testid="login-submit-button">{t(busy ? "Přihlašuji…" : "Přihlásit")}<ArrowRight className="h-5 w-5" /></Button>
        <p className="text-xs leading-relaxed text-slate-600">{t("Účet vám založí správce a předá dočasné heslo. Při prvním přihlášení si ho změníte.")}</p>
      </form>
      <aside className="space-y-3 pt-2 text-sm text-slate-700 lg:pt-10">
        <div className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="h-5 w-5" />{t("Zabezpečený firemní přístup")}</div>
        <p>{t("Každý zaměstnanec má vlastní přístup. Oprávnění k zápisům a jejich schvalování určuje přidělená role.")}</p>
        <p>{t("Zápisy bez internetu zůstávají v telefonu, dokud se úspěšně neodešlou. Před odinstalací zkontrolujte frontu.")}</p>
        <p className="text-xs text-slate-600">{t("Potřebujete pomoc s účtem? Obraťte se na správce DEMSTAV.")}</p>
      </aside>
    </div>
  </main>;
}
