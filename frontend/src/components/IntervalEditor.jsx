import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export function IntervalEditor({ label, hint, items, onChange, testid, withRoute = false, places = [] }) {
  const upd = (i, k, v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  return (
    <div className="space-y-2" data-testid={testid}>
      <div><div className="text-sm font-semibold text-slate-900">{label}</div>{hint && <div className="text-xs text-slate-600">{hint}</div>}</div>
      {items.map((it, i) => (
        <div key={i} className={withRoute ? "space-y-2 rounded-lg border border-slate-200 p-2" : ""}>
        {withRoute && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input list={`${testid}-places`} value={it.from || ""} onChange={(e) => upd(i, "from", e.target.value)} placeholder="Odkud (bod A)" className="h-12" data-testid={`${testid}-from-${i}`} aria-label="Odkud" />
            <Input list={`${testid}-places`} value={it.to || ""} onChange={(e) => upd(i, "to", e.target.value)} placeholder="Kam (bod B)" className="h-12" data-testid={`${testid}-to-${i}`} aria-label="Kam" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input type="time" value={it.start} onChange={(e) => upd(i, "start", e.target.value)} className="h-12 w-32 text-base" data-testid={`${testid}-start-${i}`} aria-label="Od" />
          <span className="text-slate-500">–</span>
          <Input type="time" value={it.end} onChange={(e) => upd(i, "end", e.target.value)} className="h-12 w-32 text-base" data-testid={`${testid}-end-${i}`} aria-label="Do" />
          <Button type="button" variant="ghost" size="icon" className="h-12 w-12" onClick={() => onChange(items.filter((_, j) => j !== i))} data-testid={`${testid}-remove-${i}`} aria-label="Odebrat úsek"><Trash2 className="h-5 w-5" /></Button>
        </div>
        </div>
      ))}
      {withRoute && <datalist id={`${testid}-places`}>{places.map((p) => <option key={p} value={p} />)}</datalist>}
      <Button type="button" variant="outline" className="h-11" onClick={() => onChange([...items, withRoute ? { start: "", end: "", from: items[items.length - 1]?.to || "", to: "" } : { start: "", end: "" }])} data-testid={`${testid}-add`}><Plus className="mr-1 h-4 w-4" />Přidat úsek</Button>
    </div>
  );
}
