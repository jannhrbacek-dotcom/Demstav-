# DEMSTAV Operations — audit logiky a UX/UI

Datum: 28. 10. 2026, časové údaje pro uživatele v Europe/Prague.
Zdroj auditu: `main-2`, commit `a16b30993a70620a6708c2417fdb09e3e6effc81`.
Pracovní větev: `audit/operations-20261028`. Audit nemění aplikační kód ani produkční data.

## A. Skutečný stav a rozsah ověření

**Závěr: základ aplikace existuje a běžné regresní testy procházejí, ale aplikace není připravena k označení za ověřený podklad pro konečné týdenní předání.** Byly reprodukovány chyby hodin, exportů, oprávnění a ztráty novější úpravy při synchronizaci. Nejdříve opravit integritu dat a teprve poté zjednodušovat pracovní postup.

Značky důkazů:

- **T** — spuštěný izolovaný test nad skutečným modulem, s paměťovou náhradou DB/HTTP. Není to produkční E2E.
- **K** — přímá kontrola zdrojového kódu; není to vizuální ani živý test.
- **H** — skutečný HTTP požadavek bez přihlášení nebo metadata poskytovatele.
- **N** — neověřeno; konkrétní navazující test je uveden níže.

### Nasazení

| Prostředí | Skutečně zjištěno | Co to nedokazuje |
|---|---|---|
| [Render Operations](https://demstav-operations.onrender.com) | Služba `srv-dbg4a0ivcj2c73b4ht30`, Docker, Frankfurt, `main-2`, automatický deploy vypnutý. Deploy `dep-dbgcsn8m7kps73c2lc70` je `live`, commit `e8078db1021baacc42b60a778494a29cc498b380`. `/api/ready` → 200 JSON `{"ok":true}`, `/` → 200 HTML. | Neověřuje všechny role, správnost uložených dat ani kompletní proces směny. |
| GitHub `main-2` | HEAD `a16b309`. Rozdíl proti živému Render commitu tvoří pouze `GEMINI.md` a dvě předávací dokumentace (205 přidaných řádků). | Novější SHA samo o sobě neznamená jinou verzi aplikační logiky. Kontrolovaná aplikační logika odpovídá zdroji živého Render deploye. |
| [Vercel hlavní adresa](https://demstav-jan-hrbaceks-projects.vercel.app) | `/` i `/api/ready` → 404. Projekt `demstav` má `live=false`. | Není potvrzeným alternativním provozem. |
| [Vercel main-2 preview](https://demstav-git-main-2-jan-hrbaceks-projects.vercel.app) | Poslední build `dpl_BCwuwdsa89ii5qht3tz8YJuSqxkg`, `READY`, `target=null`, zdroj `a16b309`. `/api/ready` → 200 **HTML**, nikoli API. Stažený JS `main.a3f707c1.js` používá prázdný backend origin a `/api` na stejné doméně. | Build prošel, ale spojení s FastAPI není funkčně doloženo; zde je konkrétní nesoulad routování/API. |
| Další Render služba `Demstav-` | Existuje samostatně na `demstav.onrender.com`, Node runtime s Python příkazy, health path `/healtz`, autoDeploy zapnutý. | Není to služba Operations. Její dostupnost ani účel nebyly ověřeny. Neměnit ji při opravách Operations bez samostatné kontroly. |
| MongoDB / soubory | Poskytovatel uvádí privátní `demstav-mongo` a trvalé disky DB i souborů. | Nebyla čtena živá DB, inventarizována osobní data, ověřena záloha ani obnova. Trvalý disk není důkaz zálohy. |
| Plánovač | Ve vráceném seznamu Render služeb nebyl cron. Existuje pouze aplikační cron endpoint. | Externí plánovač mimo Render nelze tímto vyloučit. Jeho běhy/doručení zůstávají N. |

Render logy s explicitním rozsahem 28. 10. 00:00–11:55 UTC a filtrem `error` vrátily nula položek. Starší dotaz vrátil historické chyby indexu `email_1` z 27. 10.; nelze je vydávat za dnešní závadu. Prázdný výsledek logů není potvrzení bezchybnosti aplikace.

V prohlížeči byla skutečně otevřena a vizuálně zkontrolována pouze nepřihlášená stránka `/login` na Renderu, na desktopovém viewportu 1363 × 936. Formulář je čitelný, vstupy a hlavní tlačítko jsou velké. **Žádný přihlášený průchod zaměstnance, vedoucího ani jednatele a žádná kontrola šířek 320–428 px nebyly provedeny.** Nebyly k dispozici izolované účty/staging pro tyto průchody. Závěry k ostatním obrazovkám níže jsou K, nikoli screenshoty či mobilní E2E.

### Ověřené testy

| Kontrola | Výsledek |
|---|---|
| Pět cloud/backend sad + `backend/tests/unit/test_production.py` | **53 passed**, 16 warnings |
| `CI=true npm test -- --watchAll=false --runInBand` | **5 sad, 10 passed** |
| `npm run build` | Úspěch, JS 432,17 kB gzip, CSS 12,35 kB gzip; upozornění na chybějící source mapy závislosti skeneru QR a deprecation Node, viz lokální build log. Není to měření rychlosti na telefonu. |
| Nová sada `tests/test_audit_operations_20261028.py` | **1 passed, 10 xfailed** (`strict=True`). XFAIL označuje očekávané selhání dosud neopraveného požadavku. |
| Tatáž sada s `--runxfail` | **10 failed, 1 passed**. Všechny závady selhaly na očekávaném tvrzení, nikoli na chybějící závislosti. |
| `node tests/audit_sync_20261028.cjs` | **AUD-11 reprodukován**: novější text ztracen, odeslán dvakrát starý text, fronta prázdná. Používá skutečný `sync.js` s nahrazeným úložištěm a HTTP. |
| Záměrně souběžné uložení záznamu | Namísto 409 vznikl `DuplicateKeyError` při vložení druhé revize; oba zápisy předtím prošly kontrolou původní revize. |
| Závěrečný společný běh backendu včetně auditu | **54 passed, 10 xfailed**, 16 warnings. |

První spuštění Python testů zastavil chybějící `pytest-xdist`. Byl doplněn pouze do dočasného testovacího prostředí; nastavení projektu se neměnilo. Nová auditní sada zatím není součástí explicitního seznamu testů ve stávajícím CI workflow. Zelené stávající CI tedy neznamená opravu těchto nálezů.

Reprodukce ze složky repozitáře:

```bash
python -m pytest tests/test_cloud_deployment.py tests/test_push_config.py tests/test_attendance_verification.py tests/test_operations_breaks.py tests/test_production_api.py backend/tests/unit/test_production.py -q
python -m pytest tests/test_audit_operations_20261028.py -q -rx
python -m pytest tests/test_audit_operations_20261028.py --runxfail -q --tb=short
node tests/audit_sync_20261028.cjs
```

Použity cloud requirements, httpx 0.28.1, pytest 8.4.2, pytest-asyncio 1.2.0, mongomock-motor 0.0.36 a pytest-xdist. Žádné nové testy nevyžadují ostrou DB, serverový startup ani produkční přihlášení. Po opravě odstranit příslušný XFAIL a ponechat test jako běžnou regresi.

### Mapa návazností

| Tok | Implementace | Stav |
|---|---|---|
| Denní formulář → lokální zápis → API → revize | `RecordForm.jsx::doSave` → `sync.js::saveRecordLocal/sendOp` → `PUT /records/{rid}` → `records` + `record_versions` | T/K; ztráta novější úpravy a souběh revizí viz AUD-05/11. |
| Záznamy → součet osobního dne | `worktime.py::day_union`, `routes_data.py::my_summary`, `server.py::overview` | Základní denní překryv T; noční více strojů chybně. `Today.jsx` používá jiný, prostý součet. |
| Záznamy → PDF / XLSX / CSV | `server.py::_export_records`, `exports.py`, `routes_data.py::timesheet_rows/machine_log_data` | Generátory existují, rozdíly v obsahu a přestávkách potvrzeny testy. |
| Týden → archiv → převzetí | `generate_week` → `demstav/weekly/{week}` → `weekly_exports` | Archiv existuje; revize balíku, doručení a převzetí chybí. |
| Docházka → čistá doba | `routes_attendance.py::projection`, `break_policy.py` | QR/GPS validace a automatické pauzy pokryty testy; skutečný telefon N. |
| Žádost o změnu pauzy → výpočet | `routes_breaks.py` → `hydrate_records/hydrate_events` | T; historický zdrojový hash se nemění. Strojní XLSX tuto hydrataci vynechává. |
| Stroj → MTH → servis | `machinePrefill.js`, `routes_records.py`, `routes_users.py::machines_with_status` | MTH nejsou přičítány k hodinám; validace extrémů a pravomoci servisu vadné. |
| Lístky → společná tonáž | `Production.jsx` → `saveProduction` → `routes_production.py` → `production.py` | Odděleno od osobních hodin; zůstávají dvě tonážní pravdy a možnost více hlášení. |
| Absence → rozhodnutí → oznámení | `Absence.jsx`, `routes_leave.py`, `routes_push.py`, `sw.js` | Žádosti a stavy existují; oznámení finálnímu schvalovateli v mezikroku chybí; reálný push N. |

## B. Vyhodnocení podkladů Gemini a nálezy

`GEMINI.md`, `GEMINI_HANDOFF_2026-10-28.md` i `GEMINI_AUDIT_LOGIKA_UX_UI_2026-10-28.md` byly přečteny. Druhý a třetí dokument výslovně představují **předání a zadání**, nikoli hotové závěry nezávislého auditu Gemini. V předaných podkladech ani komentářích kontrolovaných issues nebyl dodán samostatný výsledek Gemini. Nemohu proto tvrdit, že jsem porovnal jednotlivé závěry externího auditu. Níže porovnávám doložená tvrzení předání se skutečným kódem.

| Tvrzení / požadavek | Vyhodnocení |
|---|---|
| Správná větev je `main-2`, nikoli default `main` | Potvrzeno GitHubem i Renderem. |
| Jednoduchý režim zatím není skutečně jednoduchý formulář | Potvrzeno K; CSS zvětšuje ovládání a část polí skrývá, hlavní formulář má stále 10 sekcí. |
| Týdenní generátor a archiv existují, doručení není prokázáno | Potvrzeno K/H; navíc přepisování archivu a zahrnování konceptů. |
| Tonáž má být jeden automatický součet po směně | Stávající implementace tomu neodpovídá; T. |
| Jízda znamená osobní dobu i pro spolujezdce | Zadání potvrzeno, implementace je v přímém rozporu: formulář ji popisuje jako číslo, například počet osob. |
| Více strojů a vlastní MTH jsou podporovány | Částečně ano; existuje další zápis pro další stroj, předvyplnění odděluje stroje. Noční součet není správný. |
| Počasí, kalendář a průvodce chybějí | Takový obecný závěr by byl nesprávný: implementace existují. Chybějí konkrétní části, viz C. |
| Push neexistuje | Nesprávné jako obecné tvrzení: infrastruktura včetně SW je v `main-2`; skutečné doručení a mezikrok mají mezery. |
| OCR / Android jsou hotové | Nedoloženo a kód tomu neodpovídá. Import je JSON, nikoli OCR; není Android projekt ani ověřený APK/AAB. |

Otevřené issues #5, #6, #7 a #17–#23 byly načteny včetně komentářů (vrácené komentáře byly prázdné). Dva otevřené draft PR: [#2](https://github.com/jannhrbacek-dotcom/Demstav-/pull/2) míří do `main`, [#3](https://github.com/jannhrbacek-dotcom/Demstav-/pull/3) do `staging/cleanup-preview-20261027`. Ani jeden nelze slepě sloučit do provozní větve. Část push funkcí z #2 už ve větvi existuje; bezpečnější je přenést jen prověřenou opravu pravomoci servisu. #3 není nasazenou náhradou globálního mazání.

### Seznam závad podle závažnosti

P0 = riziko ztráty dat, chybných hodin nebo úniku oprávnění. P1 = blokující či zásadně neúplný provoz. P2 = výrazné UX/konzistenční nedostatky. Priorita není tvrzení, že k incidentu již došlo v produkci.

| ID / priorita / důkaz | Reprodukce a skutečnost proti očekávání | Důkaz v kódu | Návrh opravy, test, riziko dat / vazba |
|---|---|---|---|
| **AUD-11 P0 T** | Odeslat úpravu A, během pomalé odpovědi uložit B. Odpověď A přepíše lokální B; další operace odešle A a fronta se vyprázdní. Očekáváno zachování B. | `frontend/src/lib/sync.js:52`, `:135`; reprodukce `.cjs` | Každá operace musí mít neměnný snapshot. Odpověď aplikovat jen k odpovídajícímu lokálnímu opId, novější úpravu zachovat a posunout základní revizi. Test pomalé sítě, dvojího kliknutí, restartu. Bez migrace, vysoké riziko ztráty při současném stavu. Nový samostatný úkol. |
| **AUD-05 P0 T** | Dva zápisy se stejnou baseRevision projdou kontrolou; `replace_one({id})` přepíše stav a druhá historie narazí na unikátní index, namísto řízeného 409. | `backend/routes_records.py:288–346` | Atomický compare-and-swap a konzistentní commit snapshotu/historie. Mongo topologie je standalone: nepředpokládat dostupnou vícedokumentovou transakci. Navrhnout obnovitelný protokol operace nebo jiný kompatibilní způsob; test s reálným Mongo a pádem mezi zápisy. Vyšší implementační riziko, historické revize nemigrovat automaticky. |
| **AUD-04 P0 T** | Opakování známého record ID + opId pod jiným zaměstnancem vrátí cizí záznam: větev `duplicate` předchází kontrole vlastníka. Vyžaduje znalost obou ID; plošný únik nebyl prokázán. | `backend/routes_records.py:295–304` | Kontrolovat právo před každou odpovědí, včetně retry. Test A/B pro PUT, GET, verze, přílohy i konflikty. Bez změny dat; nový bezpečnostní úkol. |
| **AUD-01 P0 T/K** | `drive="0:45"` server odmítne. Formulář odstraňuje dvojtečku a uvádí „např. počet osob ve vozidle“. Chybí role řidič/spolujezdec a stav čipování. | `routes_records.py:91`, `RecordForm.jsx:312`, `exports.py:275` | Přidat jednoznačnou osobní dobu v minutách, zobrazení H:MM, roli a čipování „neověřeno“. Staré číslo bez znalosti významu **nepřevádět automaticky**. Oddělit přesuny mezi zakázkami od osobní jízdy. Dvě osoby, dvě SPZ, 0:00 vs chybí; #22, střední kompatibilitní riziko. |
| **AUD-02 P0 T** | Dva stroje stejného dne 22:00–02:00 a 01:00–03:00 dávají union **6 h**, očekáváno **5 h**. Každý záznam má vlastní půlnoční kotvu. | `backend/worktime.py:141` | Společná časová osa směny přes více strojů, stejné řešení na FE. Nutné určit datum noční směny a testovat pauzy druhého dne a přechod času. Neprovádět hromadný přepočet historie; #22. |
| **AUD-07 P0 T** | Po schválení dne bez pauzy 06–17 dává strojní XLSX **10 h**, očekáváno **11 h**. | `routes_data.py:297`, chybí `hydrate_records` | Hydratovat stejně jako PDF/timesheet; test obsahových hodnot všech exportů a změny pauz. Bez migrace; #22. |
| **AUD-06 P0 T** | Lístky 10,5 + 20 t, ruční `tonnes=99` → výkaz nese 99, `ticket_total=30.5`; rozdíl je možné vysvětlit poznámkou. | `backend/production.py:8`, `Production.jsx:81` | Jediná odvozená suma kompletních lístků; neúplný výkaz ponechat koncept. Korekce pouze auditovanými položkami. Historické rozdíly zachovat a označit k revizi, ne přepsat. #5/#6. |
| **AUD-12 P0 K** | Rozepsat denní formulář a obnovit stránku/odejít před Uložit → stav je jen `useState`, průběžný lokální koncept se neukládá. | `RecordForm.jsx:93–195` | Debounce autosave do lokálního konceptu po účtu a záznamu; atomický zápis, obnova a viditelný stav. Test restartu, kvóty, offline a přepnutí účtu; #20. Browser reprodukce zatím N. |
| **AUD-13 P0 K** | Servis Ano → vyplnit → Ne → Ano odstraní intervaly/popisy/servisní metadata; přejezd obdobně. Není potvrzení ani undo. | `RecordForm.jsx:173–182` | Oddělit viditelnost a obsah, smazání samostatnou potvrzenou akcí. Skrytá data nesmějí být potichu smazána ani započtena chybně. Komponentový test a mobilní průchod; #20. |
| **AUD-14 P0 K** | Globální `POST /admin/wipe-data` je v routeru, po heslu a frázi maže celé kolekce i historii bez ověřené zálohy. Má i nesoulad pole `path` proti `storage_path` a nepokrývá nové kolekce produkce/pauz. | `routes_admin.py:38–85`, `server.py::include_router` | Zablokovat globální operaci v produkci; případný selektivní postup převzít po revizi #3, s ověřenou obnovou, úplnými závislostmi a auditem. **Endpoint nebyl volán.** Nejde o anonymní mazání bez hesla. |
| **AUD-15 P0 K** | Znovu generovat stejný týden → stejné cesty souborů i upsert metadat, původní balík se přepíše. | `routes_data.py:414–467` | Neměnný exportId/verze, manifest zdrojových revizí a pauz, hash, vazba na přijatou verzi. Pozdní oprava vytvoří novou verzi. #22, kompatibilní rozšíření; obnova historických přepsaných balíků vyžaduje zálohy. |
| **AUD-03 P1 T** | Běžný strojník zvolí externí firmu a získá právo potvrdit intervalový servis, který pak posune termín servisu stroje. | `routes_records.py:17–31`, `:352–359` | Oprávnění odvozovat od účtu/pověření, nikoli volby formuláře nebo jména. Oprava obsažena částečně v PR #2; přenést izolovaně. Test všech pozic/rolí a původního termínu. Bez hromadné změny servisních hodnot. |
| **AUD-08 P1 T** | XLSX/CSV šichtovnice nemají osobní jízdu ani SPZ, ačkoliv PDF je čte. | `routes_data.py:65–104` | Společné výstupní schéma s osobní jízdou, SPZ a správným rozlišením MTH; porovnání obsahu PDF/XLSX/CSV. #22. |
| **AUD-09 P1 T/K** | Nepověřený zaměstnanec může založit výkaz; `responsible_ids` slouží jen jako připomínka. Dvě osoby mohou založit různá ID pro stejnou posádku/směnu. Duplicitní fotografie jiného ID projdou. | `routes_production.py:46`, `production.py` | Serverové pověření a identita společné směny, řízený zástup; deduplikace čísla lístku/hash souboru s možností revize. Zamezit dvěma finálním součtům. #5/#6, nutná kontrola existujících duplicit bez mazání. |
| **AUD-10 P1 T/K** | Potvrdit 1000 MTH za běžnou směnu lze bez varování. `machines_with_status` navíc bere maximum i z konceptů, a předvyplnění může číst budoucí/konceptové zápisy bez varování. | `routes_records.py::validate_record`, `routes_users.py:206`, `machinePrefill.js` | Varování/kontrola nerealistického rozdílu a návaznosti konkrétního stroje, stav „ke kontrole“, oddělení potvrzených a nepotvrzených hodnot; uchovat ruční údaj a původ. Test více strojníků, přejmenování stroje, konceptu s chybným extrémem. |
| **AUD-16 P1 K/H** | `generate_week` nevyžaduje potvrzené záznamy ani úplnost týdne. Skupiny PDF vznikají jen z deníků; týden dovolené bez deníku nedostane vlastní PDF. Chybí workflow převzetí a doložený plánovač. | `routes_data.py:65`, `:414`, `Exports.jsx` | Nejprve validace/uzávěrka a přehled absencí, potom verzovaný balík, adresný příjemce, převzetí a audit, teprve nakonec scheduler s opakováním a monitoringem. #22. Text „Každé pondělí v 5:00“ není důkaz. |
| **AUD-17 P1 H** | Vercel hlavní URL 404; preview má stejnooriginové `/api`, které vrací HTML. | HTTP + stažený JS, `frontend/src/lib/api.js` | Rozhodnout účel Vercelu; zkontrolovat build env/rewrites a backend CORS podle cílové architektury. Nepřepínat zaměstnancům URL bez E2E. Změna nastavení až po kontrole. |
| **AUD-18 P1 K** | Dovolená manager → pending_director: kód upozorní žadatele, ale neposílá nové oznámení finálním schvalovatelům. | `routes_leave.py:114–147` | Přidat adresné oznámení druhého kroku, deduplikaci, doručovací stav a retry; skutečné Android/iPhone testy. #19. Nezaměňovat odeslání push za doručení. |
| **AUD-19 P1 K** | Dnes sčítá hodiny z jednotlivých strojů, vedení/PDF používá union. Překryv 06–13 a 12:30–17 může na Dnes nadhodnotit osobní den. | `Today.jsx:41`, `worktime.py::day_union` | Sdílet union na FE/BE a viditelně upozornit na překryv. Test stejných vstupů na Dnes, přehledu a PDF. #20/#22. |
| **AUD-20 P2 K** | Jednoduchý režim skrývá část kapaliny/příloh CSS, ale nesnižuje počet hlavních sekcí. Skrytá pole zůstávají v paměti; to samo o sobě není ztráta dat. | `index.css:79–92`, `RecordForm.jsx` | Přestavět pořadí a progresivní odhalování podle C, zobrazit počet vyplněných skrytých údajů. #20. |
| **AUD-21 P2 K** | Vedení má počet žádostí, ale nemá na dashboardu úplný přehled nepřítomných a stavu odevzdání týdne. Kalendář obsahuje schválené absence a výjimky, nikoli celý plán směn/pracovišť a čekajících žádostí. | `server.py::overview`, `Overview.jsx`, `TeamCalendar.jsx`, `routes_exceptions.py` | Dnešní absence + ke schválení + stav týdnů, role filtry; citlivé poznámky nevystavovat týmu. #21. |
| **AUD-22 P2 K** | Cache počasí ukládá čas, ale `readCache` ho ignoruje; TTL konstanta se nepoužívá. Offline může stará předpověď působit aktuálně. | `WeatherWidget.jsx:15`, `:55`, `:157` | Zobrazit stáří/platnost a offline stav, po expiraci neoznačovat jako aktuální; test cache a chyby zdroje. |
| **AUD-23 P2 K/N** | Sekce nemají `aria-expanded/controls`. Detail má pevný první sloupec 150 px, tabulky mají mnoho sloupců a pevná spodní ukládací lišta může kolidovat s klávesnicí. | `Section.jsx:4`, `RecordDetail.jsx::Row`, `RecordForm.jsx:462`, `MyOverview.jsx` | Doplnit sémantiku, na mobilu karty a popisky nad hodnotou; ověřit klávesnici/fokus/safe-area a 200% text. Přetékání či zakrytí na konkrétním telefonu zatím **N**, nikoli potvrzený screenshotový nález. |

P3 kosmetické vady zde nejsou samostatně potvrzeny. Prioritou není přebarvování aplikace.

### Další kontroly, které nesmějí být zaměněny za potvrzené závady

- Docházková `projection` standardně zahrnuje i `pending_review`; je nutné odlišit pracovní náhled od schváleného mzdového/exportního výsledku. Reálný dopad na schvalované výkazy vyžaduje navazující test.
- Rozhodnutí o docházce používá méně přísnou ochranu souběhu než žádosti o pauzu. Otestovat dvojí schválení/zamítnutí; vlastník má navíc výjimku pro schvalování vlastní docházky. Potvrdit, zda je to záměrná firemní pravomoc.
- `timesheet_rows` obsahuje řádky jednotlivých strojů; jejich prostý součet není při překryvu osobní denní union. XLSX musí výslovně odlišit strojní řádky a osobní součet.
- PDF při chybě přílohy vloží textové upozornění místo blokace; společný tonážní PDF export naopak chybějící podklad blokuje. Pro finální balík zavést jednotnou kontrolu úplnosti.
- Společný výkaz má PDF, ale chybí požadovaný tabulkový XLSX/CSV a potvrzení odběratele v auditované podobě dle #5. Neplést jméno odběratele s ověřeným podpisem.
- Rozsah pravomocí vedoucího provozu je vědomě vysoký (rank jako owner); není automaticky chybou. Matice musí samostatně potvrdit kdo smí opravovat cizí deníky, spravovat účty a finálně schvalovat dovolenou.
- Kontrola repozitáře nebyla specializovaným úplným skenem tajemství či penetračním testem. Žádné známé heslo nebylo použito k pokusu o produkční přihlášení.

## C. UX/UI — návrh pro telefon a jednotlivé role

Všechny následující body kromě popsaného přihlášení jsou výsledkem **kontroly zdrojů**. Přečteny byly cesty a komponenty Dnes, nový zápis, seznam/detail, osobní přehledy, docházka, absence, týmový kalendář, tonáž, exporty, přehled vedení, kontrola, fronta, průvodce, Více, stroje, pracoviště a uživatelé. Pro některé správní stránky byla provedena cílená kontrola API vazeb, rolí a layoutu, nikoli každý interaktivní stav.

| Role | Doporučená mobilní navigace | Úvodní obsah |
|---|---|---|
| Zaměstnanec | Dnes · Moje zápisy · Docházka · Více. Chybová fronta přes výrazný mráček a banner; chyba nesmí být skryta. | Stav příchodu → velké „Zapsat práci“ → rozepsaný zápis → stav odeslání. Volno/nemoc jako přímá akce. Počasí kompaktně níže. |
| Vedoucí | Přehled · Ke kontrole · Tým · Více; zachovat přístup k vlastní docházce a deníku. | Nejdříve co dnes vyžaduje rozhodnutí, nepřítomní, chybějící/konfliktní záznamy, STOP/servis, stav týdnů. |
| Jednatel | Přehled · Ke schválení · Týdenní výkazy · Více. | Finální dovolené, předané balíky s verzí a tlačítkem Převzít, souhrny hodin a tonáže zvlášť. Správu účtů dát do Více. |

**Denní formulář před změnou:** identifikace a doprava, servis Ano/Ne, přejezd Ano/Ne, teprve poté pracovní čas/popisy a MTH, další kontroly/závady/kapaliny/předání/přílohy; deset sekcí a dvě pevné spodní lišty.

**Po změně v existující obrazovce:**

1. Datum (dnes předvyplněné), stroj, pracoviště; poslední relevantní hodnoty s uvedením zdroje.
2. Pracovní čas a přehled automatických pauz; popis práce; MTH začátek/konec. Docházku ukázat pro porovnání, nekopírovat ji bez potvrzení jako dobu stroje.
3. Velké volby „Měl jsem servis“, „Měl jsem přejezd“, „Nahlásit závadu“. Rozbalení nezničí obsah. Při skrytí vyplněných údajů zobrazit jejich počet a souhrn.
4. „Další údaje“: osobní jízda, řidič/spolujezdec, SPZ, kapaliny, doklady a předání. Povinné údaje zůstávají dosažitelné i v jednoduchém režimu; před odevzdáním vyžádat kontrolu jízdy a čipování.
5. Oddělit průběžné „Uloženo v telefonu“ od „Potvrdit a odeslat“ a „Přijato serverem“. Volba „Přidat další stroj“ zachová den a pracoviště, nikoli MTH/čas předchozího stroje.

**Společná tonáž:** zobrazovat pověřeným a jako úkol „Po skončení směny sečíst vážní lístky“. Jeden výkaz směny, velké Přidat fotografii/PDF, kontrola jednotlivých vah a nepřepisovatelný celkový součet. Všichni zaměstnanci nemají každý den odpovídat, kdo právě vede tonáž, pokud už pověření/hlášení existuje.

**Další konkrétní změny:**

- Seznamy zápisů zachovat jako karty; doplnit návrat do rozepsaného konceptu a viditelný stav konfliktu. Detail na 320 px jako popisek nad hodnotou, historie až za hlavními údaji.
- Osobní přehled: nejprve denní souhrn H:MM, pod ním stroje s vlastními MTH. Široká tabulka až na vyžádání/desktopu. Nedělat z MTH sumu pracovní doby člověka.
- Absence: zachovat rychlé typy, vedoucím přidat filtry kdo/termín/stav a odlišit čekající/schválené textem i ikonou. Tým nesmí dostat diagnózu ani soukromou poznámku.
- Exporty: nejprve „Můj týden“ / „Týden týmu“, kontrola úplnosti, teprve potom formát a pokročilé filtry. Uvést přesně, které filtry platí pro které PDF/XLSX; současné volby nejsou mezi formáty jednotné.
- Fronta: zachovat podmíněné zobrazení (již implementováno), u konfliktu ukázat obě verze a bezpečné obnovení. Obecný úspěšný toast nesmí zakrýt nevyřešenou operaci.
- Průvodce existuje a lze ho přeskočit/otevřít znovu. Doplnit osobní jízdu a čipování spolujezdce, pravidlo tonáže po směně a odevzdání/převzetí týdne. Nevysvětlovat jako hotovou funkci dosud neimplementované doručení.
- Počasí už má čtyři dny a hodinovou osu; nedělat z toho znovu nový modul. Doplnit stáří dat a chybu i při zobrazené cache.
- Stroje/pracoviště/uživatelé: ponechat správní formuláře v sekundární navigaci vedení; prioritu mají přehledné stavy, přiřazení a řízené změny oprávnění. Nepřidávat další vstupní povinnosti strojníkům.

## D. Plán oprav a ověření

| Pořadí | Izolovaný návrh větve/PR do `main-2` | Závislosti a akceptace | Riziko / návrat |
|---|---|---|---|
| 1 | `fix/audit-record-access` (AUD-04), `fix/audit-disable-global-wipe` (AUD-14), `fix/audit-service-permission` (AUD-03) | A/B role testy včetně retry; žádné mazání. Přesně přenést část #2, nepřepisovat novější `main-2`. | Nízké datové riziko, bez migrace. Návrat kódu by znovu otevřel závadu, proto preferovat opravu vpřed. |
| 2 | `fix/audit-durable-sync` (AUD-11), `fix/audit-record-concurrency` (AUD-05), `fix/20-draft-preservation` (AUD-12/13) | Neměnné operace, konzistence historie, obnova po pádu, žádná ztráta lokálních konceptů. Samostatné testy reálného IndexedDB a Mongo. | Střední/vyšší; při změně formátu fronty záloha lokálního stavu a zpětně kompatibilní čtečka. |
| 3 | `fix/22-time-and-export-consistency` (AUD-02/07/08/19), `fix/22-personal-journey` (AUD-01) | Nejprve firemní význam dne/noční směny a pravidlo osobní jízdy; stejné výsledky FE/BE/PDF/XLSX/CSV. | Bez tichého přepisu historie. Nová pole jsou aditivní; staré nejednoznačné hodnoty k ruční kontrole. |
| 4 | `fix/6-authoritative-tonnage` (AUD-06/09), validace MTH (AUD-10) | Identita společné směny a pověření; jedna suma lístků; historie oprav a kompletní přílohy. | Existující rozpory nejprve reportovat. Migrace jen po ověřené záloze a kontrole. |
| 5 | `feat/22-weekly-handover` (AUD-15/16) | Uzávěrka, absence, neměnné verze, adresný příjemce, převzetí, opakování. Scheduler až po těchto krocích; konec procesu musí být ověřen, nestačí 202 z cron endpointu. | Vyšší kvůli závazným výstupům; zachovat staré soubory a metadata. |
| 6 | `fix/20-mobile-simple-form`, `feat/21-absence-dashboard`, `fix/19-director-notifications` | Ověřené výpočty a uchování konceptů před přestavbou UI; role i skutečné telefony. | Nízké až střední, bez architektonického přepisu. |
| 7 | Samostatná revize Vercel (AUD-17), počasí/přístupnost (AUD-22/23) | Potvrdit cílovou URL a účel; přihlášení, CORS, export, offline, push. | Žádné automatické přepínání prostředí. |
| 8 | #18 OCR, #7 lokalizace, #17 rozšíření GPS, #23 Android | OCR 3–10 anonymizovaných českých vzorků, lidské potvrzení; překlady všech UI stavů; reálná zařízení a interní distribuce. | Odložit za integritu jádra. Nezapínat průběžné GPS v rámci auditu. |

Nejde o založené větve oprav ani dokončené implementace; tabulka je konkrétní rozdělení navazující práce. Založena byla pouze auditní větev. Žádná aplikační oprava v tomto auditu nebyla schválena k nasazení.

### Testovací matice pro přijetí oprav

| Scénář | Očekávání | Dosavadní důkaz / co zbývá |
|---|---|---|
| 06–17, dvě pevné pauzy | 11 h přítomnost, 1 h pauzy, 10 h práce | T pro moduly; telefon E2E N |
| Konec 11:50; konec 12:15; start 12:15 | 0 / 15 / průnik minut pauzy, žádný pevný paušál | Stávající hraniční T částečně; doplnit přesné kombinace |
| Servis 11–13 a přejezd 14–15 uvnitř 06–17 | Celkem 10 h, servis 1,5 h, přejezd 1 h, ostatní 7,5 h | Nový T prošel |
| Pauza ruční + automatická ve stejném čase | Odečtena jednou | Stávající T prošel |
| Změna pauz čeká / schválena / zamítnuta | Změní výpočet až rozhodnutí; hash původního zápisu zůstává | Stávající T prošel; strojní XLSX selhává |
| Denní dva stroje, překryv | Osobní minuty jednou, MTH každého stroje zvlášť | Backend union T; Dnes K závada |
| Noční dva stroje 22–02 + 01–03 | 5 h, jedna společná osa | Nový T selhává |
| Noční pauza dalšího dne, jiná schválená pauza další den, změna letního času | Souhlas docházky, deníku a výkazu, zřetelné datum | N, vyžaduje firemní rozhodnutí a test |
| MTH stroj 2 kolem 14000; další stroj jiné MTH | Žádné prohození; konec se nekopíruje; kontrola extrému | Prefill T prošel; extrémní delta T selhává; reálná zařízení N |
| Řidič + spolujezdec 0:45, dvě osobní šichtovnice | Oba 0:45; čas nepřičten znovu; SPZ všech aut | Validace T selhává; celý tok N |
| Jízda 0:00 / nezadáno / čipování nepřipojeno | Tři odlišné skutečnosti, čipování „neověřeno“ | N, není implementováno |
| Tonáž více frakcí, dva zadavatelé, stejný lístek jiná fotka | Jeden součet jedné směny; duplicity ke kontrole | T pro ruční total/pověření selhávají; obsahové duplicity N |
| Foto → upload → odevzdání → PDF s přílohou | Kompletní příloha a řízená chyba při nedostupnosti | Stávající izolovaný integrační T prošel; fyzická kamera N |
| Offline zápis + restart + opakovaný sync | Stejná ID, nic nezmizí, správná revize | K částečně; skutečný IndexedDB/SW restart N |
| Pomalý save A, mezitím B | B zůstane a odešle se jako další změna | Nová JS reprodukce potvrzuje ztrátu B |
| Pád mezi uložením současného záznamu a historie | Konzistentní audit a idempotentní obnova | Souběh T selhává; crash/reálné Mongo N |
| Přihlášení A → odhlášení během sync → B | Žádná data ani tokeny nepřejdou účtům | N; globální uid/running vyžadují test izolace generací |
| A přistupuje k B: list, detail, PUT retry, verze, PDF, přílohy | 403/404 u všech nedovolených cest | Dílčí stávající T prošly; PUT retry nový T selhává |
| Manager / operations_manager / admin / owner | Pravomoci podle explicitní matice; vlastní žádosti řízeně | Stávající dílčí T prošly; úplná API matice N |
| Nemoc, dovolená oba kroky, lékař, půlden | Správné role a stavy, notifikace odpovědnému člověku | K; skutečný push a souběžné rozhodování N |
| Týden jen absence, chybějící den, koncept, pozdní oprava | Úplnost podle plánu; finální balík nesmí nepozorovaně zahrnout koncept | K závady, E2E N |
| PDF/XLSX/CSV stejné období a filtry | Stejné zdroje/revize, hodiny, jízda, SPZ, MTH a české znaky | Dvě exportní závady T; celé obsahové porovnání N |
| Regenerace a převzetí týdne | Původní verze dostupná; příjemce potvrdí konkrétní hash | K chybí; implementace a E2E N |
| Scheduler restart/retry/pád během exportu | Job nezmizí, neopakuje finální předání, audit běhu | N; BackgroundTasks nejsou trvalá fronta |
| Zaměstnanec, vedoucí, jednatel × 320/360/390/428 px | Bez nechtěného přetékání; velké akce, srozumitelné stavy | N pro přihlášené obrazovky |
| Stejné role × 768/1280 px, 200% text, landscape, klávesnice | Zachovaný fokus, dostupné uložení, žádné překrytí | N |
| Android Chrome/PWA, iPhone Safari/PWA, desktop | Kamera/QR/GPS, soubory, aktualizace PWA, push a offline | N na fyzických zařízeních |
| Obnova zálohy DB + příloh do izolace | Počty, revize, otisky, odkazy na soubory a čitelnost exportů souhlasí | N; nutná před rizikovými datovými změnami |

## E. Stav realizace a hranice

Byl klonován a přečten skutečný repozitář, načteny povinné dokumenty, issues a otevřené PR, ověřen Render a Vercel přes jejich konektory i veřejné HTTP a spuštěny popsané testy/build. V nové větvi vznikl tento audit a dva reprodukční soubory. Aplikační kód, architektura, `main-2`, účty, produkční DB, soubory uživatelů ani cloud konfigurace nebyly změněny. Nic nebylo sloučeno ani nasazeno. Vytvoření auditního PR není vyřešení nalezených chyb.

Není doloženo: skutečné používání URL zaměstnanci, úplný audit produkčních historických dat, obnova zálohy, autentizované E2E tří rolí, mobilní rozložení, reálný push/GPS/QR/kamera, automatický týdenní příjemce/převzetí ani samostatný hotový výsledek Gemini. Tyto mezery nezakrývat zelenými jednotkovými testy.

## F. Odkazy a soubory

- [Auditní zdrojový commit](https://github.com/jannhrbacek-dotcom/Demstav-/tree/a16b30993a70620a6708c2417fdb09e3e6effc81)
- [Render služba](https://dashboard.render.com/web/srv-dbg4a0ivcj2c73b4ht30)
- [Vercel ověřený build](https://vercel.com/jan-hrbaceks-projects/demstav/BCwuwdsa89ii5qht3tz8YJuSqxkg)
- Nové akceptační testy: `tests/test_audit_operations_20261028.py`.
- Reprodukce synchronizace: `tests/audit_sync_20261028.cjs`.
- Testovací výsledky a příkazy jsou v části A; neexistuje zde nové ověřené produkční nasazení.
