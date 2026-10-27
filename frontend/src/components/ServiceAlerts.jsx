import React, { useEffect, useState } from "react";
import { Wrench, BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useCached } from "@/lib/data";
import { notifyPermission, notifyServiceAlerts, remainingText } from "@/lib/serviceNotify";

const fmt = (v) => (v === null || v === undefined ? "—" : String(v).replace(".", ","));

/** Upozornění na blížící se pravidelný servis (každých 500 mth, varování 100 mth předem). */
export function ServiceAlerts({ compact = false, alerts: given }) {
  const q = useCached("/service-alerts", { enabled: !given });
  const alerts = given || q.data || [];
  const [perm] = useState(notifyPermission());

  useEffect(() => { if (alerts.length) notifyServiceAlerts(alerts); }, [alerts]);

  if (!alerts.length) return null;
  return (
    <div className="space-y-2 rounded-xl border-2 border-slate-900 bg-white p-4 shadow-sm" data-testid="service-alerts">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-heading text-lg font-semibold"><Wrench className="h-5 w-5" />Servisní intervaly</div>
        {perm === "default" && (
          <Link to="/vice"><Button type="button" variant="outline" className="h-10" data-testid="service-alerts-enable-notify">
            <BellRing className="mr-1 h-4 w-4" />Nastavit upozornění v telefonu
          </Button></Link>
        )}
        {perm === "denied" && <span className="flex items-center gap-1 text-xs text-slate-600"><BellOff className="h-4 w-4" />Upozornění jsou v prohlížeči zakázaná</span>}
      </div>
      {alerts.map((m) => (
        <div key={m.id} className={`flex items-start gap-3 rounded-lg px-3 py-2 ${m.service_state === "due" ? "bg-black text-[#FFD200]" : "bg-amber-100 text-amber-950"}`} data-testid="service-alert-item">
          <Wrench className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{m.label}: <span data-testid="service-alert-remaining">{remainingText(m)}</span></div>
            {!compact && <div className="text-xs opacity-90">Servis při {fmt(m.next_service_mth)} mth · aktuální stav {fmt(m.current_mth)} mth · interval {m.service_interval_mth} mth</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

