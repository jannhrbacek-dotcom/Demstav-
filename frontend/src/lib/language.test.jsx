import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { LanguageProvider, LanguageSelect, useLanguage, LANGUAGE_STORAGE_KEY, translateText } from "./language";
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

test("Ukrainian navigation, attendance and security messages are translated consistently", () => {
  expect(translateText("uk", "Domů")).toBe("Головна");
  expect(translateText("uk", "Nový denní záznam")).toBe("Новий щоденний запис");
  expect(translateText("uk", "Výkazy a exporty")).toBe("Звіти та експорт");
  expect(translateText("uk", "Čistá doba dnes")).toBe("Робочий час без перерв за сьогодні");
  expect(translateText("uk", "Nesprávný PIN.")).toBe("Неправильний PIN-код.");
  expect(translateText("uk", "Odemknout biometrií")).toBe("Розблокувати за допомогою біометрії");
});

test("explicit placeholders retain workplace radius without translating user data", () => {
  const source = "Příchod i odchod potvrdíte polohou GPS v okruhu {radius} m nebo QR kódem na pracovišti. Stačí jeden způsob.";
  expect(translateText("uk", source, { radius: 400 })).toBe("Прихід і вихід підтверджуйте за допомогою GPS у радіусі 400 м або QR-кодом на робочому місці. Достатньо одного способу.");
  expect(translateText("cs", source, { radius: 150 })).toContain("150 m");
  expect(translateText("uk", "L566-6/3 · Jan Hrbáček · 12500 MTH")).toBe("L566-6/3 · Jan Hrbáček · 12500 MTH");
  expect(translateText("uk", undefined)).toBeUndefined();
  expect(translateText("uk", "toString")).toBe("toString");
});
