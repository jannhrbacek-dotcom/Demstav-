# plan.md — DEMSTAV OPERATIONS (Emergent) — Plán

## 1) Cíle
- Dodat funkční V1 webovou aplikaci (instalovatelná **PWA**) pro **DEMSTAV Operations / DEMSTAV Group**, se zaměřením na:
  - **Provozní deník stroje + šichtovnice** (intervaly, MTH, závady, koncept/potvrzení, revize).
  - **Docházka s pracovišti** (příchod/odchod/pauzy, ověření pracoviště přes QR+GPS, výjimky ke schválení).
  - **Nepřítomnosti** (dovolená, neplacené volno, lékař, nemoc) včetně schvalování.
  - **Reporty a exporty** (PDF dle šablon + datové exporty XLSX/CSV s filtry + automatické týdenní exporty).

- Autentizace: **e-mail/uživatelské jméno + heslo**, role a oprávnění:
  - `owner` → **Jednatel** (chráněný účet).
  - `admin` → **Admin**.
  - `manager` → **Vedoucí výroby**.
  - `employee` → **Strojník / zaměstnanec** + pracovní zařazení: **strojník, mechanik, řidič, strojník pohonných hmot**.
  - Přihlášení podporuje **username nebo e-mail**.

- Offline-first:
  - Persistovaná **lokální fronta** na úrovni účtu (stabilní ID, idempotentní resend, detekce konfliktu přes `baseRevision`).

- Média / soubory:
  - Nahrávání příloh offline → následná synchronizace.
  - Sekce příloh: `general | service | timesheet` + exporty příloh.

- Servisní intervaly:
  - Default interval: **500 mth**, varování: **100 mth**.
  - Aktuální MTH: `max(machine.operating_hours, poslední mthEnd/mthStart ze zápisů)`.
  - Upozornění v aplikaci + **push notifikace**.

- Integrita dat:
  - Revize v `record_versions`, **hash-chain** (SHA-256), včetně SHA příloh.
  - Ověření integrity přes API + zobrazení v UI + tisk do PDF deníku.

- UX docházky:
  - **Pauza bez QR** (tap) — `break_start/break_end` bez QR+GPS.
  - **Přejezd A→B**: `travel_start` udržuje stav „stále v práci“ (počítá se do odpracovaného času, ale **nefakturuje se**), příjezd na B vyžaduje QR+GPS.

- Konvence názvů strojů:
  - Primární štítek s číslem stroje: např. **L566/3**, **L576/7**.

- **Nově (Phase 6) — DODÁNO**:
  - **Plánované výjimky / zkrácené směny** (pozdní příchody / dřívější odchody) – zadává zaměstnanec, **bez schvalování**, viditelné vedení.
  - **Refaktor RecordForm** pro výrazně čistší UX (dropdown stroje + podmíněné sekce servis/přejezd) + business pravidla pro 500 mth interval servis.
  - **Push notifikace i při zavřené aplikaci**: nativní Web Push (VAPID) + subscription backend + FE opt-in + SW push handler.

- **Nově (Phase 7) — UX pro mobil/PC/tablet + „dlaždicový“ jednoduchý režim + počasí**:
  - Opravit horizontální posouvání a nutnost „zmenšovat“ zobrazení na telefonu.
  - Dodat komfortní rozložení pro **PC a tablety**.
  - Předělat **Jednoduchý režim** na opravdu jednoduché ovládání „pro důchodce“ (velké dlaždice, minimum textu, jednoznačné akce).
  - Přidat **widget Počasí** na uvítací obrazovku (min. 4 dny dopředu) podle polohy **pracoviště** (GPS z pracoviště, fallback na geolokaci zařízení).

---

## 2) Implementační kroky

