# Stav oprav DEMSTAV Operations — 28. 10. 2026

Výchozí větev `main-2`, commit `a16b30993a70620a6708c2417fdb09e3e6effc81`. Toto je stav připraveného kódu, nikoli potvrzení provozní funkčnosti. Neproběhlo sloučení do main-2, nasazení, změna cloud konfigurace ani zásah do produkční databáze. Nezávislý výsledný výstup Gemini nebyl dodán; opravy navazují na vlastní audit v PR #24 a zdrojový kód, ne na neověřené závěry Gemini.

## Připravené změny

| Oblast | Návrh změny | Ověření a zbývající podmínky |
|---|---|---|
| Integrita a oprávnění | PR #25: kontrola vlastníka před opakováním zápisu, explicitní servisní oprávnění, žurnál revizí s obnovou projekce, neměnná offline operace, zákaz globálního wipe | Regrese souběhu, přerušeného zápisu a pomalé synchronizace. Telefon, upgrade staré fronty a vedlejší efekty po pádu dále ověřit. |
| Čas, jízdy a MTH | PR #26: sjednocení časových intervalů přes půlnoc, osobní jízda H:MM a role řidič/spolujezdec, potvrzené MTH a předvyplnění, schválené přestávky ve strojním XLSX | Unit/API a PDF testy. Staré nejednoznačné jízdy se nepřevádějí odhadem; čipování zůstává neověřené. |
| Denní formulář | PR #27: podstatné údaje první, další sekce rozbalovací, automatický koncept v IndexedDB podle účtu, viditelné chyby uložení | DOM test skutečného formuláře, obnova konceptu a zachování skrytých údajů. Reálný telefon a uživatelské měření délky vyplnění zbývá. |
| Tonáž | PR #28: součet úplných vah lístků, uzavření směny, pověřený zadavatel, ochrana proti duplicitě, PDF/XLSX/CSV | API a výpočtové testy. Nové indexy a klíče duplicit ověřit na anonymizované kopii dat před produkcí. |
| Absence | PR #29: adresná oznámení, mezikrok schválení, ochrana souběhu, přehled vedení a kalendář bez soukromých poznámek | Testy oprávnění, přechodů a obsahu oznámení. Skutečné doručení na zařízení nebylo ověřeno. |
| Týdenní předání | PR #30: verzované soubory a otisky, kontrola podkladů, adresné převzetí/vrácení, historie a plánovač | API testy verzí, příjemce, změněných zdrojů a simulovaného obnovení lease. Plánovač výchozí vypnutý; produkční termín ani příjemci nebyli nastaveni. |

Společná integrační větev řeší konflikty těchto šesti PR. Obsahuje také mobilní navigaci vedení (Přehled / Ke kontrole / Tým / Dnes / Více), zalamování detailu, stáří uložené předpovědi s viditelnou chybou aktualizace a upřesnění průvodce. Při kopírování posledního deníku předvyplňuje MTH z potvrzené historie. Po integračním PR neslučovat znovu šest obsahově zahrnutých větví bez kontroly historie.

## Stav GitHub úkolů

| Issue | Stav po této sadě | Zbývající práce |
|---|---|---|
| #5 Výkaz odběratele | Částečně připravené exporty a pravidla tonáže | Úplný společný více-strojový fakturační výkaz, vizuální shoda papírového vzoru a auditovatelný podpis odběratele. |
| #6 Společný výkaz | Připravené jádro v #28 | Ověření práce celé posádky na jedné zakázce, duplicit a schváleného zákaznického výstupu na testovacích datech. |
| #7 Tři jazyky | Touto sadou neimplementováno | Inventura textů, slovníky CS/EN/UK, preference účtu, překlady validací a exportů, přepínání za běhu a kontrola přetečení. |
| #17 GPS | Touto sadou neimplementováno | Schválený provozní režim, omezení na směnu, retence/oprávnění, vypnutí po směně a testy zamčeného telefonu. PWA nepovažovat za důkaz spolehlivého sledování na pozadí. |
| #18 OCR | Touto sadou neimplementováno | Anonymizované vzorky ručních deníků, měření přesnosti, ruční potvrzení nejistých polí a bezpečné předvyplnění konceptu bez automatického potvrzení. |
| #19 Notifikace | Připravené směrování a ochrana stavu v #29 | Test zařízení pro vedoucího, jednatele i žadatele; trvalá fronta doručení/retry dosud není součástí. |
| #20 Jednoduchý režim | Připravený formulář v #27 a integraci | Fyzické telefony, ztráta internetu/restart prohlížeče, starší zaměstnanci, podepisování a klávesnice. |
| #21 Přehled vedení | Připravené přehledy a filtrování v #29 | Role v reálném průchodu mobilním UI a ověření úplného rozsahu plánování nepřítomností podle zadání. |
| #22 Týdenní předání | Připravený proces v #26 a #30 | Schválení firemního výstupu, čas/příjemci, skutečný pád/restart plánovače a ověření doručení. Automatické předání neaktivováno. |
| #23 Android | Touto sadou neimplementováno | TWA/APK/AAB projekt, firemní podpis, ověřená doména, Play Console a interní instalace/aktualizace na zařízení. |

