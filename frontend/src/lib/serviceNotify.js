/** Systémová upozornění na blížící se servis (zobrazí se v telefonu, když je aplikace otevřená nebo běží na pozadí). */
const KEY = "demstav:serviceNotified";

export const notifySupported = () => typeof window !== "undefined" && "Notification" in window;
export const notifyPermission = () => (notifySupported() ? Notification.permission : "unsupported");

export async function requestNotify() {
  if (!notifySupported()) return "unsupported";
  try { return await Notification.requestPermission(); } catch { return "denied"; }
}

export const remainingText = (m) => {
  const r = Number(m.remaining_mth);
  const f = (v) => String(Math.abs(Math.round(v * 10) / 10)).replace(".", ",");
  return r <= 0 ? `servis je po termínu o ${f(r)} mth` : `do dalšího servisu zbývá ${f(r)} mth`;
};

/** Pošle upozornění jen jednou pro daný stroj, servisní termín a stav. */
export async function notifyServiceAlerts(alerts) {
  if (!notifySupported() || Notification.permission !== "granted" || !alerts?.length) return;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { seen = {}; }
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
  for (const m of alerts) {
    const k = `${m.id}:${m.next_service_mth}:${m.service_state}`;
    if (seen[k]) continue;
    const title = m.service_state === "due" ? `Servis po termínu: ${m.label}` : `Blíží se servis: ${m.label}`;
    const body = `${remainingText(m)[0].toUpperCase()}${remainingText(m).slice(1)} (servis při ${m.next_service_mth} mth, stav ${String(m.current_mth).replace(".", ",")} mth).`;
    try {
      if (reg?.showNotification) await reg.showNotification(title, { body, tag: `service-${m.id}`, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: "/" } });
      else new Notification(title, { body, tag: `service-${m.id}` });
      seen[k] = Date.now();
    } catch { /* ignore */ }
  }
  localStorage.setItem(KEY, JSON.stringify(seen));
}
