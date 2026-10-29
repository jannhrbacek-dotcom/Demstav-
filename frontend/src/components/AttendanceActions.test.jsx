import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AttendanceActions } from "./AttendanceActions";
import { addAttendanceEvent, removeOp } from "@/lib/sync";

jest.mock("@/lib/sync", () => ({
  useSync: () => ({ queue: [] }),
  addAttendanceEvent: jest.fn(), updateOp: jest.fn(), removeOp: jest.fn(),
}));
jest.mock("@/components/QrScanner", () => ({
  QrScanner: ({ onResult }) => <button data-testid="scan-test-code" onClick={() => onResult("DS1.test.signature")}>Scan</button>,
}));
jest.mock("sonner", () => ({ toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));

let root, container;
const wp = { id: "site", name: "Slezská Ostrava", mode: "gps_or_qr", radius: 150 };
const click = async (id) => { await act(async () => { document.querySelector(`[data-testid="${id}"]`).click(); }); };

beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  Object.defineProperty(global, "crypto", { configurable: true, value: { randomUUID: () => "test-event-12345" } });
  jest.clearAllMocks();
  addAttendanceEvent.mockResolvedValue(null);
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: jest.fn((ok) => ok({
    coords: { latitude: 49.8136097, longitude: 18.3151526, accuracy: 5 }, timestamp: Date.now(),
  })) } });
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<AttendanceActions workplaces={[wp]} serverState="away" />); });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

test("GPS confirmation captures location only after choosing GPS", async () => {
  await click("today-arrival-button");
  expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
  expect(addAttendanceEvent).not.toHaveBeenCalled();
  await click("attendance-method-gps");
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(addAttendanceEvent).toHaveBeenCalledWith(expect.objectContaining({
    workplaceId: "site", kind: "arrival", qr: null,
    gps: expect.objectContaining({ latitude: 49.8136097, longitude: 18.3151526 }),
  }));
});

test("QR confirmation never requests geolocation", async () => {
  await click("today-arrival-button");
  await click("attendance-method-qr");
  await click("scan-test-code");
  expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
  expect(addAttendanceEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: "arrival", qr: "DS1.test.signature", gps: null }));
});

test("failed GPS can be replaced by QR without keeping a duplicate event", async () => {
  const payload = { workplaceId: "site", kind: "arrival", qr: null };
  addAttendanceEvent.mockResolvedValueOnce({ opId: "pending", state: "needs_reason", payload, reasons: ["gps_unavailable"] });
  await click("today-arrival-button"); await click("attendance-method-gps");
  await click("exception-try-qr");
  expect(removeOp).toHaveBeenCalledWith("pending");
  await click("scan-test-code");
  expect(addAttendanceEvent).toHaveBeenCalledTimes(2);
  expect(addAttendanceEvent).toHaveBeenLastCalledWith(expect.objectContaining({ qr: "DS1.test.signature", gps: null }));
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
});

test("workplace instructions are collapsed behind info until requested", async () => {
  const info = document.querySelector('[data-testid="attendance-workplace-info"]');
  expect(info).not.toBeNull();
  expect(info.open).toBe(false);
  expect(info.querySelector("summary")).not.toBeNull();
  await act(async () => info.querySelector("summary").click());
  expect(info.open).toBe(true);
  expect(document.querySelector('[data-testid="today-arrival-button"]')).not.toBeNull();
  expect(document.querySelector('[data-testid="attendance-general-info"]').open).toBe(false);
});