### Phase 1 — Core POC (offline queue + idempotentní sync + konflikty) ✅ HOTOVO
User stories
1. Zaměstnanec vytvoří offline docházkovou událost a vidí ji ve frontě.
2. Zaměstnanec vytvoří offline koncept zápisu (deník/šichtovnice) se stabilním ID.
3. Aplikace po návratu online odešle frontu bez duplicit.
4. Při vypršení session uživatel nepřijde o offline data a po přihlášení sync pokračuje.
5. Server odmítne konfliktní update (špatná base revize) a vrátí konflikt payload.

Exit gate ✅
- Předvedeno: offline create → reopen → login → sync → bez duplicit → konflikt cesta.

---

### Phase 2 — V1 vývoj modulů + UX, 1× E2E test ✅ HOTOVO
Backend ✅
- Auth & role seed, stroje, pracoviště, audit.
- Zápisy: koncept/potvrzení, revize, konflikt 409.
- Docházka: QR/GPS + review.
- Exporty: PDF šichtovnice a deníku.

Frontend ✅
- Login + vynucená změna hesla.
- Navigace dle rolí.
- Toky zaměstnance: Docházka + Zápisy + Fronta.
- Toky vedení: Přehled + Kontrola.
- PWA manifest + SW cache shell.

Testing ✅
- E2E `testing_agent_v3`.

---

### Phase 3 — Hardening + použitelnost ✅ HOTOVO
- Jednoduchý režim (první verze).
- Smart autocomplete + „Načíst z minula“.
- Diktování (Whisper přes Emergent).
- Pilot data.

Testing ✅
- Regrese prošly (`testing_agent_v3`).

---

### Phase 4 — Přílohy + servisní intervaly + integrita ✅ IMPLEMENTOVÁNO + OTESTOVÁNO
#### 4.1 Přílohy podle sekcí ✅
- `attachments.section`: `general | service | timesheet`.
- V RecordForm separátní bloky fotek.
- Exporty doplňují přílohy podle sekce.

#### 4.2 Servisní intervaly a upozornění ✅
- `service_interval_mth`, `service_warn_mth`, `last_service_mth`.
- `/api/machines` vrací computed stav (current/next/remaining/state).
- `/api/service-alerts` vrací stroje `soon/due`.
- UI upozornění v Today/Overview/Machines/RecordForm.

#### 4.3 Imutabilita / integrita ✅
- Hash-chain revizí + příloh.
- `GET /api/records/{rid}/integrity`.
- UI + PDF otisky.

---

### Phase 4.4 — Emergent STT (Whisper) ✅ IMPLEMENTOVÁNO + OTESTOVÁNO
- Backend: `POST /api/stt`.
- Frontend: Dictation komponenta (offline: drží nahrávku a transkribuje po návratu online).

---

### Phase 5 — HR workflow + reporting + role/permissions + travel/pause ✅ IMPLEMENTOVÁNO (vizuální ověření pending)
> Phase 5 je funkčně hotová a prošla automatickými testy; část UI toků vyžaduje ruční vizuální kontrolu.

#### 5.1 Role model + username login ✅ HOTOVO
- Backend: `public_user` (username, position, role_group/label), `/auth/login` s `login` (username/email).
- Frontend: login texty, Users page pro username+position, role labely.

#### 5.2 Nepřítomnosti (žádosti + schvalování) ✅ HOTOVO
- Backend: `routes_leave.py`.
- Frontend: `/nepritomnost`.
- Přehled vedení ukazuje `pending_leave`.

#### 5.3 XLSX/CSV exporty ✅ HOTOVO
- Backend: `routes_data.py` (`/api/exports/data`).
- CSV: středník + BOM (Excel kompatibilita).

#### 5.4 Automatické týdenní exporty ✅ HOTOVO
- PDF duplex + weekly generování + download endpoints + cron.

#### 5.5 Moje přehledy ✅ HOTOVO
- `/api/my/summary` + `/prehledy`.

#### 5.6 Docházka: pauza bez QR + přejezd A→B ✅ HOTOVO
- `travel_start` stav + UI tlačítko.

#### 5.7 Šichtovnice: travel intervaly + nefakturovaný čas ✅ HOTOVO
- `travelHours` + `billableHours` v breakdown + exporty.

