// Deliberately fictitious documentation fixtures. Never load production data.
export const DEMO_DAY = "2030-04-15";
export const DEMO_NOW = "2030-04-15T12:00:00.000Z";
export const user = { id: "documentation-demo", name: "Ukázkový strojník", username: "demo", email: "demo@example.invalid", role: "employee", role_label: "Zaměstnanec · DEMO", position: "strojnik", must_change_password: false };
export const machines = [{ id: "demo-machine", label: "Nakladač / DEMO 01", internal_number: "DEMO 01", active: true, current_mth: 2506, operating_hours: 2506, service_interval_mth: 500, next_service_mth: 3000, remaining_mth: 494 }];
export const workplaces = [{ id: "demo-site", name: "Ukázková stavba A", active: true, mode: "gps_or_qr", radius: 100, has_location: false }];
export const record = {
  id: "demo-record", owner_id: user.id, owner_name: user.name, revision: 1, status: "draft", date: DEMO_DAY, shift: "Denní", operator: user.name, crew: "", machine: machines[0].label, customer: "Ukázkový objednatel", site: workplaces[0].name, job: "VZOR-01", drive: "", driveMinutes: null, journeyRole: "", chipStatus: "unverified", vehiclesTo: "", vehiclesFrom: "", accommodation: "",
  billing: [{ start: "06:00", end: "15:00" }], service: [], downtime: [], travel: [], downtimeReason: "", workTimeMode: "shift", work: "Ukázka: nakládka materiálu a úprava plochy.", mthStart: "2500", mthEnd: "2506", dailyCheck: true, accessoryCheck: true, equipmentCheck: true, fit: "yes", notes: "Fiktivní vzor pro návod, není provozním záznamem.", handover: "", handoverName: "", handoverSignature: "", operatorSignature: "", diesel: "", hydraulic: "", oil: "", otherFluid: "", serviceDescription: "", repairDescription: "", serviceBy: "", externalCompany: "", workshopSignature: "", faults: [], attachments: [], intervalService: false, createdAt: DEMO_NOW, updatedAt: DEMO_NOW,
};
export const records = [record, { ...record, id: "demo-previous", date: "2030-04-14", status: "confirmed", mthStart: "2495", mthEnd: "2500" }];
export const attendance = { projection: { state: "working", workplace_id: workplaces[0].id, issues: [] }, today_projection: { presenceHours: 8, breakHours: .5, netHours: 7.5 }, events: [{ id: "demo-arrival", kind: "arrival", status: "accepted", effective_at: "2030-04-15T04:00:00Z", workplace_id: workplaces[0].id, workplace_name: workplaces[0].name }], requests: [] };
export function fixtureFor(path = "") {
  if (path.startsWith("/machines")) return machines;
  if (path.startsWith("/workplaces")) return workplaces;
  if (path.startsWith("/records/")) return record;
  if (path.startsWith("/records")) return records;
  if (path.startsWith("/attendance")) return attendance;
  if (path === "/production/settings") return { responsible_ids: [] };
  return EMPTY;
}
const EMPTY = [];
