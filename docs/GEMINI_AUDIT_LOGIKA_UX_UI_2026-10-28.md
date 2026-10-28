# DEMSTAV Operations — povinný audit logiky, procesů a UX/UI pro Gemini
**Datum zadání:** 28. 10. 2026 · **Zdrojová větev:** `main-2` · **Typ:** zadání k provedení, **nikoli hotová kontrola**.

## Cíl a pořadí
Než se provede výrazná změna designu, proveď **nejdřív audit funkční logiky a dat, potom uživatelských cest a rozvržení UI**. Nehodnoť jen, zda se aplikace spustí, ale zda v praxi snižuje papírování strojníkům, výkazy souhlasí se skutečností a vedoucí má přehled. Nové obrazovky nenavrhovat samoúčelně; přednost má zjednodušení stávajících.

Používej aktuální kód `main-2` (nikoli výchozí `main`), přečti `GEMINI.md`, `docs/GEMINI_HANDOFF_2026-10-28.md` a související GitHub issues. Ověř rozdíl mezi požadavkem, implementací, testem a nasazením; nespouštěj produkční migrace, nevytvářej uživatele v ostré DB a nepoužívej osobní údaje. Pokud máš pouze Gemini web/import, **zdokumentuj audit podle dostupného kódu a návrhy patchů**, nevydávej jej za živý test ani neúspěšně simulovaný commit.

## Fáze A: Kontrola funkční logiky a správnosti dat
Pracuj s konkrétními testovacími scénáři, včetně hraničních případů. Pro každý scénář uveď zdrojový soubor/funkci, očekávaný výsledek, pozorovaný výsledek a důkaz (test/log/screenshot, pokud skutečně existuje).

1. **Jedno zadání → více výstupů.** Jeden potvrzený denní záznam musí konzistentně naplnit deník stroje, osobní týdenní šichtovnici, servisní přehled a PDF/XLSX. Týdenní balík a potvrzení jeho převzetí jsou oddělené kroky; automatický plánovač a reálné doručení ověřit zvlášť.
2. **Pracovní doba a přestávky.** Docházka není automaticky práce stroje. Práci, servis, prostoje, přejezd a přestávky nezdvojovat. Přestávky 12:00–12:30 a 15:30–16:00 počítat podle průniku se směnou; změna/neuskutečnění přestávky přes žádost a schvalování. Testovat směnu končící před přestávkou, směnu přes půlnoc, offline opravu i částečné překryvy.
3. **Stroje a MTH.** Jeden zaměstnanec může mít více strojů za den; pro každý stroj ověřit počáteční a koncový stav MTH a číslo stroje. Nezaměnit např. stroj č. 2 s hodnotami kolem 14 000 MTH za jiný stroj. MTH nejsou pracovní hodiny; nerealistický rozdíl označit k revizi, nepřepisovat bez auditní stopy.
4. **Jízda, řidič i spolujezdec.** Sloupec „Jízda *“ znamená celkovou **dobu osobní jízdy za den**, v hodinách/minutách; ne km a ne MTH. Řidič i spolujezdec mají **vlastní šichtovnici** a oba evidují svou dobu stejné cesty. Uvést všechny SPZ na/z pracoviště. Firemní tiskopis výslovně vyžaduje čipování **i spolujezdců** kvůli evidenci pro stravné. Nikdy nepovažovat GPS/ruční zápis za ověřené palubní čipnutí; v nepřipojeném systému stav „neověřeno“. Skutečná nula = 0:00; chybějící údaj není nula. Přejezd nesčítat do pracovní doby dvakrát.
5. **Tonáž.** Vážní lístky se sbírají až na konci směny. Pověřená osoba je zadá a aplikace spočítá jeden součet všech frakcí pro společný výkaz, bez duplicit lístků a bez ručního „pravdivého“ součtu proti položkám. Osobní pracovní doba každého strojníka zůstává oddělená.
6. **Docházka, QR/GPS a offline.** Jednorázové ověření příchodu/odchodu vs čas stroje, GPS přesnost, ztráta signálu, výjimky, idempotentní sync, lokální koncept, obnova po restartu, střet času zařízení/serveru, bezpečná oprava duplicit. Průběžné sledování polohy neaktivovat bez právního a technického posouzení.
7. **Nepřítomnosti a schvalování.** Dovolená, volno, nemoc, lékař; žádost → příslušný vedoucí/Jakub Karas (vedoucí provozu podle aktuálních pravomocí) → případně jednatel → výsledek zaměstnanci. Vyřešit schválené absence při kontrole chybějících šichtovnic. Zobrazovat jen potřebné údaje, nikdy diagnózy v týmovém přehledu. Ověřit autentizaci, práva a audit změn.
8. **OCR a přílohy.** Import fotky = jen návrh, zaměstnanec potvrzuje stroj, MTH, časy a popis. Přílohy a opravy nesmějí vypadnout z exportu; datum a původ údajů uchovat.
9. **Export a doručení.** Zachovat 13 sloupců firemního vzoru, české znaky, datum, SPZ, servis, MTH, „Jízda“, přílohy; ověřit obsah PDF i Excelu. Kontrola neúplných dnů, opozděné opravy, revize, archiv, autentizovaný odkaz vedoucímu. Cron na Renderu ověřit v produkční konfiguraci a logu, nikoli podle textu v UI.
10. **Bezpečnost a stabilita.** Ověřit, že zaměstnanec nevidí cizí citlivé záznamy, role respektují oprávnění, API validuje data serverově, chyby nevedou ke ztrátě údajů a logy či repozitář neobsahují tajné klíče, hesla ani osobní data.

