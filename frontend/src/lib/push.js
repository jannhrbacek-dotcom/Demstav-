import { http } from "./api";

const OWNER = "demstav:pushOwner";
export const pushSupported = () => window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const registration = () => Promise.race([
  navigator.serviceWorker.ready,
  new Promise((_, reject) => setTimeout(() => reject(new Error("Registrace aplikace není připravena. Obnovte stránku a zkuste to znovu.")), 10000)),
]);
const keyBytes = (value) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export async function pushEnabled(userId) {
  if (!pushSupported() || Notification.permission !== "granted" || localStorage.getItem(OWNER) !== userId) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}

export async function enablePush(userId) {
  if (!pushSupported()) throw new Error("Toto zařízení nepodporuje push. Na iPhonu otevřete aplikaci přidanou na plochu.");
  // Permission request must start directly from the user's click (Safari).
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Upozornění nejsou povolená. Změňte oprávnění v nastavení prohlížeče.");
  const { data } = await http.get("/push/public-key");
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (sub && localStorage.getItem(OWNER) !== userId) {
    await sub.unsubscribe();
    sub = null;
  }
  const created = !sub;
  sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.public_key) });
  try {
    await http.post("/push/subscribe", { subscription: sub.toJSON(), user_agent: navigator.userAgent });
    localStorage.setItem(OWNER, userId);
  } catch (e) {
    if (created) await sub.unsubscribe();
    throw e;
  }
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    // Local revocation works even when offline; revoke before clearing auth.
    if (!(await sub.unsubscribe())) throw new Error("Upozornění se nepodařilo vypnout. Zkuste to znovu.");
    try { await http.post("/push/unsubscribe", { endpoint: sub.endpoint }); } catch { /* expired endpoints are removed on delivery */ }
  }
  localStorage.removeItem(OWNER);
}

export async function refreshPush(userId) {
  if (!(await pushEnabled(userId))) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) await http.post("/push/subscribe", { subscription: sub.toJSON(), user_agent: navigator.userAgent });
}