#### 5.8 Přejmenování strojů ✅ HOTOVO
- L566/3, L576/7.

---

### Phase 6 — Úkoly potvrzené uživatelem (Message 332) ✅ DODÁNO + OTESTOVÁNO
Priorita byla potvrzena uživatelem v pořadí: 1) výjimky, 2) RecordForm refaktor, 3) Push (VAPID), 4) vizuální ověření.

#### 6.1 Plánované výjimky / zkrácené směny ✅
- Backend:
  - `routes_exceptions.py`: `POST/GET/DELETE /api/exceptions`.
  - Oprávnění: zaměstnanec vidí svoje; vedení vidí vše.
- Frontend:
  - Integrace do `/nepritomnost` (form + seznam „Moje plánované výjimky“ + přehled pro vedení).
- Přehled vedení:
  - `/api/overview` obsahuje `upcoming_exceptions` (nejbližší týden).

#### 6.2 Refaktor UI/UX formuláře zápisu (RecordForm) ✅
- Stroj jako dropdown `Select` z `/machines`.
- Ano/Ne gating před sekcemi Servis a Přejezd.
- Servis přesunut nahoru.
- Přidáno „strojník včetně dílny“.
- Omezení interval servisu (500 mth): server-side i UI (mechanik / externí / Jan Hrbáček).