## Fáze B: UX/UI audit, rozložení, navigace a čitelnost
Vyhodnoť **skutečné stránky v `frontend/src/pages/`**, zejména `Today.jsx`, `RecordForm.jsx`, `Records.jsx`, `RecordDetail.jsx`, `Overview.jsx`, `MyOverview.jsx`, `Attendance.jsx`, `Absence.jsx`, `TeamCalendar.jsx`, `Machines.jsx`, `Exports.jsx`, `Production.jsx`, `Review.jsx`, `Queue.jsx`, `Guide.jsx`, `More.jsx`, `Users.jsx`, `Workplaces.jsx`. Porovnej navigaci mezi nimi, závislosti na roli a hlavní scénář strojníka.

### Konkrétní požadavky k prověření
- **Domovská obrazovka:** jednoduché priority a velká hlavní akce „Zapsat směnu / deník“; méně vizuálního hluku, přehledný dnešní stav. Uvítání správným českým 5. pádem (např. „Dobrý den, Jane“), bezpečný fallback u neskloňovaných/neznámých jmen.
- **Zápis práce:** skutečný jednoduchý režim (datum, stroj, pracoviště, časy, popis, MTH); servis, závada a přejezd přes snadno dostupné volby, další pole až na vyžádání. Při přepnutí režimu, návratu zpět a offline režimu **nic nezmizí**. Jasně rozlišit osobní šichtovnici a společný výkaz tonáže, barevně a textově.
- **Rychlé akce:** dovolená, nemoc, volno, lékař dostupné bez dlouhého hledání. „Fronta“ se zobrazuje nebo upozorňuje jen při nevyřízených/synchronizačních položkách; nikdy se nezamlčí konflikt či chyba.
- **Počasí:** rozkliknutelné detaily, následující dny a alespoň hodinová časová osa předpovědi, pokud má zdroj dostupná data; jasný stav při chybě a údaj o aktuálnosti.
- **Kalendář:** přehled osobních směn, pracovišť a schválených absencí, pro vedení souhrn týmu; rozlišit čekající a schválené žádosti; neprozrazovat zdravotní podrobnosti.
- **Dashboard vedení:** vedoucí provozu/Jakub Karas, vedoucí a jednatel vidí přidělené žádosti, nepřítomnosti, stav týdenních šichtovnic, opožděné záznamy, servisní upozornění; přehledně, bez nutnosti otvírat mnoho obrazovek.
- **Průvodce:** první spuštění nabídne srozumitelný tutoriál „co kde najdu“, dostupný kdykoli z menu; kroky pro čipování spolujezdce, osobní jízdu, servis i odevzdání týdne.
- **Přístupnost/starší zaměstnanci:** dostatečný kontrast, velká dotyková plocha a čitelné české popisky, konzistentní názvy, minimum povinného psaní, předvyplňování a našeptávání, jednoznačné úspěch/chyba; nespoléhat pouze na barvu.
- **Responzivita:** ověřit zejména šířky 320, 360, 390, 428, 768 a 1280 px; Android Chrome, iPhone Safari/PWA, desktop. Žádné horizontální přetékání formulářů, překrytí tlačítek klávesnicí, rozpadlé tabulky ani ztracený fokus; funkční stav při slabé síti, offline, velkém písmu a přepnutí orientace.
- **Konzistence:** stejné ikony a názvosloví ve všech modulech, logické pořadí kroků, jasné potvrzení uložení/synchronizace/odeslání; prázdné stavy s návodem co dál. Ověřit základní výkon, rychlost prvního otevření a přiměřenou velikost PWA.

