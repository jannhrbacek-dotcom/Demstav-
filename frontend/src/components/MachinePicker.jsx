import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { useLanguage } from "@/lib/language";

const norm = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("cs-CZ").trim();

export function matchMachines(items, query) {
  const q = norm(query);
  if (!q) return items;
  return items.filter(m => [m.label, m.type, m.manufacturer, m.internal_number, m.serial_number]
    .some(v => norm(v).includes(q)));
}

/** Searchable, keyboard accessible, mobile-friendly machine choice; stores canonical machine label only. */
export default function MachinePicker({ machines = [], value = "", onChange }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapper = useRef(null);
  const inputRef = useRef(null);
  const options = useMemo(() => matchMachines(machines, query), [machines, query]);
  const selected = machines.find(m => m.label === value);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (wrapper.current && !wrapper.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const pick = (machine) => {
    onChange(machine.label);
    setQuery("");
    setOpen(false);
    setHighlight(0);
    inputRef.current?.focus();
  };
  const keys = (event) => {
    if (event.key === "Escape") { setOpen(false); setQuery(""); return; }
    if (!open && ["Enter", "ArrowDown"].includes(event.key)) { event.preventDefault(); setOpen(true); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setHighlight(i => Math.min(i + 1, options.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setHighlight(i => Math.max(0, i - 1)); }
    if (event.key === "Enter" && options.length) { event.preventDefault(); pick(options[Math.max(0, highlight)]); }
  };
  return <div ref={wrapper} className="relative" data-testid="record-machine-picker">
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute left-3 h-5 w-5 text-slate-500" />
      <input ref={inputRef} type="search" value={open ? query : (selected?.label || value)}
        onFocus={() => { setOpen(true); setQuery(""); setHighlight(0); }}
        onChange={e => { setQuery(e.target.value); setHighlight(0); setOpen(true); }}
        onKeyDown={keys}
        onClick={() => setOpen(true)}
        aria-label={t("Vyhledat stroj podle názvu nebo čísla")}
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="machine-options"
        placeholder={t("Napište typ nebo číslo stroje…")}
        className="h-14 w-full min-w-0 rounded-lg border border-slate-300 bg-white pl-11 pr-12 text-base font-semibold text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
        data-testid="record-machine-select" />
      <button type="button" aria-label={t("Zobrazit nabídku strojů")} onClick={() => { setOpen(v => !v); setQuery(""); setHighlight(0); inputRef.current?.focus(); }}
        className="absolute right-1 flex h-12 w-11 items-center justify-center rounded-lg text-slate-600">
        <ChevronDown className="h-5 w-5"/>
      </button>
    </div>
    {open && <div id="machine-options" role="listbox" aria-label={t("Dostupné stroje")}
      className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-slate-300 bg-white p-1 shadow-xl">
      {options.length ? options.map((m, index) => (
        <button key={m.id} role="option" aria-selected={m.label === value} type="button"
          data-testid={`machine-option-${m.id}`}
          onMouseDown={e => e.preventDefault()}
          onMouseEnter={() => setHighlight(index)}
          onClick={() => pick(m)}
          className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${highlight === index ? "bg-amber-100" : "hover:bg-slate-100"}`}>
          <span className="min-w-0"><strong className="block text-base">{m.label}</strong>
            <small className="block truncate text-xs text-slate-600">{[m.manufacturer, m.type, m.internal_number && `${t("Číslo")} ${m.internal_number}`].filter(Boolean).join(" · ")}</small>
          </span>{m.label === value && <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-700"/>}
        </button>
      )) : <p className="p-3 text-sm text-slate-600">{t("Žádný odpovídající stroj. Zkuste jiné číslo nebo název.")}</p>}
    </div>}
  </div>;
}
