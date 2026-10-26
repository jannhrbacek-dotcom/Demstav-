import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export function Section({ title, subtitle, children, defaultOpen = true, testid, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" data-testid={testid}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left" data-testid={testid ? `${testid}-toggle` : undefined}>
        <div><div className="font-heading text-base font-semibold text-slate-900">{title}</div>{subtitle && <div className="text-xs text-slate-600">{subtitle}</div>}</div>
        <div className="flex items-center gap-2">{badge}<ChevronDown className={`h-5 w-5 text-slate-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`} /></div>
      </button>
      {open && <div className="space-y-4 border-t border-slate-100 px-4 pb-5 pt-4">{children}</div>}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, error }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-slate-600">{hint}</span>}
      {error && <span className="block text-xs font-medium text-red-700">{error}</span>}
    </label>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center" data-testid="empty-state">
      {Icon && <Icon className="mx-auto mb-3 h-10 w-10 text-slate-400" />}
      <div className="font-heading text-lg font-semibold text-slate-900">{title}</div>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
