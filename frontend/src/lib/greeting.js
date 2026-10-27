/** Pozdrav ve správném českém 5. pádě. U neznámých jmen neriskujeme nesmyslné tvary. */
const VOCATIVES = {
  jan: "Jane", jakub: "Jakube", marcel: "Marceli", petr: "Petře", pavel: "Pavle",
  karel: "Karle", tomáš: "Tomáši", matyáš: "Matyáši", martin: "Martine",
  josef: "Josefe", michal: "Michale", david: "Davide", lukáš: "Lukáši",
  hana: "Hano", anna: "Anno", eva: "Evo", jana: "Jano", veronika: "Veroniko",
  lucie: "Lucie", petra: "Petro", lenka: "Lenko", kateřina: "Kateřino",
};
export function osloveni(name) {
  const first = (name || "").trim().split(/\s+/)[0] || "";
  if (!first) return "";
  const normal = first.toLocaleLowerCase("cs-CZ");
  if (VOCATIVES[normal]) return VOCATIVES[normal];
  if (normal.endsWith("a")) return first.slice(0, -1) + "o";
  return first;
}
export function pracovniPozdrav(name, date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", hour: "2-digit", hourCycle: "h23" }).format(date));
  const prefix = hour < 10 ? "Dobré ráno" : hour < 18 ? "Dobrý den" : "Dobrý večer";
  return `${prefix}${name ? ", " + osloveni(name) : ""}`;
}