### Jak audit dokázat
**Pouhá prohlídka JSX není vizuální test.** Pokud máš k dispozici běžící testovací aplikaci, proveď průchod rolí strojník / vedoucí / jednatel na telefonu a desktopu (nebo reprodukovatelné screenshoty/Playwright). Nefotografuj ani nesdílej živá osobní data; použij testovací účty/staging. Bez přístupu do běžícího prostředí zapiš „**neověřeno v běhu**“ a navrhni konkrétní kroky ověření. Nevymýšlej naměřená skóre.

## Výstup Gemini (povinná struktura)
1. **Přehled rozsahu:** kontrolovaný commit/větev, co bylo skutečně spuštěno (příkazy/testy) a co šlo pouze přečíst; rozdělit „ověřeno“, „pravděpodobná chyba“, „chybí důkaz“.
2. **Mapa toku dat:** denní zápis → deník → šichtovnice → export → převzetí; návaznost na docházku, servis, absence, tonáž a čipování. U každé kritické hrany uveď konkrétní soubory/endpointy.
3. **Nálezy P0/P1/P2/P3:** tabulka: závažnost, obrazovka/modul, krok k reprodukci, očekávané vs skutečné chování, důkaz/soubor/řádek, riziko, návrh opravy, potřebný test. P0 = ztráta dat, nesprávné hodiny/stravné, zásadní únik oprávnění; P1 = blokující práce; P2 = výrazná nepřehlednost; P3 = kosmetika.
4. **UX mapa:** návrh navigace pro zaměstnance, vedoucího a jednatele; před/po rozložení hlavních obrazovek (wireframe nebo odkaz na screenshot), bez svévolného škrtání požadovaných funkcí.
5. **Testovací matice:** nejméně základní scénáře pro každou roli, 320–428px telefon, tablet/desktop, offline/synchronizace, více strojů, dvě osoby v autě, přestávky, nemoc, týdenní uzávěrka.
6. **Návrh oprav v pořadí:** nejprve bezpečnost a správnost dat, pak blokující pracovní postup, pak UX. Každá oprava izolovaná do issue/PR proti `main-2`, se skutečným výsledkem testů a rollback plánem. Není-li git write access, připrav detailní diff/patch návrh.
7. **Závěrečné vyhodnocení:** co zůstává neověřené, co potřebuje upřesnění od firmy, co je připraveno k revizi. **Nikdy nevydávej samotný audit za dokončené nasazení.**

## Podmínky přijetí
- [ ] Logika součtů času, MTH, jízdy, spolujezdce a tonáže ověřena scénáři s očekávanými hodnotami.
- [ ] Formuláře a navigace posouzeny alespoň pro mobil + desktop, s výslovným označením neověřených zobrazení.
- [ ] Audit všech rolí a schvalování doložen konkrétními testy nebo přesnými kroky, které ještě chybí.
- [ ] Úkoly #20, #22, #5/#6, #18, #19, #21, #17, #23 propojeny s konkrétními nálezy.
- [ ] Neproveden přímý zásah do `main-2` aplikace, produkční DB ani ostrého nasazení bez schválení.
