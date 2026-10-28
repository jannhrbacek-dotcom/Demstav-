import {dayUnion, timeBreakdown} from "./worktime";
import {durationMinutes, journeyText} from "./journey";
const rec = (start, end, extra = {}) => ({date: "2026-10-28", billing: [{start, end}], ...extra});
test("night union shares one anchor across machines", () => {
  expect(dayUnion([rec("22:00", "02:00"), rec("01:00", "03:00")]).totalHours).toBe(5);
});
test("overlap and category totals equal backend rules", () => {
  const b = dayUnion([rec("06:00", "13:00"), rec("12:30", "17:00")]);
  expect(b.totalHours).toBe(10);
  const c = timeBreakdown(rec("06:00", "17:00", {service: [{start: "11:00", end: "13:00"}], travel: [{start: "14:00", end: "15:00"}]}));
  expect([c.totalHours, c.serviceHours, c.travelHours, c.workHours]).toEqual([10, 1.5, 1, 7.5]);
});
test("journey distinguishes zero, missing and legacy integers", () => {
  expect(durationMinutes("0:45")).toBe(45);
  expect(durationMinutes("0:60")).toBeNull();
  expect(durationMinutes("24:01")).toBeNull();
  expect(journeyText({driveMinutes: 0})).toBe("0:00");
  expect(journeyText({})).toBe("");
  expect(journeyText({drive: "45"})).toBe("neověřeno");
});
