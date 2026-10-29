import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { DiaryAssistant } from "./DiaryAssistant";
import { createLocalAssistant } from "@/lib/localAssistant";
jest.mock("@/lib/localAssistant", () => ({ ...jest.requireActual("@/lib/localAssistant"), createLocalAssistant: jest.fn() }));
let root, el, model;
const apply = jest.fn();
const machines = [{ label: "L576/5" }];
const record = { id: "draft-1", date: "2026-10-28", billing: [{ start: "", end: "" }] };
async function click(selector) { await act(async () => el.querySelector(selector).click()); }
async function typeSource(text) {
  await act(async () => {
    const area = el.querySelector('[data-testid="assistant-source"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(area, text);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(navigator, "gpu", { configurable: true, value: {} });
  jest.clearAllMocks();
  model = { load: jest.fn(async () => {}), generate: jest.fn(async () => '{"site":"Struska","mthStart":"8440","mthEnd":"8446"}'), resume: jest.fn(), cancel: jest.fn(), dispose: jest.fn() };
  createLocalAssistant.mockReturnValue(model);
  el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
  await act(async () => root.render(<DiaryAssistant record={record} onApply={apply} machines={machines} />));
});
afterEach(async () => { await act(async () => root.unmount()); el.remove(); });
test("model is never downloaded on mount; inference only offers unchecked review fields", async () => {
  expect(createLocalAssistant).not.toHaveBeenCalled();
  await click('[data-testid="assistant-load"]');
  await typeSource("Pracoviště Struska, MTH 8440 až 8446");
  await click('[data-testid="assistant-generate"]');
  expect(model.generate).toHaveBeenCalledWith(expect.objectContaining({ source: "Pracoviště Struska, MTH 8440 až 8446" }));
  expect(apply).not.toHaveBeenCalled();
  expect(el.querySelector('[data-testid="assistant-check-site"]').checked).toBe(false);
  await click('[data-testid="assistant-check-site"]'); await click('[data-testid="assistant-apply"]');
  expect(apply).toHaveBeenCalledWith({ site: "Struska" });
});
test("late result after changing record cannot be applied", async () => {
  let resolve;
  model.generate.mockImplementation(() => new Promise(r => { resolve = r; }));
  await click('[data-testid="assistant-load"]'); await typeSource("Práce třídění"); await click('[data-testid="assistant-generate"]');
  await act(async () => root.render(<DiaryAssistant record={{ ...record, id: "other-draft" }} onApply={apply} machines={machines} />));
  await act(async () => resolve('{"work":"Třídění"}'));
  expect(el.querySelector('[data-testid="assistant-review"]')).toBeNull(); expect(apply).not.toHaveBeenCalled();
});
test("unsupported browser shows manual questions without initiating model load", async () => {
  Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
  await act(async () => root.render(<DiaryAssistant record={{ ...record }} onApply={apply} machines={machines} />));
  expect(el.querySelector('[data-testid="assistant-load"]').disabled).toBe(true);
  expect(el.textContent).toContain("Na kterém stroji"); expect(createLocalAssistant).not.toHaveBeenCalled();
});
test("a manual answer works without GPU and still requires explicit review before applying", async () => {
  Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
  await act(async () => root.render(<DiaryAssistant record={{ ...record, machine: "L576/5", site: "Stavba", billing: [{ start: "", end: "13:00" }] }} onApply={apply} machines={machines} />));
  await typeSource("7:00"); await click('[data-testid="assistant-manual"]');
  expect(createLocalAssistant).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled();
  expect(el.querySelector('[data-testid="assistant-check-start"]').checked).toBe(false);
  await click('[data-testid="assistant-check-start"]'); await click('[data-testid="assistant-apply"]');
  expect(apply).toHaveBeenCalledWith({ start: "07:00" });
});
test("receiving the original OCR photo previews it without starting a model or uploading", async () => {
  URL.createObjectURL = jest.fn(() => "blob:original-photo"); URL.revokeObjectURL = jest.fn();
  const file = new File(["photo"], "denik.jpg", { type: "image/jpeg" });
  await act(async () => root.render(<DiaryAssistant record={record} onApply={apply} machines={machines} photoRequest={{ file }} />));
  expect(el.querySelector('img').getAttribute("src")).toBe("blob:original-photo");
  expect(URL.createObjectURL).toHaveBeenCalledWith(file);
  expect(createLocalAssistant).not.toHaveBeenCalled(); expect(apply).not.toHaveBeenCalled();
  await act(async () => root.render(<DiaryAssistant record={{ ...record, id: "different" }} onApply={apply} machines={machines} />));
  expect(el.querySelector('img')).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:original-photo");
});
test("failure to acquire a GPU adapter is reported separately from a download failure", async () => {
  model.load.mockRejectedValue(Object.assign(new Error("no adapter"), { code: "GPU_ADAPTER_UNAVAILABLE" }));
  await click('[data-testid="assistant-load"]');
  expect(el.querySelector('[role="alert"]').textContent).toContain("neposkytl grafický adaptér");
  await typeSource("L576/5"); await click('[data-testid="assistant-manual"]');
  expect(el.querySelector('[data-testid="assistant-review"]')).not.toBeNull();
});
