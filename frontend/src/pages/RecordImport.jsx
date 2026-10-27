import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FileJson, ShieldCheck, AlertTriangle, Upload } from "lucide-react";
import { PageHeader } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { http, errText } from "@/lib/api";
import { newId } from "@/lib/format";

// All uploads are drafts owned by the logged-in user. No server-side bypass or delegation.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const FIELDS = ["customer", "site", "drive", "vehiclesTo", "vehiclesFrom", "accommodation"];
const minutes = (v) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
function intervalMinutes(rows) {
  if (!Array.isArray(rows)) return null;
  let result = 0;
  for (const r of rows) {
    if (!TIME.test(r.start || "") || !TIME.test(r.end || "")) return null;
    const a = minutes(r.start), b = minutes(r.end);
    result += b >= a ? b - a : b + 1440 - a;
  }
  return result;
}
function expectedMinutes(v) {
  if (!/^\d{1,3}:\d{2}$/.test(v || "")) return null;
  const [hours, mins] = v.split(":").map(Number);
  return mins < 60 ? hours * 60 + mins : null;
}
const recordKey = (r) => (r.date || "") + "|" + (r.machine || "").trim().toLowerCase();
function parseImport(doc, user) {
  if (!doc || !Array.isArray(doc.entries) || !doc.entries.length || doc.entries.length > 40) {
    throw new Error("Očekávám JSON s 1 až 40 záznamy v poli entries.");
  }
  if (!doc.ownerName || doc.ownerName.trim() !== user.name.trim()) {
    throw new Error("Soubor patří jinému uživateli. Záznamy lze importovat pouze pod vlastním účtem.");
  }
  const sources = doc.entries.filter(e => e.record).map(e => e.record);
  const common = {};
  if (sources.length) for (const field of FIELDS) {
    const values = sources.map(r => r[field]);
    if (values.every(v => v !== undefined && v !== null && v !== "" && v === values[0])) common[field] = values[0];
  }
  const seen = new Set();
  const rows = [];
  for (const e of doc.entries) {
    if (!DATE.test(e.date || "")) throw new Error("V souboru je neplatné datum.");
    const src = e.record || e.fieldsToUpdate;
    if (!src) continue; // Volno nebo jiný nepracovní den, nikdy nezakládat směnu.
    if (!src.machine || src.date !== e.date) throw new Error("Chybí stroj či datum: " + e.date);
    const row = { ...(e.record ? {} : common), ...src, id: newId(), date: e.date,
      operator: user.name, shift: src.shift || "Denní", workTimeMode: "shift",
      attachments: [], intervalService: false, dailyCheck: false,
      accessoryCheck: false, equipmentCheck: false, fit: "unknown",
      operatorSignature: "", handoverSignature: "", workshopSignature: "" };
    const key = recordKey(row);
    if (seen.has(key)) throw new Error("Duplicitní stroj/den v souboru: " + key);
    seen.add(key);
    const expected = expectedMinutes(e.netWork);
    const gross = intervalMinutes(row.billing || []);
    if (expected === null || gross === null) throw new Error("Nelze ověřit pracovní intervaly: " + e.date);
    const uncertain = expected !== gross;
    if (uncertain) {
      // Preserve documented net total, but never invent the position of a break.
      row.billing = [];
      row.service = [];
    }
    row.notes = [row.notes || "", "Zpětný import; doložená čistá doba: " + e.netWork + ".",
      uncertain ? "Pracovní úseky zatím nejsou převzaty: čistý a hrubý součet se liší o " + Math.abs(gross - expected) + " minut. Doplňte skutečné přestávky před potvrzením." : "",
      e.review || ""].filter(Boolean).join("\n");
    rows.push({ key, date: e.date, machine: row.machine, expected: e.netWork, uncertain, record: row });
  }
  if (!rows.length) throw new Error("Soubor neobsahuje pracovní záznamy.");
  return rows;
}
async function serverRecords(rows) {
  const dates = rows.map(r => r.date).sort();
  const { data } = await http.get("/records", { params: {
    mine: 1, date_from: dates[0], date_to: dates[dates.length - 1], limit: 2000
  } });
  if (!Array.isArray(data)) throw new Error("Nepodařilo se načíst aktuální serverové záznamy.");
  return data;
}

