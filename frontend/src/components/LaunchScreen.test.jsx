import React, { act } from "react";
import { createRoot } from "react-dom/client";
import LaunchScreen from "./LaunchScreen";

let root, host;
const render = (page = "Domů") => act(() => root.render(<><LaunchScreen /><main>{page}</main></>));
const advance = (ms) => act(() => jest.advanceTimersByTime(ms));
const intro = () => host.querySelector('[role="dialog"]');

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  window.matchMedia = jest.fn(() => ({ matches: false }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.useRealTimers();
});

test("intro dismisses at 3.5 seconds while the real page is already mounted", () => {
  render();
  expect(intro()).not.toBeNull();
  expect(host.querySelector("main").textContent).toBe("Domů");
  advance(3499);
  expect(intro()).not.toBeNull();
  advance(1);
  expect(intro()).toBeNull();
});

test("skip dismisses immediately and cancels the pending timer", () => {
  render();
  act(() => host.querySelector("button").click());
  expect(intro()).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});

test("reduced motion uses a brief 300 millisecond intro", () => {
  window.matchMedia.mockReturnValue({ matches: true });
  render();
  expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  advance(299);
  expect(intro()).not.toBeNull();
  advance(1);
  expect(intro()).toBeNull();
});

test("changing the page does not replay a dismissed intro", () => {
  render();
  advance(3500);
  render("Docházka");
  act(() => window.dispatchEvent(new PopStateEvent("popstate")));
  expect(host.querySelector("main").textContent).toBe("Docházka");
  expect(intro()).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});

test("Escape dismisses the intro and removes its timer", () => {
  render();
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(intro()).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});
