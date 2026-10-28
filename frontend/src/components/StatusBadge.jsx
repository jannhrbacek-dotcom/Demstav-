import React from "react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language";
import { HardDrive, Clock, Server, CheckCircle2, BadgeCheck, AlertTriangle, OctagonAlert, XCircle, FileEdit } from "lucide-react";

const MAP = {
  local: { label: "Uloženo v telefonu", cls: "bg-slate-200 text-slate-900 border-slate-300", Icon: HardDrive },
  queued: { label: "Čeká na odeslání", cls: "bg-amber-100 text-amber-900 border-amber-300", Icon: Clock },
  retry: { label: "Čeká na odeslání", cls: "bg-amber-100 text-amber-900 border-amber-300", Icon: Clock },
  received: { label: "Přijato serverem", cls: "bg-blue-100 text-blue-900 border-blue-200", Icon: Server },
  draft: { label: "Koncept na serveru", cls: "bg-blue-100 text-blue-900 border-blue-200", Icon: FileEdit },
  confirmed: { label: "Potvrzeno", cls: "bg-emerald-100 text-emerald-900 border-emerald-200", Icon: CheckCircle2 },
  verified: { label: "Ověřeno", cls: "bg-emerald-100 text-emerald-900 border-emerald-200", Icon: CheckCircle2 },
  approved: { label: "Schváleno", cls: "bg-green-200 text-green-950 border-green-300", Icon: BadgeCheck },
  pending_review: { label: "Čeká na schválení", cls: "bg-orange-100 text-orange-900 border-orange-300", Icon: AlertTriangle },
  pending: { label: "Čeká na schválení", cls: "bg-orange-100 text-orange-900 border-orange-300", Icon: AlertTriangle },
  rejected: { label: "Zamítnuto", cls: "bg-red-100 text-red-900 border-red-300", Icon: XCircle },
  conflict: { label: "Konflikt", cls: "bg-rose-100 text-rose-900 border-rose-300", Icon: AlertTriangle },
  error: { label: "Chyba – nutná oprava", cls: "bg-rose-100 text-rose-900 border-rose-300", Icon: XCircle },
  needs_reason: { label: "Doplňte důvod", cls: "bg-rose-100 text-rose-900 border-rose-300", Icon: AlertTriangle },
  stop: { label: "STOP", cls: "bg-black text-[#FFD200] border-black", Icon: OctagonAlert },
};

export function StatusBadge({ status, label, testid }) {
  const { t } = useLanguage();
  const m = MAP[status] || MAP.local;
  const { Icon } = m;
  return (
    <Badge data-testid={testid || "status-badge"} variant="outline" className={`${m.cls} gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {t(label || m.label)}
    </Badge>
  );
}
