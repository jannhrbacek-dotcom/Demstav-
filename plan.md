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
  - Přihlášení podporuje **username nebo e-mail** (demo: `jednatel`, `admin`, `vedouci`, `strojnik`, `spravce`).

- Offline-first:
  - Persistovaná **lokální fronta** na úrovni účtu (stabilní ID, idempotentní resend, detekce konfliktu přes `baseRevision`).

- Média / soubory:
  - Nahrávání příloh offline → následná synchronizace.
  - Sekce příloh: `general | service | timesheet` + exporty příloh.

- Servisní intervaly:
  - Default interval: **500 mth**, varování: **100 mth**.
  - Aktuální MTH: `max(machine.operating_hours, poslední mthEnd/mthStart ze zápisů)`.
  - Upozornění v aplikaci + (nově plánováno) **systémové push notifikace**.

- Integrita dat:
  - Revize v `record_versions`, **hash-chain** (SHA-256), včetně SHA příloh.
  - Ověření integrity přes API + zobrazení v UI + tisk do PDF deníku.

- UX docházky:
  - **Pauza bez QR** (tap) — `break_start/break_end` bez QR+GPS.
  - **Přejezd A→B**: `travel_start` udržuje stav „stále v práci“ (počítá se do odpracovaného času, ale **nefakturuje se**), příjezd na B vyžaduje QR+GPS.

- Konvence názvů strojů:
  - Primární štítek s číslem stroje: např. **L566/3**, **L576/7**.

- **Nově (Phase 6)**: 
  - **Plánované výjimky / zkrácené směny** (pozdní příchody / dřívější odchody) – zadává zaměstnanec, **bez schvalování**, viditelné vedení.
  - **Refaktor RecordForm** pro výrazně čistší UX (dropdown stroje + podmíněné sekce servis/přejezd).
  - **Push notifikace i při zavřené aplikaci**: nativní Web Push (VAPID) + subscription backend.
  - **Vizuální ověření** klíčových toků, které automatické testy plně nepokryly.

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
- Jednoduchý režim.
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
- Backend: `POST /api/stt` (Whisper-1, cs).
- Frontend: Dictation komponenta (offline: drží nahrávku a transkribuje po návratu online).

---

### Phase 5 — HR workflow + reporting + role/permissions + travel/pause ✅ IMPLEMENTOVÁNO (vizuální ověření pending)
> Phase 5 je funkčně hotová a prošla automatickými testy; část UI toků vyžaduje ruční vizuální kontrolu.

#### 5.1 Role model + username login ✅ HOTOVO
- Backend: `public_user` (username, position, role_group/label), `/auth/login` s `login` (username/email), index unikátnosti username.
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

### Phase 6 — Úkoly potvrzené uživatelem (Message 332) 🔜 PLÁNOVÁNO
Priorita byla potvrzena uživatelem v tomto pořadí:
1) **Plánované výjimky / zkrácené směny**, 2) **RecordForm refaktor**, 3) **Web Push (VAPID)**, 4) **Vizuální ověření**.

#### 6.1 Plánované výjimky / zkrácené směny (P1 → nyní priorita #1) ⏳
Cíl
- Zaměstnanec zadá plánovanou výjimku: **pozdní příchod** / **dřívější odchod** (případně obecný důvod: dítě/úřad apod.).
- **Bez schvalování**: je to oznámení, ale musí být viditelné vedení.
- Zobrazit v přehledu zaměstnanců (Vedoucí/Jednatel), ideálně i v detailu zaměstnance / denním přehledu.

Návrh datového modelu
- Kolekce: `planned_exceptions`
  - `{ id, user_id, user_name, date, kind: late_arrival|early_departure|other, time_from?, time_to?, minutes?, reason, created_at, updated_at }`

Backend
- Endpoints:
  - `POST /api/exceptions` vytvoření výjimky (idempotentně dle `id`).
  - `GET /api/exceptions?mine=1|0&date_from&date_to&employee_id` výpis.
  - (volitelně) `DELETE /api/exceptions/{id}` pro smazání vlastní výjimky v rámci dne.
- Validace:
  - datum ISO, čas HH:MM, smysluplnost rozsahu, limit délky textu.
  - oprávnění: zaměstnanec může CRUD jen svoje; vedení vidí vše.

Frontend
- Nová stránka: např. `/vyjimky` nebo integrace do `/dochazka` (sekce „Plánované výjimky“).
- Formulář:
  - Datum, typ (pozdě/předčasně), čas (nebo minuty), důvod.
  - Seznam „Moje výjimky“ + možnost odstranění.
- Vedení:
  - Přehled v `/prehled` (např. count a seznam pro zvolený den/týden), nebo v uživatelském přehledu.

Testy
- Backend: unit test endpointů + oprávnění.
- Frontend: základní render + submit (smoke).

#### 6.2 Refaktor UI/UX formuláře zápisu (RecordForm) (P0, priorita #2) ⏳
Cíl (konkrétně dle požadavků)
1. **Stroj jako dropdown** (Select) místo volného inputu (ponechat možnost rychlého psaní vyhledávání).
2. **Ano/Ne otázka** před zobrazením sekcí:
   - „Prováděl jsem servis?“ → teprve pak zobrazit servisní část.
   - „Měl jsem přejezd A→B?“ → teprve pak zobrazit přejezdové intervaly.
