import React, { useState } from "react";
import { Link } from "react-router-dom";
import { DiaryAssistant } from "@/components/DiaryAssistant";
import { useLanguage, LanguageSelect } from "@/lib/language";

const machines = [{ label: "Nakladač / DEMO 01", active: true }];
// This standalone trial has no record API, persistence or production identity.
export default function AssistantDemo() {
  const { language } = useLanguage();
  const uk = language === "uk";
  const [record, setRecord] = useState({ id: "local-ai-demo", date: "", machine: "", site: "", work: "", mthStart: "", mthEnd: "", billing: [{ start: "", end: "" }] });
  const apply = ({ start, end, ...fields }) => setRecord(r => ({ ...r, ...fields,
    ...((start !== undefined || end !== undefined) ? { billing: [{ ...r.billing[0], ...(start !== undefined ? { start } : {}), ...(end !== undefined ? { end } : {}) }] } : {}),
  }));
  return <main className="mx-auto max-w-2xl space-y-4 p-4" data-testid="assistant-demo">
    <header className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">DEMSTAV · AI DEMO</h1><LanguageSelect /></header>
    <p className="rounded-lg bg-amber-100 p-3 text-sm">{uk ? "Тест локального ШІ з вигаданими даними. Нічого не надсилається в журнал компанії й не зберігається після закриття сторінки." : "Zkouška místní AI s fiktivními údaji. Nic se neposílá do firemního deníku a po zavření stránky se ukázka neuchovává."}</p>
    <p className="text-sm">{uk ? "Příklad / Приклад:" : "Příklad:"} Datum 15. 4. 2030, stroj Nakladač / DEMO 01, pracoviště Ukázková stavba, směna 06:00–15:00, MTH 2500 až 2506, nakládka materiálu.</p>
    <DiaryAssistant record={record} onApply={apply} machines={machines} />
    <details className="rounded-lg border bg-white p-3"><summary className="font-semibold">{uk ? "Дані локальної чернетки" : "Údaje místního konceptu"}</summary><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(record, null, 2)}</pre></details>
    <Link to="/" className="inline-block min-h-11 py-2 underline">{uk ? "Відкрити застосунок" : "Otevřít aplikaci"}</Link>
  </main>;
}