export default function RecordImport() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [existing, setExisting] = useState([]);
  const [result, setResult] = useState([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const onFile = async (event) => {
    const f = event.target.files?.[0];
    setRows([]); setExisting([]); setResult([]); setError("");
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setError("Maximální velikost souboru je 2 MB."); return; }
    setBusy(true);
    try {
      const parsed = parseImport(JSON.parse(await f.text()), user);
      setExisting(await serverRecords(parsed)); setRows(parsed); setFilename(f.name);
    } catch (e) { setError(e.response ? errText(e) : e.message); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setError("");
    const done = [];
    try {
      for (const row of rows) {
        const fresh = await serverRecords(rows); // no stale preview decisions
        if (fresh.some(r => recordKey(r) === row.key)) {
          done.push({ ...row, status: "Již existuje – přeskočeno" });
          setResult([...done]); continue;
        }
        const { data } = await http.put("/records/" + row.record.id, {
          opId: newId(), baseRevision: 0, confirm: false,
          record: row.record, deviceSavedAt: new Date().toISOString()
        });
        const saved = data?.record;
        if (data.status !== "saved" || !saved || saved.owner_id !== user.id ||
            saved.status !== "draft" || recordKey(saved) !== row.key) {
          throw new Error("Uložení " + row.date + " nebylo ověřeno. Zastavuji kvůli ochraně před duplicitami.");
        }
        done.push({ ...row, status: "Koncept uložen", id: saved.id });
        setResult([...done]);
      }
      setExisting(await serverRecords(rows));
    } catch (e) { setError(e.response ? errText(e) : e.message); }
    finally { setResult([...done]); setBusy(false); }
  };
  const remaining = rows.filter(r => !existing.some(v => recordKey(v) === r.key)).length;
  return <div className="space-y-4" data-testid="records-import-page">
    <PageHeader title="Import deníků z JSON" subtitle="Zpětný import pouze pod vlastním účtem, vždy jako koncept." />
    <Link to="/zapisy" className="text-sm font-semibold underline">Zpět na moje zápisy</Link>
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 font-semibold"><FileJson className="h-5 w-5"/>Import ze souboru v telefonu či na Google Drivu</div>
      <input type="file" accept=".json,application/json" onChange={onFile} disabled={busy}
        aria-label="Vybrat JSON pro import" data-testid="records-import-file" className="block w-full rounded-lg border border-slate-200 p-3"/>
      <p className="flex gap-2 text-sm text-slate-700"><ShieldCheck className="h-5 w-5 shrink-0"/>Účet: {user.name}. Existující zápisy se nikdy nepřepisují. Import nepotvrzuje podpisy, kontroly ani přílohy.</p>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!!rows.length && <>
        <h2 className="font-semibold">Náhled souboru {filename}</h2>
        <div className="space-y-2">{rows.map(r => {
          const duplicate = existing.some(v => recordKey(v) === r.key);
          return <div key={r.key} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="font-semibold">{r.date} · {r.machine} · výkaz {r.expected} h</div>
            <div>{duplicate ? "Již uložen – přeskočit" : "Připraven pouze koncept"}</div>
            {r.uncertain && <div className="flex gap-2 text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Přestávka nebyla doložena. Pracovní intervaly zůstanou prázdné pro kontrolu.</div>}
          </div>;
        })}</div>
        <Button className="btn-primary min-h-12 w-full font-semibold" onClick={save}
          disabled={busy || !remaining || !!result.length} data-testid="records-import-submit">
          <Upload className="mr-2 h-4 w-4"/>Uložit {remaining} konceptů na server
        </Button>
      </>}
      {!!result.length && <div role="status" className="rounded-lg border border-slate-200 p-3 text-sm space-y-1">
        <h2 className="font-semibold">Výsledek</h2>
        {result.map(r => <p key={r.key}>{r.date} · {r.machine}: {r.status}{r.id ? " · ID " + r.id : ""}</p>)}
        <Link to="/zapisy" className="font-semibold underline">Otevřít moje zápisy</Link>
      </div>}
    </section>
  </div>;
}
