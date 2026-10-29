import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language";
import { notifyServiceAlerts } from "@/lib/serviceNotify";

/** Short, contextual reminder for the selected machine; no dashboard card or permission prompt. */
export function MachineServiceReminder({ recordId, machine, machines = [] }) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const shown = useRef(new Set());
  const m = machines.find(item => item.label === machine && item.active !== false);
  const id = m?.id, label = m?.label, state = m?.service_state;
  const remaining = m?.remaining_mth, next = m?.next_service_mth;
  const current = m?.current_mth;
  const toastId = `machine-service:${recordId}`;

  useEffect(() => {
    if (!label || !["soon", "due"].includes(state) || remaining == null || !Number.isFinite(Number(remaining))) {
      toast.dismiss(toastId); return;
    }
    const key = `${recordId}:${id || label}:${next}:${state}`;
    if (shown.current.has(key)) return;
    shown.current.add(key);
    const uk = language === "uk";
    const value = String(Math.abs(Number(remaining))).replace(".", ",");
    const description = Number(remaining) < 0
      ? (uk ? `Сервіс прострочено на ${value} MTH.` : `Servis je po termínu o ${value} MTH.`)
      : Number(remaining) === 0 ? (uk ? "Настав час сервісу." : "Servis je právě na řadě.")
      : (uk ? `До сервісу залишилося ${value} MTH.` : `Do servisu zbývá ${value} MTH.`);
    toast.warning(`${label} · ${uk ? "нагадування про сервіс" : "připomenutí servisu"}`, {
      id: toastId, description, duration: 7000,
      action: { label: uk ? "Машини" : "Stroje", onClick: () => navigate("/stroje") },
    });
    // Uses only permission already granted by the user. Sound follows phone settings.
    notifyServiceAlerts([{ id, label, service_state: state, remaining_mth: remaining,
      next_service_mth: next, current_mth: current }]).catch(() => {});
  }, [recordId, id, label, state, remaining, next, current, language, navigate, toastId]);
  useEffect(() => () => toast.dismiss(toastId), [toastId]);
  return null;
}
