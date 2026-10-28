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
  expect(el.querySelector('[data-testid="ocr-check-work"]').checked).toBe(true);
  await act(async () => el.querySelector('[data-testid="ocr-apply"]').click());
  expect(apply).toHaveBeenCalledWith({ work: "Třídění" });
});
