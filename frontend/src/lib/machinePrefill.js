/** Předvyplnění z historie konkrétního stroje. Konečné MTH nikdy nekopírujeme. */
export function prefillMachine(previous, machine, histories = [], registry = []) {
  if (machine === previous.machine) return previous;
  const next = { ...previous, machine };
  const label = (machine || "").trim().toLocaleLowerCase("cs-CZ");
  const records = histories
    .filter(x => x.status === "confirmed" && (!previous.date || x.date <= previous.date) && (x.machine || "").trim().toLocaleLowerCase("cs-CZ") === label)
    .sort((a, b) => (b.date + (b.updatedAt || b.updated_at || "")).localeCompare(a.date + (a.updatedAt || a.updated_at || "")));
  const prev = records.find(x => x.mthEnd);
  const known = registry.find(x => (x.label || "").trim().toLocaleLowerCase("cs-CZ") === label);
  const lastMth = prev?.mthEnd || (known && known.operating_hours != null ? String(known.operating_hours).replace(".", ",") : "");
  next.mthStart = lastMth;
  next.mthEnd = "";
  for (const field of ["customer", "site", "job"]) {
    if (!next[field] && records[0]?.[field]) next[field] = records[0][field];
  }
  return next;
}