#### 6.3 Push notifikace (Web Push + VAPID) ✅
- Backend:
  - `routes_push.py`: `GET /api/push/public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `POST /api/push/test`.
  - Hooky: leave request/decision, planned exception, STOP závada.
- Frontend:
  - More page opt-in (zapnout/vypnout + test).
  - SW: handler `push` + `notificationclick`.

#### 6.4 Vizuální ověření ⏳ (stále pending)
- Travel A→B UI flow.
- Pauza bez QR.
- PDF exporty (šichtovnice, deník) vizuálně.

---

### Phase 7 — Mobilní responsivita + tablet/desktop layout + „dlaždicový“ jednoduchý režim + Počasí 🔜 PLÁNOVÁNO
**Motivace / problém:** uživatel hlásí, že na telefonu musí neustále zmenšovat nebo posouvat do stran; aplikace musí být pohodlná i na PC/tabletu. Jednoduchý režim má být výrazně jednodušší (dlaždice, obří ovládání).

#### 7.1 Mobilní audit a oprava horizontálního overflow (P0)
Cíl
- Nikde na mobilu nevznikne vodorovný scrollbar.
- Komponenty se nevejdou mimo viewport (typicky gap, padding, fixed width).

Kroky
- Přidat globální ochranu:
  - `html, body { overflow-x: hidden; }`
  - `* { max-width: 100%; }` pouze selektivně (neglobálně na vše), preferovat: `img, video, canvas, svg { max-width:100%; height:auto; }`.
- Najít a opravit konkrétní viníky overflow (např. `Today` grid, karty s `w` větší než viewport, špatné `px` na containeru).
- Zkontrolovat fixed/spodní nav a safe-area.

Testy
- Povinně spustit `testing_agent_v3` na regression + nový „mobile overflow check“ (screenshot + měření `scrollWidth > clientWidth`).

#### 7.2 Responsivní layout pro PC a tablety (P0/P1)
Cíl
- Tablet/desktop využije šířku rozumně:
  - více sloupců, menší výška karet, rozumné max-width.
  - stabilní sidebar (už existuje), ale upravit některé stránky pro desktop grid.

Kroky
- Zkontrolovat klíčové stránky: Today, Attendance, Records list, RecordForm, Overview.
- Přidat breakpoint layouty (sm/md/lg/xl) tam, kde je to uživatelsky přínosné.

Testy
- Screenshoty v šířkách 390 (mobil), 768 (tablet), 1280 (desktop).

#### 7.3 „Jednoduchý režim“ jako dlaždicový dashboard (P0)
Cíl
- Jednoduchý režim bude ovladatelný „pro důchodce“:
  - minimum textu, velká tlačítka, jednoznačné volby.
  - přednostně **dlaždice**: „Docházka“, „Nový zápis“, „Fronta“, „Volno“, „Exporty“.

Kroky
- V Today page (a případně v Layoutu) při `simpleMode=true`:
  - nahradit některé sekce tile gridem.
  - obří tlačítka pro hlavní akce docházky (Příchod, Pauza, Odchod, Přejezd).
  - skrýt nebo sbalit sekundární informace.
- Zachovat funkčnost i bez jednoduchého režimu.

Testy
- `testing_agent_v3` – frontend smoke: zapnout simple mode → ověřit, že jsou vidět dlaždice a hlavní akce.

#### 7.4 Widget Počasí na uvítací obrazovce (P1)
Technická volba
- Open-Meteo (bez API klíče): denní předpověď min. na 4 dny.

Datový zdroj polohy
- Primárně: GPS souřadnice z vybraného **pracoviště** (pokud má `latitude/longitude`).
- Fallback: geolokace zařízení (na vyžádání povolení).
- Fallback #2: žádné počasí (pouze placeholder a instrukce).

Implementace
- FE komponenta `WeatherWidget`:
  - zvolí lokaci (workplace → device geo → none).
  - fetch: `https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=4&timezone=Europe%2FPrague`
  - zobrazí 4 dny: den, ikona/stav (z weathercode), min/max, srážky.
  - caching: v localStorage (např. 30–60 min) + offline fallback na poslední data.
- Umístění: Today page (uvítací obrazovka) – nahoře pod pozdravem.

Testy
- `testing_agent_v3` – smoke (fetch může být mocked/skip, ale komponenta nesmí shodit stránku offline).

---

## 3) Další kroky (aktuální)
1. **Phase 7.1**: Fix horizontálního overflow na mobilu (globální ochrany + opravy viníků na Today/ostatních stránkách).
2. **Phase 7.2**: Responsivní úpravy pro tablet/desktop (klíčové stránky).
3. **Phase 7.3**: Jednoduchý režim → dlaždicový dashboard + velké akce.
4. **Phase 7.4**: Weather widget (Open-Meteo, 4 dny) podle polohy pracoviště / geolokace.
5. **Phase 6.4**: Dokončit vizuální ověření (Travel/Pauza/PDF) — stále potřeba.

---

## 4) Kritéria úspěchu
- Core flow end-to-end: docházka + zápisy (online/offline) → sync → vedení vidí data.
- Offline fronta drží data per účet; idempotentní sync neduplikuje.
- PDF exporty odpovídají šablonám a podporují duplex per zaměstnanec/týden.
- Přílohy se dají pořídit offline a exportují se v odpovídajících sekcích.
- Servisní upozornění fungují a interval servis po potvrzení resetuje odpočet.
- Integrita: historie revizí + hash-chain ověření viditelné v UI/PDF.
- Nepřítomnosti: dovolená = 2 kroky (vedoucí → jednatel), ostatní = vedoucí.
- Reporty: XLSX/CSV exporty fungují s filtry.
- Zaměstnanec: má vlastní přehledy a vlastní exporty.
- Docházka: pauza bez QR, travel A→B se počítá do práce, ale nefakturuje.
- **Phase 6:**
  - Plánované výjimky lze zadat a vedení je vidí.
  - RecordForm je výrazně jednodušší (sekce se zobrazují až po „ANO“).
  - Push notifikace fungují i při zavřené aplikaci (tam, kde to platforma dovolí).
- **Phase 7:**
  - Na mobilu nevzniká horizontální scroll (žádné posouvání do stran).
  - Tablet/desktop layout je komfortní (využitá šířka, rozumné gridy).
  - Jednoduchý režim je „dlaždicový“ a použitelný i pro velmi nezkušené uživatele.
  - Widget Počasí ukazuje min. 4denní předpověď dle pracoviště (fallbacky fungují offline i bez oprávnění).