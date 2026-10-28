import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/lib/language";
import Layout from "@/components/Layout";
import Today from "@/pages/Today";
import RecordForm from "@/pages/RecordForm";
import Records from "@/pages/Records";
import Attendance from "@/pages/Attendance";
import Guide from "@/pages/Guide";
import Login from "@/pages/Login";
import { DEMO_NOW } from "./fixtures";

// The documentation copy is deliberately isolated from App.js, AuthProvider,
// service workers, IndexedDB and all live APIs. No account session is read.
const RealDate = Date;
class DemoDate extends RealDate { constructor(...args) { super(...(args.length ? args : [DEMO_NOW])); } static now() { return new RealDate(DEMO_NOW).getTime(); } }
window.Date = DemoDate;
window.fetch = async () => { throw new Error("Síť je v dokumentační ukázce vypnutá."); };
const params = new URLSearchParams(window.location.search);
const screens = { today: "/dnes", record: "/zapis/novy", records: "/zapisy", attendance: "/dochazka", guide: "/jak-na-to", login: "/login" };
const screen = Object.hasOwn(screens, params.get("screen")) ? params.get("screen") : "today";
const content = <Routes><Route path="/dnes" element={<Today />} /><Route path="/zapis/novy" element={<RecordForm />} /><Route path="/zapisy" element={<Records />} /><Route path="/dochazka" element={<Attendance />} /><Route path="/jak-na-to" element={<Guide />} /><Route path="/login" element={<Login />} /></Routes>;
function Demo() {
  return <LanguageProvider><MemoryRouter initialEntries={[screens[screen]]}>
    <aside className="demo-banner" role="note"><strong>DEMO · UKÁZKOVÁ DATA</strong><span>Skutečné obrazovky aplikace, pouze ke čtení. Fiktivní datum 15. 4. 2030. Nic se neukládá.</span></aside>
    <nav className="demo-navigation" aria-label="Dokumentační obrazovky">{Object.keys(screens).map(key => <a key={key} href={`?screen=${key}`} aria-current={screen === key ? "page" : undefined}>{({ today: "Dnes", record: "Denní zápis", records: "Historie", attendance: "Docházka", guide: "Jak na to", login: "Přihlášení" })[key]}</a>)}</nav>
    <div inert={true} data-testid="documentation-readonly">{screen === "login" ? content : <Layout>{content}</Layout>}</div>
  </MemoryRouter></LanguageProvider>;
}
createRoot(document.getElementById("root")).render(<Demo />);
