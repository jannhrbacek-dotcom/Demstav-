import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ThemeSelect from "./ThemeSelect";
import { LanguageProvider, LANGUAGE_STORAGE_KEY } from "@/lib/language";

let mockResolvedTheme = "light";
const mockSetTheme = jest.fn();
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "system", resolvedTheme: mockResolvedTheme, setTheme: mockSetTheme }) }));

test("theme choice is translated, applies selection, and keeps browser color in sync", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, "uk");
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  document.head.appendChild(meta);
  const host = document.createElement("div"), root = createRoot(host);
  await act(async () => root.render(<LanguageProvider><ThemeSelect /></LanguageProvider>));
  const select = host.querySelector("select");
  expect(select.getAttribute("aria-label")).toBe("Вигляд застосунку");
  expect(select.textContent).toContain("Автоматично");
  expect(meta.content).toBe("#ffffff");
  await act(async () => {
    select.value = "dark";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(mockSetTheme).toHaveBeenCalledWith("dark");
  mockResolvedTheme = "dark";
  await act(async () => root.render(<LanguageProvider><ThemeSelect /></LanguageProvider>));
  expect(meta.content).toBe("#19222f");
  await act(async () => root.unmount());
  meta.remove();
  localStorage.removeItem(LANGUAGE_STORAGE_KEY);
});
