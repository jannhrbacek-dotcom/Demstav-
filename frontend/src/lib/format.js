export const pragueDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(d);
export const dmy = (s) => { if (!s) return ""; const [y, mo, d] = s.slice(0, 10).split("-"); return `${d}.${mo}.${y}`; };
export const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }) : "");
export const dateTime = (iso) => (iso ? new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" }) : "");
export const weekRange = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const f = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return [f(mon), f(sun)];
};
export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
export const KIND_LABELS = { arrival: "Příchod", departure: "Odchod", break_start: "Začátek přestávky", break_end: "Konec přestávky", travel_start: "Přejezd A → B" };
export const STATE_LABELS = { away: "Mimo směnu", working: "Pracuji", break: "Přestávka", travel: "Přejezd – v práci" };
export const REASON_LABELS = {
  offline: "zapsáno bez připojení", device_clock: "čas telefonu nesouhlasí se serverem", qr_invalid: "neplatný nebo prošlý QR",
  qr_missing: "chybí QR kód", gps_unavailable: "GPS nedostupná", gps_inaccurate: "GPS nepřesná", gps_outside: "mimo okruh pracoviště",
  gps_boundary: "na hranici okruhu", gps_stale: "stará poloha", manual: "ruční záznam", out_of_order: "nenavazuje na předchozí událost",
  correction: "opraveno na žádost",
};
export const MODE_LABELS = { manual: "Ručně se schválením", qr: "QR kód", gps: "GPS okruh", qr_gps: "QR + GPS" };
export const ROLE_LABELS = { employee: "Strojník / zaměstnanec", manager: "Vedoucí výroby", operations_manager: "Vedoucí provozu", admin: "Admin", owner: "Jednatel" };
export const SERVICE_BY = { operator: "servis - strojník", workshop: "servis - dílna výjezd", external: "servis - cizí firma" };
export const ATT_KINDS = { vehicleFuel: "Tankování vozidla", machineFuel: "Tankování stroje", invoice: "Podklad pro fakturaci", photo: "Fotografie", other: "Ostatní" };