Žádný z těchto širších úkolů se pouze na základě připraveného kódu neoznačuje za kompletně dokončený.

## Skutečně provedené ověření

- Společná verze: `python -m pytest tests/test_*.py backend/tests/unit/test_production.py -q` — **72 prošlo**. Izolované testy používají i Mongo mock; nejde o test produkčních dat.
- `node tests/sync_integrity.cjs` — prošla regrese úprav během pomalého odesílání a změny účtu.
- `CI=true npm test --prefix frontend -- --watchAll=false --runInBand` — **18 testů, 10 sad prošlo**.
- Produkční frontend build prošel; existující upozornění sestavení nejsou důkazem selhání, ani důkazem vizuální správnosti.
- Všech šest dílčích PR má úspěšné GitHub Actions. Workflow zahrnuje sestavení kontejneru, izolované MongoDB 7 a základní kontrolu zachování dat po restartu. Neověřuje nové mobilní průchody ani produkční migraci.

## Pořadí dalšího ověření a práce

1. **P0 — kontrola integrity před nasazením:** code review společné větve, její CI, ověřená záloha a obnova anonymizované kopie. Vyzkoušet kolize revizí, výpadek mezi žurnálem/projekcí a chyby vedlejších efektů. Ověřit nové indexy bez přepisu historických dokumentů.
2. **P0 — průchod směnou:** dva zaměstnanci, řidič i spolujezdec, více strojů, překryv práce, přestávky pouze uvnitř směny, změna přestávky se schválením, půlnoc a přechod letního času; porovnat docházku, čistou práci, jízdu a MTH odděleně v UI/PDF/XLSX/CSV. Přestávka v následujícím kalendářním dni vyžaduje zvláštní test.
3. **P0 — offline a tonáž:** stará fronta, A/B změny při odesílání, přepnutí účtu, restart a kvóta úložiště. Dva členové posádky nesmějí založit dvojí společný výkaz. Prověřit shodu identifikátorů lístků od různých vystavovatelů.
4. **P0 — týden:** blokující koncept, změna zdroje po exportu, stará i nová verze dostupná, cizí příjemce odmítnut, vrácení s důvodem; restart skutečného procesu během běhu a opakování bez dvojího předání. Mobilní neodeslané koncepty server neumí sám odhalit.
5. **P1 — role a mobil:** zaměstnanec / vedoucí / jednatel; rozměry 360–430 px, velké písmo, fokus/chybové hlášky, klávesnice, přehled absencí a skutečné push na Android/iOS. Poté dokončit #5/#6, OCR a lokalizaci jako oddělené kontrolovatelné změny.
6. **P2 — GPS/Android a prostředí:** implementovat zbývající požadavky #17/#23. Alternativní Vercel prostředí se touto sadou neopravovalo ani neoznačuje za ověřenou produkci; vazbu na backend ověřit samostatně.

Před produkcí zkontrolovat zpětnou kompatibilitu lokálního `sync-v2`: starší klient jej neumí číst. Rollback vyžaduje nejprve bezpečné odeslání nebo zachování lokálních konceptů. Nové servisní zařazení přiřadit jen skutečně oprávněným uživatelům; žádné účty nejsou automaticky přeznačené. Vedlejší efekty po pádu procesu nemají garantované opakované doručení. Podrobnosti a dílčí testy jsou v šesti přiložených dokumentech oprav.
