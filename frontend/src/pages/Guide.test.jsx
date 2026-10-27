import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import Guide, { guideKey } from "./Guide";

jest.mock("react-router-dom", () => ({ MemoryRouter: ({ children }) => children, useNavigate: () => () => {}, useLocation: () => ({ state: {} }) }));

let mockRole = "employee";
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "qa-guide", role: mockRole } }),
  atLeast: (user) => user.role !== "employee",
}));

let root, el;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockRole = "employee";
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