3. **Servis přesunout nahoru** – hned pod otázku (ne jako sekce 6 na konci).
4. Přidat volbu servis provedl: **„strojník včetně dílny“**.
5. **Omezení 500 mth (interval) servisu**:
   - Povolit pouze: role/pozice **mechanik**, nebo servis aktor **externí servis**, nebo konkrétní uživatel **Jan Hrbáček**.
   - Pozn.: uživatel v odpovědi potvrdil VAPID cestu pro push; u 500 mth se objevily vícenásobné volby – implementace bude podle zadání: **mechanik + externí servis + Jan Hrbáček** (a explicitně to v UI vysvětlit).

Implementace (frontend)
- Úpravy `RecordForm.jsx`:
  - Předělat výběr stroje na `Select` z `/machines`.
  - Přidat state `hasService` / `hasTravel` (např. boolean toggles) a podle toho renderovat IntervalEditor pro `service`/`travel`.
  - Přeskládat sekce (servis blok přesunout výše).
  - Rozšířit `serviceBy` možnosti (včetně „strojník včetně dílny“).
  - Vynutit pravidla pro `intervalService` checkbox:
    - Pokud uživatel nemá oprávnění, checkbox zobrazit disabled + tooltip/text proč.

Backend (pokud bude potřeba)
- Doplnit server-side validaci při confirm:
  - Pokud `intervalService=true`, ověřit oprávnění (pozice mechanik / serviceBy external / jméno Jan Hrbáček).
  - Jinak vrátit 403/400 s jasnou hláškou.

Testy
- Frontend: komponentové/smoke testy, případně e2e flow „nový zápis“.

#### 6.3 Push notifikace (P0, priorita #3) ⏳
Cíl
- Notifikace fungují **i při zavřené aplikaci** (PWA), minimálně pro servisní upozornění a případně pro management eventy (později).

Technická volba (potvrzeno uživatelem)
- **Nativní Web Push** s **VAPID klíči** (bez Firebase).

Návrh implementace
- Backend:
  - Generace/konfigurace VAPID: env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
  - Kolekce `push_subscriptions`: `{id, user_id, endpoint, keys, user_agent, created_at, last_seen_at}`.
  - Endpoints:
    - `POST /api/push/subscribe` uloží subscription (idempotentně).
    - `POST /api/push/unsubscribe` odebere.
    - (interně) utilita pro odeslání notifikace přes web-push.
  - Job/triggery:
    - Na serveru periodicky (nebo při login/overview) kontrola `service-alerts` a odeslání notifikace.

- Frontend:
  - UI ve „Více“ / nastavení: tlačítko „Zapnout upozornění“.
  - Registrace service workeru + `PushManager.subscribe` s public VAPID key.
  - Odeslání subscription na backend.

- Service Worker (`/frontend/public/sw.js`):
  - Přidat `push` handler: `self.addEventListener('push', ...)` → `showNotification`.
  - `notificationclick` už existuje – zachovat.

Poznámky
- Vyžaduje HTTPS v produkci.
- iOS podpora web push je omezená dle verze – otestovat cílová zařízení.

Testy
- Backend: unit test subscribe endpoint.
- Manuální: Chrome/Android – subscribe + doručení.

#### 6.4 Vizuální ověření (priorita #4) ⏳
Cíl
- Ručně/screenshotově ověřit toky, které automatické testy nemohly plně zvalidovat:
  - Travel A→B UI flow (docházka).
  - Pauza bez QR (jen když je uživatel ve stavu „pracuje“).
  - Vizuální kontrola PDF exportů:
    - `/api/exports/sichtovnice.pdf`
    - `/api/exports/denik.pdf`

Výstup
- Krátký checklist + screenshoty / poznámky, zda odpovídá šablonám.

---

## 3) Další kroky (aktuální)
1. **Phase 6.1: Plánované výjimky / zkrácené směny** (zaměstnanec bez schvalování) — implementace BE+FE + základní testy.
2. **Phase 6.2: RecordForm refaktor** (dropdown stroje, Ano/Ne gating, servis sekce nahoru, servis provedl + restrikce 500 mth) + FE testy; doplnit BE validaci pro `intervalService`.
3. **Phase 6.3: Push notifikace** (Web Push + VAPID) — BE endpoints + SW push handler + UI opt-in.
4. **Phase 6.4: Vizuální ověření** — ruční průchod a kontrola PDF.

---

## 4) Kritéria úspěchu
- Core flow end-to-end: docházka + zápisy (online/offline) → sync → vedení vidí data.
- Offline fronta drží data per účet; idempotentní sync neduplikuje.
- PDF exporty odpovídají šablonám a podporují duplex per zaměstnanec/týden.
- Přílohy se dají pořídit offline a exportují se v odpovídajících sekcích.
- Servisní upozornění fungují a interval servis po potvrzení resetuje odpočet.
- Integrita: historie revizí + hash-chain ověření viditelné v UI/PDF.
- Nepřítomnosti: dovolená = 2 kroky (vedoucí → jednatel), ostatní = vedoucí; bez self-approval.
- Reporty: XLSX/CSV exporty fungují s filtry.
- Zaměstnanec: má vlastní přehledy a vlastní exporty.
- Docházka: pauza bez QR, travel A→B se počítá do práce, ale nefakturuje.
- **Nově**:
  - Plánované výjimky/zkrácené směny lze zadat a vedení je vidí.
  - RecordForm je výrazně jednodušší (sekce se zobrazují až po „ANO“).
  - Push notifikace fungují i při zavřené aplikaci (tam, kde to platforma dovolí).