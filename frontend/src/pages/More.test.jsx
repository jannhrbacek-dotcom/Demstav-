import React, { act } from "react";
import { createRoot } from "react-dom/client";
import More from "./More";
import { LanguageProvider, LANGUAGE_STORAGE_KEY } from "@/lib/language";
let mockRole = "employee";
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>, useNavigate: () => jest.fn() }));
jest.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "test", role: mockRole, name: "Test" }, logout: jest.fn(), setSimpleMode: jest.fn() }), atLeast: user => user.role === "manager" }));
jest.mock("@/lib/sync", () => ({ useSync: () => ({ queue: [] }) }));
jest.mock("@/lib/push", () => ({ pushSupported: () => false, pushPermission: () => "unsupported", getActiveSubscription: async () => null }));
test("More exposes one machines link to employees and managers while administration remains restricted", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true; mockRole = "employee";
  const el = document.createElement("div"), root = createRoot(el);
  await act(async () => root.render(<More />));
  expect(el.querySelector('[data-testid="more-machines"]').getAttribute("href")).toBe("/stroje");
  expect(el.querySelector('[data-testid="more-users"]')).toBeNull();
  const settings = el.querySelector('[data-testid="more-device-settings"]');
  expect(settings.open).toBe(false);
  const quickAccess = el.querySelector('[data-testid="more-quick-access"]');
  expect(el.querySelector("h1").compareDocumentPosition(quickAccess) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(quickAccess.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(settings.textContent).toContain("Zabezpečení aplikace");
  mockRole = "manager"; await act(async () => root.render(<More />));
  expect(el.querySelectorAll('[data-testid="more-machines"]')).toHaveLength(1);
  expect(el.querySelector('[data-testid="more-users"]')).not.toBeNull();
  await act(async () => root.unmount());
});

test("Ukrainian More keeps account and security labels readable with neutral icon surfaces", async () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, "uk");
  const el = document.createElement("div"), root = createRoot(el);
  await act(async () => root.render(<LanguageProvider><More /></LanguageProvider>));
  expect(el.querySelector('[data-testid="more-machines"]').textContent).toContain("Машини");
  expect(el.querySelector('[data-testid="more-machines"] .more-icon')).not.toBeNull();
  expect(el.textContent).toContain("Захист застосунку");
  expect(el.textContent).toContain("Налаштування облікового запису");
  expect(el.textContent).toContain("Переглянути вступну анімацію");
  await act(async () => root.unmount());
  localStorage.removeItem(LANGUAGE_STORAGE_KEY);
});
