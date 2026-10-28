import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MachinePicker, { matchMachines } from "./MachinePicker";
const machines = [
  { id: "one", label: "L566/3", manufacturer: "Liebherr", type: "L566", internal_number: "3" },
  { id: "two", label: "L576/5", manufacturer: "Liebherr", type: "L576", internal_number: "5", serial_number: "VATZ1459VZB060956" },
  { id: "three", label: "Volvo L120H", manufacturer: "Volvo", type: "L120H", internal_number: "10" },
];
test("suggestions find canonical machines using model, inventory number and serial", () => {
  expect(matchMachines(machines, "576").map(m => m.label)).toEqual(["L576/5"]);
  expect(matchMachines(machines, "60956").map(m => m.label)).toEqual(["L576/5"]);
  expect(matchMachines(machines, "5").map(m => m.label)).toEqual(["L566/3", "L576/5"]);
  expect(matchMachines(machines, "volvo").map(m => m.label)).toEqual(["Volvo L120H"]);
});
test("only selecting suggestion changes stored machine label", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.createElement("div"); document.body.appendChild(el);
  const root = createRoot(el);
  const changed = jest.fn();
  await act(async () => root.render(<MachinePicker machines={machines} value="L566/3" onChange={changed}/>));
  const input = el.querySelector('[data-testid="record-machine-select"]');
  await act(async () => {
    input.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeSetter.call(input, "576");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(changed).not.toHaveBeenCalled();
  await act(async () => el.querySelector('[data-testid="machine-option-two"]').click());
  expect(changed).toHaveBeenCalledWith("L576/5");
  expect(el.querySelector('[data-testid="record-machine-select"]').getAttribute("aria-expanded")).toBe("false");
  await act(async () => root.unmount()); el.remove();
});
