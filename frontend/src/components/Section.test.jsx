import React, {act} from "react";
import {createRoot} from "react-dom/client";
import {Section} from "./Section";
test("collapsible section exposes its state and preserves controlled parent data", () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.createElement("div"); document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(<Section title="Servis"><input value="Zapsaný servis" readOnly /></Section>));
  const button = el.querySelector("button");
  expect(button.getAttribute("aria-expanded")).toBe("true");
  act(() => button.click());
  expect(button.getAttribute("aria-expanded")).toBe("false");
  act(() => button.click());
  expect(el.querySelector("input").value).toBe("Zapsaný servis");
  act(() => root.unmount()); el.remove();
});
