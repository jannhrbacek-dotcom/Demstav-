import { osloveni, pracovniPozdrav } from "./greeting";

test("správný pátý pád osobních jmen", () => {
  expect(osloveni("Jan Hrbáček")).toBe("Jane");
  expect(osloveni("Jakub Karas")).toBe("Jakube");
  expect(osloveni("Marcel Schmidt")).toBe("Marceli");
  expect(osloveni("Hana Hynčicová")).toBe("Hano");
  expect(osloveni("Jitka")).toBe("Jitko");
});
test("pozdrav respektuje pražský čas", () => {
  expect(pracovniPozdrav("Jan Hrbáček", new Date("2026-10-27T14:00:00Z"))).toBe("Dobrý den, Jane");
  expect(pracovniPozdrav("Hana Hynčicová", new Date("2026-10-27T05:00:00Z"))).toBe("Dobré ráno, Hano");
});
