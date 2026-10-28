import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";

export function MachineFilter({ value, onChange, options }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [browse, setBrowse] = useState(false);
  const matches = options.filter((label) => browse || label.toLocaleLowerCase("cs").includes(value.toLocaleLowerCase("cs")));
  const choices = ["", ...matches];
  const choose = (label) => { onChange(label); setOpen(false); setActive(0); };
  return <div className="relative min-w-0" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <div className="relative">
      <Input value={value} placeholder="Všechny stroje" className="h-11 pr-11" aria-label="Stroj" role="combobox" aria-expanded={open} aria-autocomplete="list" aria-controls={id} aria-activedescendant={open ? `${id}-${active}` : undefined} data-testid="records-filter-machine"
        onFocus={() => { setOpen(true); setBrowse(true); setActive(0); }}
        onChange={(e) => { onChange(e.target.value); setBrowse(false); setOpen(true); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); const next = open ? Math.max(0, Math.min(choices.length - 1, active + (e.key === "ArrowDown" ? 1 : -1))) : 0; setActive(next); document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: "nearest" }); }
          if (e.key === "Enter" && open) { e.preventDefault(); choose(choices[active] ?? ""); }
        }} />
      <button type="button" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center" aria-label="Zobrazit nabídku strojů" aria-expanded={open} onClick={() => { setBrowse(true); setActive(0); setOpen(!open); }}><ChevronDown className="h-4 w-4" /></button>
    </div>
    {open && <div id={id} role="listbox" aria-label="Stroje" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-md border border-slate-200 bg-white p-1 shadow-lg">
      {choices.map((label, i) => <button key={label} id={`${id}-${i}`} type="button" role="option" aria-selected={value === label} onPointerDown={(e) => e.preventDefault()} onClick={() => choose(label)} className={`block min-h-11 w-full break-words rounded px-3 py-2 text-left text-sm ${active === i ? "bg-slate-100" : "hover:bg-slate-100"}`}>{label || "Všechny stroje"}</button>)}
      {!matches.length && <p className="px-3 py-2 text-sm text-slate-600">Žádný odpovídající stroj.</p>}
    </div>}
  </div>;
}
