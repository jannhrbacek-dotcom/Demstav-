import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { SyncPill } from "./Layout";
jest.mock("react-router-dom", () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  NavLink: ({ children, to }) => <a href={to}>{children}</a>,
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/dnes" }),
}));

let mockSync = {};
jest.mock("@/lib/sync", () => ({
  useSync: () => mockSync,
  syncNow: jest.fn(),
}));

let root, host;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const renderStatus = (partial) => {
  mockSync = { queue: [], online: true, syncing: false, lastVerifiedAt: new Date().toISOString(), lastError: null, ...partial };
  act(() => root.render(<SyncPill />));
  return host.querySelector('[data-testid="sync-indicator"] button');
};
test("cloud indicator distinguishes verified, pending, failed and offline states", () => {
  expect(renderStatus({}).getAttribute("aria-label")).toContain("Synchronizováno");
  expect(renderStatus({ queue: [{ opId: "1", state: "queued" }] }).getAttribute("aria-label")).toContain("Čeká na odeslání");
  expect(renderStatus({ queue: [{ opId: "1", state: "error" }], online: false }).getAttribute("aria-label")).toContain("Vyžaduje opravu");
  expect(renderStatus({ online: false }).getAttribute("aria-label")).toContain("Offline");
  expect(renderStatus({ lastVerifiedAt: null }).getAttribute("aria-label")).toContain("Offline");
});
