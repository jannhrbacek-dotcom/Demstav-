/** Role a oprávnění aplikace DEMSTAV Group – jediný zdroj textů pro UI. */
export const ROLE_INFO = [
  {
    role: "owner", label: "Jednatel",
    rights: ["Plná správa aplikace DEMSTAV Group (uživatelé, role, stroje, pracoviště)", "Konečné schválení dovolené (2. krok)", "Vidí a exportuje data všech zaměstnanců", "Chráněný účet – nikdo jiný ho nemůže zrušit"],
  },
  {
    role: "admin", label: "Admin",
    rights: ["Plná správa aplikace: uživatelé, hesla, stroje, pracoviště a QR", "Vidí a exportuje data všech zaměstnanců", "Neschvaluje dovolenou ani absence (to dělá vedení)"],
  },
  {
    role: "manager", label: "Vedoucí výroby",
    rights: ["Schvaluje výjimky docházky a opravy", "Schvaluje neplacené volno, lékaře a nemoc; dovolenou jako 1. krok", "Přehled vedení, všechny zápisy, exporty a týdenní exporty", "Přiřazuje pracoviště zaměstnancům"],
  },
  {
    role: "employee", label: "Strojník / zaměstnanec",
    rights: ["Vidí jen svůj deník stroje, šichtovnici a docházku", "Moje přehledy: šichtovnice, deník stroje, směny + vlastní exporty", "Žádá o dovolenou, volno, lékaře, hlásí nemoc", "Zařazení: strojník, mechanik, řidič, strojník pohonných hmot"],
  },
];
export const POSITIONS = [
  { value: "strojnik", label: "Strojník" },
  { value: "mechanik", label: "Mechanik" },
  { value: "strojnik_mechanik", label: "Strojník / mechanik" },
  { value: "externi_servis", label: "Externí servis" },
  { value: "ridic", label: "Řidič" },
  { value: "strojnik_phm", label: "Strojník pohonných hmot" },
];
export const positionLabel = (v) => POSITIONS.find((p) => p.value === (v || "strojnik"))?.label || "Strojník";
export const LEAVE_TYPES = [
  { value: "vacation", label: "Dovolená", hint: "Schvaluje vedoucí výroby a potom jednatel." },
  { value: "unpaid", label: "Neplacené volno", hint: "Schvaluje vedoucí výroby." },
  { value: "doctor", label: "Návštěva lékaře", hint: "Jeden den, čas od–do. Schvaluje vedoucí výroby." },
  { value: "sick", label: "Nemoc (ohlášení)", hint: "Ohlaste co nejdřív. Potvrzuje vedoucí výroby." },
];

