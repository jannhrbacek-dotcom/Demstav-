/**
 * Web Push helpers.
 *
 * Kroky:
 *   1. Zkontrolujeme podporu v prohlížeči.
 *   2. Získáme VAPID veřejný klíč z backendu.
 *   3. Získáme/registrujeme Service Worker.
 *   4. Požádáme uživatele o povolení notifikací.
 *   5. Vytvoříme PushSubscription a pošleme ji na backend.
 */
import { http } from "@/lib/api";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushPermission() {
  return pushSupported() ? Notification.permission : "unsupported";
}

function urlB64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration() {
  const reg = await navigator.serviceWorker.ready;
  return reg;
}

export async function getActiveSubscription() {
  if (!pushSupported()) return null;
  const reg = await getRegistration();
  return reg.pushManager.getSubscription();
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("Push notifikace tento prohlížeč nepodporuje.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Pro notifikace povolte v prohlížeči oznámení pro tuto aplikaci.");
  const { data } = await http.get("/push/public-key");
  const vapid = data.public_key;
  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapid) });
  }
  await http.post("/push/subscribe", { subscription: sub.toJSON(), user_agent: navigator.userAgent });
  return sub;
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try { await http.post("/push/unsubscribe", { endpoint: sub.endpoint }); } catch (_) { /* ignore */ }
  try { await sub.unsubscribe(); } catch (_) { /* ignore */ }
}

export async function sendTestPush() {
  const { data } = await http.post("/push/test", {});
  return data?.sent || 0;
}
