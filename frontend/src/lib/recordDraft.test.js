import React, {act} from "react";
import {createRoot} from "react-dom/client";
import {useRecordDraft} from "./recordDraft";
const mockStore = new Map();
let mockWriteFailure = false;
jest.mock("idb-keyval", () => ({
  get: async key => mockStore.get(key),
  set: async (key, value) => {if (mockWriteFailure) throw new Error("quota"); mockStore.set(key, value);},
  del: async key => mockStore.delete(key),
}));
let root, el, current;
function Harness({draftKey, record}) {
  current = useRecordDraft(draftKey, record, 7);
  return <p>{current.error || (current.loaded ? "ready" : "loading")}</p>;
}
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockWriteFailure = false;
  el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
});
afterEach(() => {act(() => root.unmount()); el.remove();});
test("draft survives remount and stays account-specific with original base revision", async () => {
  await act(async () => {root.render(<Harness draftKey="u:A:draft1" record={{id: "one", work: "Text", service: [{start: "11:00", end: "12:00"}]}} />);});
  expect(mockStore.get("u:A:draft1").baseRevision).toBe(7);
  act(() => root.unmount()); root = createRoot(el);
  await act(async () => {root.render(<Harness draftKey="u:A:draft1" record={null} />);});
  expect(current.value.record.work).toBe("Text");
  expect(current.value.record.service).toHaveLength(1);
  await act(async () => {root.render(<Harness draftKey="u:B:draft1" record={null} />);});
  expect(current.value).toBeNull();
});
test("clear cannot be resurrected by an older autosave; storage failure is visible", async () => {
  await act(async () => {root.render(<Harness draftKey="u:A:draft2" record={{id: "two", work: "Text"}} />);});
  await act(async () => {await current.clear();});
  expect(mockStore.has("u:A:draft2")).toBe(false);
  mockWriteFailure = true;
  await act(async () => {root.render(<Harness draftKey="u:A:draft3" record={{id: "three", work: "Text"}} />);});
  expect(el.textContent).toContain("nepodařilo uložit");
});
