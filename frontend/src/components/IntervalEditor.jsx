import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export function IntervalEditor({ label, hint, items, onChange, testid }) {
  const upd = (i, k, v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  return (
    <div className="space-y-2" data-testid={testid}>
      <div><div className="text-sm font-semibold text-slate-900">{label}</div>{hint && <div className="text-xs text-slate-600">{hint}</div>}</div>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input type="time" value={it.start} onChange={(e) => upd(i, "start", e.target.value)} className="h-12 w-32 text-base" data-testid={`${testid}-start-${i}`} aria-label="Od" />
          <span className="text-slate-500">–</span>
          <Input type="time" value={it.end} onChange={(e) => upd(i, "end", e.target.value)} className="h-12 w-32 text-base" data-testid={`${testid}-end-${i}`} aria-label="Do" />
          <Button type="button" variant="ghost" size="icon" className="h-12 w-12" onClick={() => onChange(items.filter((_, j) => j !== i))} data-testid={`${testid}-remove-${i}`} aria-label="Odebrat úsek"><Trash2 className="h-5 w-5" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" className="h-11" onClick={() => onChange([...items, { start: "", end: "" }])} data-testid={`${testid}-add`}><Plus className="mr-1 h-4 w-4" />Přidat úsek</Button>
    </div>
  );
}
