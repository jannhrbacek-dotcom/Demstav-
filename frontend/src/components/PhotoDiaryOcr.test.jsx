import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { PhotoDiaryOcr } from "./PhotoDiaryOcr";
import { http } from "@/lib/api";

jest.mock("@/lib/api", () => ({ http: { post: jest.fn() }, errText: () => "Přepis se nezdařil." }));
let root, el;
const attach = jest.fn(async () => ({}));
const apply = jest.fn();
const record = { date: "2026-10-28", machine: "L566/3", work: "", billing: [{ start: "", end: "" }] };

beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  el = document.createElement("div"); document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => root.render(<PhotoDiaryOcr record={record} onAttach={attach} onApply={apply} />));
});

test("an OCR response arriving after a record change cannot offer the previous record's photo or values", async () => {
  let resolve;
  http.post.mockImplementation(() => new Promise(r => { resolve = r; }));
  const useAI = jest.fn();
  await act(async () => root.render(<PhotoDiaryOcr record={{ id: "first" }} onAttach={attach} onApply={apply} onUseLocalAI={useAI} />));
  const input = el.querySelector('[data-testid="ocr-gallery-input"]');
  await act(async () => {
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["sample"], "old.jpg", { type: "image/jpeg" })] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => root.render(<PhotoDiaryOcr record={{ id: "second" }} onAttach={attach} onApply={apply} onUseLocalAI={useAI} />));
  await act(async () => resolve({ data: { text: "MTH: old", fields: [{ key: "mthEnd", label: "MTH konec", value: "11778" }] } }));
  expect(el.querySelector('[data-testid="ocr-review"]')).toBeNull();
  expect(el.querySelector('[data-testid="ocr-use-local-ai"]')).toBeNull();
  expect(el.textContent).not.toContain("old.jpg");
  expect(apply).not.toHaveBeenCalled();
});
afterEach(async () => { await act(async () => root.unmount()); el.remove(); });

test("photo is attached but OCR never saves any entry without human review", async () => {
  http.post.mockResolvedValue({ data: {
    text: "Datum: 28.10.2026\nProvedená práce: Třídění",
    fields: [{ key: "date", label: "Datum", value: "2026-10-28" },
             { key: "work", label: "Provedená práce", value: "Třídění" }],
    warning: "Zkontrolujte návrh",
  } });
  const file = new File(["sample"], "denik.jpg", { type: "image/jpeg" });
  const input = el.querySelector('[data-testid="ocr-gallery-input"]');
  await act(async () => {
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(attach).toHaveBeenCalledTimes(1);
  expect(http.post).toHaveBeenCalledWith("/ocr/diary", expect.any(FormData), expect.anything());
  expect(apply).not.toHaveBeenCalled();
  expect(el.querySelector('[data-testid="ocr-check-date"]').checked).toBe(false);
  expect(el.querySelector('[data-testid="ocr-check-work"]').checked).toBe(false);
  expect(el.querySelector('[data-testid="ocr-apply"]').disabled).toBe(true);
  await act(async () => el.querySelector('[data-testid="ocr-check-work"]').click());
  await act(async () => el.querySelector('[data-testid="ocr-apply"]').click());
  expect(apply).toHaveBeenCalledWith({ work: "Třídění" });
});

test("unreadable handwriting can be handed to local AI as the original file without another attachment or request", async () => {
  const useAI = jest.fn();
  http.post.mockResolvedValue({ data: { text: "čťČťť=.c= Datum © Směr E", fields: [] } });
  await act(async () => root.render(<PhotoDiaryOcr onAttach={attach} onApply={apply} onUseLocalAI={useAI} />));
  const file = new File(["sample"], "rukopis.jpg", { type: "image/jpeg" });
  const input = el.querySelector('[data-testid="ocr-gallery-input"]');
  await act(async () => {
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(el.querySelector('[role="alert"]').textContent).toContain("nerozpoznalo údaje");
  await act(async () => el.querySelector('[data-testid="ocr-use-local-ai"]').click());
  expect(useAI).toHaveBeenCalledWith(file);
  expect(attach).toHaveBeenCalledTimes(1);
  expect(http.post).toHaveBeenCalledTimes(1);
  expect(apply).not.toHaveBeenCalled();
});
