import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { MachineServiceReminder } from "./MachineServiceReminder";
import { notifyServiceAlerts } from "@/lib/serviceNotify";
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
jest.mock("sonner", () => ({ toast: { warning: jest.fn(), dismiss: jest.fn() } }));
jest.mock("@/lib/serviceNotify", () => ({ notifyServiceAlerts: jest.fn(async () => {}) }));
const machines = [
  { id: "a", label: "L576/5", active: true, service_state: "soon", remaining_mth: 54, next_service_mth: 8500, current_mth: 8446 },
  { id: "b", label: "DEMO-B", active: true, service_state: "due", remaining_mth: -5, next_service_mth: 1000, current_mth: 1005 },
  { id: "c", label: "DEMO-C", active: true, service_state: "ok", remaining_mth: 250 },
];
let root, el;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); notifyServiceAlerts.mockResolvedValue(undefined); el = document.createElement("div"); root = createRoot(el); });
afterEach(async () => { await act(async () => root.unmount()); });
const render = machine => act(async () => root.render(<MachineServiceReminder recordId="draft" machine={machine} machines={machines} />));
test("only the selected due/soon machine produces a short reminder, not the whole fleet", async () => {
  await render(""); expect(toast.warning).not.toHaveBeenCalled();
  await render("L576/5");
  expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("L576/5"), expect.objectContaining({ description: "Do servisu zbývá 54 MTH.", duration: 7000 }));
  expect(notifyServiceAlerts).toHaveBeenCalledWith([expect.objectContaining({ id: "a" })]);
  const options = toast.warning.mock.calls[0][1]; options.action.onClick(); expect(mockNavigate).toHaveBeenCalledWith("/stroje");
  await render("L576/5"); expect(toast.warning).toHaveBeenCalledTimes(1);
  await render("DEMO-C"); expect(toast.warning).toHaveBeenCalledTimes(1);
  await render("DEMO-B"); expect(toast.warning.mock.calls[1][1].description).toBe("Servis je po termínu o 5 MTH.");
  await render("L576/5"); expect(toast.warning).toHaveBeenCalledTimes(2);
  expect(el.textContent).toBe("");
});
