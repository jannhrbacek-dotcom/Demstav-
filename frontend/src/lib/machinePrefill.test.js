import { prefillMachine } from "./machinePrefill";

test("při střídání strojů se nesmí zaměnit jejich motohodiny", () => {
  const records = [
    { machine: "L566/2", date: "2026-10-27", mthEnd: "14003", customer: "JEKAER" },
    { machine: "L566/3", date: "2026-10-26", mthEnd: "7324", site: "Struskárna" },
  ];
  const from = { machine: "L566/2", mthStart: "14000", mthEnd: "14003", customer: "JEKAER", site: "", job: "" };
  const next = prefillMachine(from, "L566/3", records);
  expect(next.machine).toBe("L566/3");
  expect(next.mthStart).toBe("7324");
  expect(next.mthEnd).toBe("");
  expect(next.customer).toBe("JEKAER");
  expect(next.site).toBe("Struskárna");
  expect(from.mthEnd).toBe("14003");
});
test("stroj bez historie nezdědí údaj z jiného stroje", () => {
  const next = prefillMachine({ machine: "L566/3", mthStart: "7324", mthEnd: "7350" },
    "Volvo/4", [], [{ label: "Volvo/4", operating_hours: 2022.5 }]);
  expect(next.mthStart).toBe("2022,5");
  expect(next.mthEnd).toBe("");
});
