import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { LanguageProvider, LanguageSelect, useLanguage, LANGUAGE_STORAGE_KEY } from "./language";
import { PageHeader } from "@/components/Section";

function Label() {
  const { t } = useLanguage();
  return <div data-testid="translated-title">{t("Nový denní zápis")}</div>;
}
let root, holder;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  holder = document.createElement("div");
  document.body.appendChild(holder);
  root = createRoot(holder);
});
afterEach(async () => {
  await act(async () => root.unmount());
  holder.remove();
  localStorage.removeItem(LANGUAGE_STORAGE_KEY);
});
test("Czech is default and Ukrainian persists through the language selector", async () => {
  await act(async () => root.render(<LanguageProvider><LanguageSelect /><Label /><PageHeader title="Docházka" /></LanguageProvider>));
  expect(holder.querySelector('[data-testid="translated-title"]').textContent).toBe("Nový denní zápis");
  expect(holder.querySelector("h1").textContent).toBe("Docházka");
  const select = holder.querySelector('[data-testid="language-choice"]');
  await act(async () => {
    select.value = "uk";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("uk");
  expect(document.documentElement.lang).toBe("uk");
  expect(holder.querySelector('[data-testid="translated-title"]').textContent).toBe("Новий щоденний запис");
  expect(holder.querySelector("h1").textContent).toBe("Облік робочого часу");
});
test("stored Ukrainian is restored when reopening the application", async () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, "uk");
  await act(async () => root.render(<LanguageProvider><Label /></LanguageProvider>));
  expect(holder.querySelector('[data-testid="translated-title"]').textContent).toBe("Новий щоденний запис");
});
