import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import Guide, { guideKey, guideContextStep, GUIDE_PDF } from "./Guide";
import { LanguageProvider, LANGUAGE_STORAGE_KEY } from "@/lib/language";

let mockLocation = { state: {} };
jest.mock("react-router-dom", () => ({ MemoryRouter: ({ children }) => children,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => () => {}, useLocation: () => mockLocation }));

let mockRole = "employee";
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "qa-guide", role: mockRole } }),
  atLeast: (user) => user.role !== "employee",
}));

let root, el;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockRole = "employee";
  mockLocation = { state: {} };
  localStorage.clear();
  el = document.createElement("div"); document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(() => { act(() => root.unmount()); el.remove(); });
const click = (label) => act(() => [...el.querySelectorAll("button")].find(b => b.textContent === label).click());

test("employee can read all tutorial steps and completion is remembered per account", () => {
  act(() => root.render(<MemoryRouter><Guide /></MemoryRouter>));
  expect(el.textContent).toContain("1 z 7");
  for (let i = 0; i < 6; i++) click("Další");
  expect(el.textContent).toContain("7 z 7");
  expect(localStorage.getItem(guideKey("qa-guide"))).toBeNull();
  click("Rozumím, začít");
  expect(localStorage.getItem(guideKey("qa-guide"))).toBe("1");
  expect(localStorage.getItem(guideKey("other-user"))).toBeNull();
});

test("operations manager receives the approval and administration step", () => {
  mockRole = "operations_manager";
  act(() => root.render(<MemoryRouter><Guide /></MemoryRouter>));
  for (let i = 0; i < 7; i++) click("Další");
  expect(el.textContent).toContain("8 z 8");
  expect(el.textContent).toContain("Vedoucí provozu má plnou správu");
  click("Zpět");
  expect(el.textContent).toContain("7 z 8");
});

test("brochure remains reachable at every tutorial step with open and download actions", () => {
  act(() => root.render(<Guide />));
  for (let i = 0; i < 7; i++) {
    const open = el.querySelector('[data-testid="guide-pdf-open"]');
    const download = el.querySelector('[data-testid="guide-pdf-download"]');
    expect(open.getAttribute("href")).toBe(GUIDE_PDF);
    expect(open.getAttribute("target")).toBe("_blank");
    expect(download.getAttribute("href")).toBe(GUIDE_PDF);
    expect(download.hasAttribute("download")).toBe(true);
    if (i < 6) click("Další");
  }
});

test("feature map exposes employee routes and keeps manager routes out of employee navigation", () => {
  act(() => root.render(<Guide />));
  const paths = [...el.querySelectorAll('[data-testid="guide-functions"] a')].map(a => a.getAttribute("href"));
  expect(paths).toEqual(expect.arrayContaining(["/dnes", "/dochazka", "/zapis/novy", "/zapisy", "/zapisy/import", "/fronta", "/prehledy", "/vykazy-vazeni", "/nepritomnost", "/kalendar", "/exporty", "/zmena-hesla", "/vice"]));
  expect(paths).not.toContain("/uzivatele");
  expect(paths).not.toContain("/kontrola");
  const overview = el.querySelector('a[href="/prehledy"]');
  act(() => overview.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
  expect(localStorage.getItem(guideKey("qa-guide"))).toBe("1");
});

test("manager feature map contains all administrative destinations", () => {
  mockRole = "manager";
  act(() => root.render(<Guide />));
  const paths = [...el.querySelectorAll('[data-testid="guide-functions"] a')].map(a => a.getAttribute("href"));
  expect(paths).toEqual(expect.arrayContaining(["/prehled", "/kontrola", "/vsechny-zapisy", "/pracoviste", "/stroje", "/uzivatele"]));
});

test.each([ ["/fronta", 5], ["/nepritomnost", 6], ["/kalendar", 6], ["/prehledy", 6], ["/zapisy/import", 3], ["/dochazka", 1] ])("context %s opens the matching tutorial step", (context, expected) => {
  mockLocation = { state: { context } };
  act(() => root.render(<Guide />));
  expect(el.querySelector("progress").value).toBe(expected + 1);
  expect(guideContextStep(context)).toBe(expected);
});

test("administrative context cannot expose a manager tutorial to an employee", () => {
  expect(guideContextStep("/kontrola", false)).toBe(0);
  expect(guideContextStep("/kontrola", true)).toBe(7);
  expect(guideContextStep("/pracoviste/one/qr", true)).toBe(7);
});

test("brochure and feature map translate in Ukrainian", () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, "uk");
  act(() => root.render(<LanguageProvider><Guide /></LanguageProvider>));
  expect(el.querySelector('[data-testid="guide-brochure"]').textContent).toContain("Відкрити посібник");
  expect(el.querySelector('[data-testid="guide-functions"]').textContent).toContain("Огляд функцій");
  expect(el.querySelector('[data-testid="guide-functions"]').textContent).toContain("Імпорт записів");
  expect(el.querySelector('[data-testid="guide-functions"]').textContent).not.toContain("Neodeslané");
});
