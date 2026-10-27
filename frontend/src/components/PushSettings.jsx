import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { http, errText } from "@/lib/api";
import { pushSupported, pushEnabled, enablePush, disablePush } from "@/lib/push";

export function PushSettings() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let alive = true; pushEnabled(user.id).then((v) => { if (alive) setEnabled(v); }).catch(() => {}); return () => { alive = false; }; }, [user.id]);
  const act = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); setEnabled(await pushEnabled(user.id)); }
    catch (e) { setError(e.response ? errText(e) : e.message); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="push-settings">
    <h2 className="font-heading text-lg font-semibold">Upozornění i při zavřené aplikaci</h2>
    <p className="text-sm text-slate-700">Nové žádosti, plánované zkrácení směn a STOP závady dorazí přes systém telefonu. Vyžaduje internet a povolená oznámení.</p>
    <p role="status" className="font-semibold">{enabled ? "Push upozornění jsou zapnutá pro tento účet a zařízení." : "Push upozornění jsou vypnutá."}</p>
    {!pushSupported() && <p className="text-sm">Push zde není dostupný. Na iPhonu s iOS 16.4 a novějším přidejte aplikaci v Safari na plochu a otevřete ji z ikony.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button className="h-12" disabled={busy || !pushSupported()} onClick={() => act(() => enabled ? disablePush() : enablePush(user.id))} data-testid="push-toggle">{enabled ? "Vypnout upozornění" : "Zapnout upozornění"}</Button>
      {enabled && <Button variant="outline" className="h-12" disabled={busy} data-testid="push-test" onClick={() => act(async () => {
        const { data } = await http.post("/push/test");
        if (!data.sent) throw new Error("Server žádné upozornění neodeslal. Zkontrolujte nastavení VAPID a zapněte upozornění znovu.");
        toast.success("Server předal zkušební upozornění push službě. Ověřte doručení v telefonu.");
      })}>Poslat zkušební upozornění</Button>}
    </div>
    <p className="text-xs text-slate-600">Doručování může omezit nastavení baterie nebo vynucené zastavení prohlížeče. Samotné zavření okna aplikace push nevypíná.</p>
  </section>;
}
