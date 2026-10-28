import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { MachineFilter } from "./MachineFilter";

test("records machine filter browses, searches, selects and clears on touch or keyboard", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.createElement("div"); document.body.appendChild(el);
  const root = createRoot(el);
  const scroll = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = jest.fn();
  function Filter() {
    const [value, setValue] = useState("");
    return <MachineFilter value={value} onChange={setValue} options={["L576/5", "L566/3", "Volvo L120H"]} />;
  }
  try {
    await act(async () => root.render(<Filter />));
    const input = el.querySelector('[role="combobox"]');
    await act(async () => input.focus());
    expect(el.querySelectorAll('[role="option"]')).toHaveLength(4);
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, "l56");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(el.querySelectorAll('[role="option"]')).toHaveLength(2);
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(input.value).toBe("L566/3");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    await act(async () => el.querySelector('[aria-label="Zobrazit nabídku strojů"]').click());
    expect(el.querySelectorAll('[role="option"]')).toHaveLength(4);
    await act(async () => el.querySelector('[role="option"]').click());
    expect(input.value).toBe("");
    await act(async () => el.querySelector('[aria-label="Zobrazit nabídku strojů"]').click());
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(input.getAttribute("aria-expanded")).toBe("false");
  } finally {
    await act(async () => root.unmount()); el.remove();
    HTMLElement.prototype.scrollIntoView = scroll;
  }
});
