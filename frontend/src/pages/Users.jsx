import React, { useState } from "react";
import { toast } from "sonner";
import { UserPlus, KeyRound, ShieldCheck, Ban, RotateCcw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Field } from "@/components/Section";
import { useAuth, atLeast } from "@/lib/auth";
import { useCached } from "@/lib/data";
import { http, errText } from "@/lib/api";
import { ROLE_LABELS, dateTime } from "@/lib/format";
import { ROLE_INFO, POSITIONS, positionLabel } from "@/lib/roles";
import { useLanguage } from "@/lib/language";

const canManage = (actor, role) => (["owner", "operations_manager"].includes(actor.role) ? role !== "owner" : actor.role === "admin" ? ["employee", "manager"].includes(role) : false);

function Workplaces({ value, onChange, wps }) {
  const { t } = useLanguage();
  return <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">{(wps || []).length === 0 && <div className="text-sm text-slate-600">{t("Zatím žádná pracoviště.")}</div>}
    {(wps || []).map((w) => <label key={w.id} className="flex min-h-[40px] items-center gap-2"><Checkbox checked={value.includes(w.id)} onCheckedChange={(v) => onChange(v ? [...value, w.id] : value.filter((x) => x !== w.id))} />{w.name}</label>)}</div>;
}

export default function UsersPage() {
  const { t } = useLanguage();
  const { user: me } = useAuth();
  const q = useCached("/users");
  const wps = useCached("/workplaces?all=1");
  const [create, setCreate] = useState(null);
  const [edit, setEdit] = useState(null);
  const [secret, setSecret] = useState(null);
  const admin = atLeast(me, "admin");
  const roles = Object.keys(ROLE_LABELS).filter((r) => canManage(me, r));

  const doCreate = async () => {
    try { const { data } = await http.post("/users", create); setCreate(null); setSecret({ name: data.user.name, email: data.user.email, username: data.user.username, pw: data.temporary_password }); q.reload(); } catch (e) { toast.error(errText(e)); }
  };
  const patch = async (u, body, msg) => { try { await http.patch(`/users/${u.id}`, body); toast.success(msg); q.reload(); setEdit(null); } catch (e) { toast.error(errText(e)); } };
  const reset = async (u) => { if (!window.confirm(`Vygenerovat nové dočasné heslo pro ${u.name}? Současné přihlášení bude zneplatněno.`)) return; try { const { data } = await http.post(`/users/${u.id}/reset-password`); setSecret({ name: u.name, email: u.email, pw: data.temporary_password }); } catch (e) { toast.error(errText(e)); } };

  return (
    <div className="space-y-4">
      <PageHeader title="Uživatelé a přístupy" subtitle="Správce založí účet s dočasným heslem; při prvním přihlášení je změna hesla povinná. Deaktivace zachová historii."
        actions={admin && <Button className="btn-primary h-12 font-semibold" onClick={() => setCreate({ name: "", email: "", username: "", role: "employee", position: "strojnik", workplace_ids: [] })} data-testid="user-create-button"><UserPlus className="mr-1 h-5 w-5" />{t("Nový uživatel")}</Button>} />
      <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="roles-info">
        <summary className="cursor-pointer font-heading font-semibold">{t("Role a oprávnění")}</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">{ROLE_INFO.map((r) => (
          <div key={r.role} className="rounded-lg border border-slate-200 p-3" data-testid={`role-info-${r.role}`}><div className="font-semibold">{r.label}</div><ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">{r.rights.map((x) => <li key={x}>{x}</li>)}</ul></div>
        ))}</div>
      </details>
      <div className="space-y-2">{(q.data || []).map((u) => {
        const manageable = canManage(me, u.role) && u.id !== me.id;
        return (
          <div key={u.id} className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm ${u.active ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50"}`} data-testid="user-item">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 font-semibold">{u.name}{u.protected && <span className="flex items-center gap-1 rounded bg-black px-2 py-0.5 text-xs text-[#FFD200]"><ShieldCheck className="h-3.5 w-3.5" />{t("chráněný jednatel")}</span>}{!u.active && <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-900" data-testid="user-inactive-badge">deaktivován {dateTime(u.deactivated_at)}</span>}{u.must_change_password && u.active && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{t("čeká na změnu hesla")}</span>}</div>
              <div className="text-sm text-slate-600">{u.username && <b className="font-mono">{u.username}</b>}{u.username && " · "}{u.email || "bez e-mailu"} · <span data-testid="user-role-label">{u.role === "employee" ? positionLabel(u.position) : ROLE_LABELS[u.role]}</span> · pracoviště: {u.workplace_ids.length ? u.workplace_ids.map((id) => (wps.data || []).find((w) => w.id === id)?.name).filter(Boolean).join(", ") : "všechna aktivní"}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(manageable || (me.role === "manager" && u.role === "employee")) && <Button variant="outline" className="h-10" onClick={() => setEdit({ ...u })} data-testid="user-edit-button">Upravit</Button>}
              {manageable && admin && <Button variant="outline" className="h-10" onClick={() => reset(u)} data-testid="user-reset-button"><KeyRound className="mr-1 h-4 w-4" />Reset hesla</Button>}
              {manageable && admin && (u.active ? <Button variant="outline" className="h-10 text-red-700" onClick={() => window.confirm(`Deaktivovat ${u.name}? Přihlášení okamžitě přestane platit, historie zůstane.`) && patch(u, { active: false }, "Účet deaktivován")} data-testid="user-deactivate-button"><Ban className="mr-1 h-4 w-4" />Deaktivovat</Button>
                : <Button variant="outline" className="h-10" onClick={() => patch(u, { active: true }, "Účet aktivován")} data-testid="user-activate-button"><RotateCcw className="mr-1 h-4 w-4" />Aktivovat</Button>)}
            </div>
          </div>);
      })}</div>
      <p className="text-xs text-slate-600">{t("Ochrana účtu vlastníka platí v aplikaci; nechrání proti osobě s přímým přístupem k serveru či databázi.")}</p>

      <Dialog open={!!create} onOpenChange={(o) => !o && setCreate(null)}>
        <DialogContent className="max-w-md" data-testid="user-create-dialog">
          <DialogHeader><DialogTitle className="font-heading">{t("Nový uživatel")}</DialogTitle><DialogDescription>{t("Dočasné heslo se zobrazí jednou – předejte ho osobně.")}</DialogDescription></DialogHeader>
          {create && <div className="space-y-3">
            <Field label="Jméno a příjmení"><Input value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} className="h-12" data-testid="user-name-input" /></Field>
            <Field label="E-mail (nepovinný)"><Input type="email" value={create.email} onChange={(e) => setCreate({ ...create, email: e.target.value })} className="h-12" data-testid="user-email-input" /></Field>
            <Field label="Přihlašovací jméno (povinné bez e-mailu)" hint="Malá písmena bez diakritiky, např. jan.novak. E-mail není nutný; přihlášení funguje uživatelským jménem."><Input value={create.username} onChange={(e) => setCreate({ ...create, username: e.target.value.toLowerCase().replace(/\s/g, "") })} className="h-12" data-testid="user-username-input" /></Field>
            <Field label="Role"><Select value={create.role} onValueChange={(v) => setCreate({ ...create, role: v })}><SelectTrigger className="h-12" data-testid="user-role-select"><SelectValue /></SelectTrigger><SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent></Select></Field>
            {create.role === "employee" && <Field label="Pracovní zařazení"><Select value={create.position} onValueChange={(v) => setCreate({ ...create, position: v })}><SelectTrigger className="h-12" data-testid="user-position-select"><SelectValue /></SelectTrigger><SelectContent>{POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></Field>}
            <Field label="Přiřazená pracoviště" hint="Bez výběru vidí zaměstnanec všechna aktivní pracoviště."><Workplaces value={create.workplace_ids} onChange={(v) => setCreate({ ...create, workplace_ids: v })} wps={wps.data} /></Field>
          </div>}
          <DialogFooter><Button className="btn-primary h-12 w-full font-semibold" onClick={doCreate} data-testid="user-create-submit">{t("Založit účet")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md" data-testid="user-edit-dialog">
          <DialogHeader><DialogTitle className="font-heading">Upravit – {edit?.name}</DialogTitle><DialogDescription>{edit?.email}</DialogDescription></DialogHeader>
          {edit && <div className="space-y-3">
            {admin && <Field label="Jméno"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="h-12" data-testid="user-edit-name-input" /></Field>}
            {admin && <Field label="Přihlašovací jméno"><Input value={edit.username || ""} onChange={(e) => setEdit({ ...edit, username: e.target.value.toLowerCase().replace(/\s/g, "") })} className="h-12" data-testid="user-edit-username-input" /></Field>}
            {admin && edit.role === "employee" && <Field label="Pracovní zařazení"><Select value={edit.position || "strojnik"} onValueChange={(v) => setEdit({ ...edit, position: v })}><SelectTrigger className="h-12" data-testid="user-edit-position-select"><SelectValue /></SelectTrigger><SelectContent>{POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></Field>}
            {admin && <Field label="Role"><Select value={edit.role} onValueChange={(v) => setEdit({ ...edit, role: v })}><SelectTrigger className="h-12" data-testid="user-edit-role-select"><SelectValue /></SelectTrigger><SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent></Select></Field>}
            <Field label="Přiřazená pracoviště"><Workplaces value={edit.workplace_ids} onChange={(v) => setEdit({ ...edit, workplace_ids: v })} wps={wps.data} /></Field>
          </div>}
          <DialogFooter><Button className="btn-primary h-12 w-full font-semibold" onClick={() => patch(edit, admin ? { name: edit.name, role: edit.role, workplace_ids: edit.workplace_ids, ...(edit.username ? { username: edit.username } : {}), ...(edit.role === "employee" ? { position: edit.position || "strojnik" } : {}) } : { workplace_ids: edit.workplace_ids }, "Uloženo")} data-testid="user-edit-submit">{t("Uložit")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!secret} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent className="max-w-md" data-testid="temp-password-dialog">
          <DialogHeader><DialogTitle className="font-heading">Dočasné heslo – {secret?.name}</DialogTitle><DialogDescription>Zobrazí se pouze nyní. Při prvním přihlášení (jméno {secret?.username || secret?.email}) si ho zaměstnanec musí změnit.</DialogDescription></DialogHeader>
          <div className="flex items-center gap-2"><code className="flex-1 rounded-lg bg-slate-900 px-4 py-3 text-center font-mono text-2xl tracking-widest text-[#FFD200]" data-testid="temp-password-value">{secret?.pw}</code>
            <Button variant="outline" className="h-12" onClick={() => { navigator.clipboard?.writeText(secret.pw); toast.success("Zkopírováno"); }} data-testid="temp-password-copy"><Copy className="h-4 w-4" /></Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
