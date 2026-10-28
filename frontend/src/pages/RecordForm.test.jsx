import React, {act} from "react";
import {createRoot} from "react-dom/client";
import RecordForm from "./RecordForm";
const mockSave = jest.fn(async () => {});
jest.mock("react-router-dom", () => ({useParams: () => ({}), useNavigate: () => () => {}, Link: ({children}) => <span>{children}</span>}));
jest.mock("@/lib/auth", () => ({useAuth: () => ({user: {id: "test", name: "Test employee", role: "employee"}})}));
const mockSync = {records: {}, queue: [], ready: true};
jest.mock("@/lib/sync", () => ({useSync: () => mockSync, saveRecordLocal: (...args) => mockSave(...args)}));
jest.mock("@/lib/data", () => ({useCached: () => ({data: [], loading: false}), mergedRecords: () => []}));
jest.mock("@/lib/api", () => ({http: {get: async () => ({data: []})}}));
jest.mock("@/components/BreakRequests", () => () => null);
jest.mock("@/components/DiaryAssistant", () => ({ DiaryAssistant: ({ onApply }) => <button data-testid="test-proposal" onClick={() => onApply({ machine: "DEMO-new", start: "07:00" })}>Návrh</button> }));
jest.mock("@/components/DictateTextarea", () => ({DictateTextarea: ({value, onChange, testid}) => <textarea value={value} onChange={e => onChange(e.target.value)} data-testid={testid} />}));
const mockRecord = {id: "draft-1", date: "2026-10-28", revision: 0, shift: "Denní", operator: "Test employee",
  machine: "TEST-2", customer: "", site: "Test site", job: "", drive: "", crew: "", vehiclesTo: "", vehiclesFrom: "", accommodation: "",
  billing: [{start: "06:00", end: "17:00"}], service: [{start: "11:00", end: "12:00"}], travel: [], downtime: [],
  serviceDescription: "Zachovaný servis", serviceBy: "operator", repairDescription: "", intervalService: false,
  work: "Práce", mthStart: "14000", mthEnd: "14002", notes: "", faults: [], attachments: [], fit: "unknown"};
jest.mock("@/lib/recordDraft", () => ({useRecordDraft: () => ({loaded: true, value: {record: mockRecord, baseRevision: 0}, clear: async () => {}, savedAt: "now"})}));
test("essential fields precede service; hiding sections preserves data on save", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.scrollTo = () => {};
  const el = document.createElement("div"); document.body.appendChild(el); const root = createRoot(el);
  await act(async () => {root.render(<RecordForm />);});
  const sections = [...el.querySelectorAll("section[data-testid]")].map(s => s.dataset.testid);
  expect(sections.slice(0, 3)).toEqual(["section-basic", "section-time", "section-mth"]);
  expect(el.querySelector('[data-testid="record-additional-toggle"]').getAttribute("aria-expanded")).toBe("false");
  const service = el.querySelector('[data-testid="section-service-gate-toggle"]');
  act(() => service.click()); act(() => service.click());
  await act(async () => {el.querySelector('[data-testid="record-save-draft-button"]').click();});
  expect(mockSave).toHaveBeenCalled();
  expect(mockSave.mock.calls[0][0].serviceDescription).toBe("Zachovaný servis");
  expect(mockSave.mock.calls[0][0].service).toHaveLength(1);
  act(() => root.unmount()); el.remove();
});

test("a reviewed proposal preserves other shift sections and clears MTH from a different machine", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.scrollTo = () => {};
  const el = document.createElement("div"); document.body.appendChild(el); const root = createRoot(el);
  await act(async () => root.render(<RecordForm />));
  await act(async () => {
    const panel = el.querySelector('[data-testid="record-ai-panel"]');
    panel.open = true; panel.dispatchEvent(new Event("toggle"));
  });
  await act(async () => el.querySelector('[data-testid="test-proposal"]').click());
  await act(async () => el.querySelector('[data-testid="record-save-draft-button"]').click());
  const saved = mockSave.mock.calls.at(-1)[0];
  expect(saved.machine).toBe("DEMO-new");
  expect(saved.mthStart).toBe(""); expect(saved.mthEnd).toBe("");
  expect(saved.billing).toEqual([{ start: "07:00", end: "17:00" }]);
  expect(saved.service).toEqual([{ start: "11:00", end: "12:00" }]);
  await act(async () => root.unmount()); el.remove();
});
