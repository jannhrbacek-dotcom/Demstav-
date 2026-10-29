import React, { act } from "react";
import { createRoot } from "react-dom/client";

global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;
// CRA Jest does not resolve React Router 7 conditional subpath exports.
// Use its real CommonJS router, including MemoryRouter and NavLink.
jest.mock("react-router-dom", () => jest.requireActual("react-router/dist/development/index.js"));
const { MemoryRouter, useLocation } = require("react-router-dom");
const Layout = require("./Layout").default;
const { LanguageProvider } = require("@/lib/language");

jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "employee-1", name: "Jan Hrbáček", role: "employee", role_label: "Zaměstnanec" }, simpleMode: false, setSimpleMode: jest.fn(), logout: jest.fn() }),
  atLeast: () => false,
}));
jest.mock("@/lib/sync", () => ({
  useSync: () => ({ queue: [], online: true, lastVerifiedAt: new Date().toISOString() }),
  syncNow: jest.fn(),
}));
jest.mock("@/components/ThemeSelect", () => () => <select aria-label="Vzhled"><option>Automaticky</option></select>);
jest.mock("@/components/ReloginDialog", () => ({ ReloginDialog: () => null }));

function CurrentPage() {
  return <p data-testid="current-path">{useLocation().pathname}</p>;
}
let root, holder, previousScrollTo;
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  previousScrollTo = window.scrollTo;
  window.scrollTo = jest.fn();
  holder = document.createElement("div");
  document.body.appendChild(holder);
  root = createRoot(holder);
  await act(async () => root.render(<LanguageProvider><MemoryRouter initialEntries={["/dnes"]}><Layout><CurrentPage /></Layout></MemoryRouter></LanguageProvider>));
});
afterEach(async () => {
  await act(async () => root.unmount());
  holder.remove();
  window.scrollTo = previousScrollTo;
});

test("mobile header exposes language without opening profile settings", () => {
  const header = holder.querySelector(".shell-header");
  const language = header.querySelector('[data-testid="language-choice"]');
  expect(language).not.toBeNull();
  expect(language.closest("details")).toBeNull();
  expect(language.getAttribute("aria-label")).toBe("Jazyk aplikace");
  expect(header.querySelector('[data-testid="sync-indicator"]')).not.toBeNull();
  expect(header.querySelector(".shell-profile").open).toBe(false);
});

test("bottom navigation has five purposeful destinations and a central create action", () => {
  const links = [...holder.querySelector('[data-testid="mobile-bottom-nav"]').querySelectorAll("a")];
  expect(links.map(link => link.textContent)).toEqual(["Domů", "Docházka", "Nový zápis", "Volno", "Více"]);
  expect(links.map(link => link.getAttribute("href"))).toEqual(["/dnes", "/dochazka", "/zapis/novy", "/nepritomnost", "/vice"]);
  expect(links[2].classList.contains("shell-nav-create")).toBe(true);
  expect(links.filter(link => link.classList.contains("shell-nav-create"))).toHaveLength(1);
});

test("changing pages resets scroll and follows the selected destination", async () => {
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
  window.scrollTo.mockClear();
  const attendance = holder.querySelector('[data-testid="m-nav-attendance"]');
  await act(async () => attendance.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
  expect(holder.querySelector('[data-testid="current-path"]').textContent).toBe("/dochazka");
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "instant" });
  expect(attendance.getAttribute("aria-current")).toBe("page");
});
