# DEMSTAV OPERATIONS — předání projektu pro asistenta Grok

Datum sestavení: 26. 10. 2026, Europe/Prague.
Účel: souhrn dosavadního vývoje, závazných požadavků, exportů, právních podkladů a otevřených úkolů. Tento dokument lze předat Groku jako úvodní zadání. Neobsahuje hesla ani produkční osobní záznamy.

## 1. Úvodní instrukce pro Grok

Navazuj na existující aplikaci DEMSTAV OPERATIONS. Nejprve prostuduj tento dokument a dodané skutečné zdrojové soubory. Zachovej existující funkce, data, identifikátory a historii. Nevytvářej podobnou náhradní aplikaci a nevydávej ji za pokračování původního projektu.

Odděluj vždy:
- co už existuje v kódu;
- co je nasazené na současném soukromém webu;
- co je pouze připravené pro vlastní server;
- co bylo skutečně otestované a v jakém prostředí;
- co představuje požadavek do budoucna.

Historický počet testů není důkaz o aktuální funkčnosti. Při změnách spusť relevantní testy a uváděj jejich skutečný výsledek. Neprohlašuj právní shodu pouze na základě existence formuláře, PDF, podpisového obrázku nebo úspěšných testů.

## 2. Smysl aplikace a vznik projektu

Projekt vychází ze zkušeností Jana/Janka se servisem a provozem stavebních strojů, drtičů, třídičů a nakladačů v recyklaci a kamenivu. Původní návrhy souvisely s Petrokamenem; aktuální cílovou aplikací je DEMSTAV OPERATIONS pro DEMSTAV GROUP.

Smyslem je omezit papírování a opakované přepisování stejných údajů. Zaměstnanec zadá údaje na telefonu jednou; záznam se promítne do provozního deníku stroje, jeho pracovního výkazu, servisní historie a přehledu vedení v odpovídajícím rozsahu.

Nejdůležitější novější priorita: vedení má mít automaticky dostupné aktuální záznamy zaměstnanců přes vlastní přihlášení a oprávnění. PDF a tabulkové exporty zůstávají potřebné, ale nemají být jediným způsobem předávání informací.

Provoz zahrnuje práci venku, slabé připojení, více pracovišť a střídání více strojů během jednoho dne. Obsluhu musí zvládnout i starší zaměstnanec bez složitého hledání v nabídkách.

## 3. Platformy, vzhled a běžný pracovní postup

Cíl: profesionální web a instalovatelná PWA pro Android, iPhone, tablet a počítač. Samostatné nativní aplikace v obchodech nejsou dosavadním vývojem doložené.

Požadavky na rozhraní:
- čitelná čeština, dostatečný kontrast, velká tlačítka a jasný další krok;
- jednoduchý domov zaměstnance: dnešní směna, příchod/odchod, nový denní zápis, servis a neodeslané záznamy;
- přehled vedení: zaměstnanci, pracoviště, chybějící výkazy, výjimky docházky, závady a servisní termíny;
- jednotná typografie a firemní vzhled; dosavadní provedení používá tmavou navigaci a žluté akce;
- omezení zbytečného vyplňování: našeptávání, předvyplnění a seznam vlastních strojů/pracovišť;
- zřetelně rozlišovat místní uložení, čekání na odeslání, přijetí serverem a schválení.

Pracovní postup: zaměstnanec zaznamená příchod, vybere stroj a pracoviště, zapisuje činnost/MTH/závady, případný servis a přestávky, zakončí výkaz a odchod. Vedoucí kontroluje nesrovnalosti a schvaluje výjimky. Příchod do práce není automatickým spuštěním stroje.

## 4. Uživatelé, vlastnictví a oprávnění

| Role v cílovém řešení | Účel |
| --- | --- |
| Vlastník firmy / zákazník | Plná firemní kontrola, správa přístupů, dat, záloh a předání; možnost odebrat technickému správci přístup. |
| Technický správce — Janko | Správa aplikace a zaměstnanců podle delegovaných oprávnění; vlastní osobní účet. |
| Vedoucí | Přehled přiřazených zaměstnanců/pracovišť, schvalování oprav a výjimek, kontrola provozu a exporty. |
| Zaměstnanec / strojník | Vlastní docházka a výkazy, přidělená pracoviště a stroje, hlášení závad. |

Cílově správce založí uživatelské jméno, přidělí dočasné heslo, nastaví roli a pracoviště, resetuje nebo deaktivuje účet. První přihlášení má vynutit změnu hesla; vedení a správce mají používat vícefaktorové ověření.

Současná omezení:
- web na Sites používá přihlášení přes ChatGPT a samostatnou bránu přístupu k soukromému webu;
- přidání osoby do aplikační evidence samo neotevře soukromý web;
- firemní jména/hesla jsou připravena v samostatném serverovém řešení, nikoli aktivována na současném webu;
- jemné oddělení technického správce a vedoucího není dokončené: sdílejí aplikační roli manager;
- ochrana účtu vlastníka v aplikaci nechrání proti osobě s neomezeným přístupem k OS, databázi či správě identity.

Firma má vlastnit hosting, doménu, data a obnovovací přístupy. Konkrétní vlastník firmy dosud nebyl jednoznačně určen pro ostré založení účtu.

## 5. Požadované moduly

### 5.1 Provozní deník stroje

Evidence podle stroje, data, obsluhy, pracoviště a zakázky:
- identifikace stroje a skutečně zapisujícího účtu;
- směna/posádka, provedená práce, pracovní úseky;
- počáteční a konečný stav MTH, rozdíl MTH; podle zařízení km;
- kontroly před provozem a po něm podle konkrétního návodu a provozních pravidel;
- závady a provozní odchylky: čas, popis, závažnost, stav, odstranění a seznámení střídající obsluhy;
- servis a opravy, kdo je provedl, případná externí dílna;
- palivo, oleje, maziva, doklady a fotografie podle použitelného formuláře;
- poznámky, přílohy, koncept/potvrzený zápis, opravy s důvodem a revizí.

Vážná závada má být viditelná a předaná odpovědné osobě. Zaškrtnutí aplikace samo nepotvrzuje bezpečnost ani odborné odstranění závady.

### 5.2 Šichtovnice a výpočty času

Šichtovnice je pracovní výkaz zaměstnance. Primárním významem jsou pracovní hodiny, nikoli automaticky fakturovatelné hodiny.

Rozlišovat:
- přítomnost na pracovišti;
- pracovní dobu a přestávky podle jejich druhu;
- produktivní práci se strojem či jinou práci;
- servis v pracovní době;
- prostoje jako samostatnou kategorii;
- MTH jako údaj měřidla stroje.

Servis uvnitř pracovního úseku je součástí pracovní doby. Aplikace ho nemá odmítat jako chybný překryv ani přičítat podruhé. Překryv servisního úseku s prostojem musí mít jednoznačné pravidlo; současný výpočet přiřazuje překrývající se část servisu.

Příklad čistého pracovního úseku 06:00–15:00 bez nezapočítávané přestávky: 9 h celkem = 6 h ostatní práce + 2 h servis + 1 h prostoj. Jestli je uvnitř nezapočítávaná půlhodinová přestávka, nelze uvádět 9 h odpracované doby; nejprve se musí správně vymezit pracovní úseky. Bezpečnostní přestávky a práce, kterou nelze přerušit, vyžadují odlišné zacházení.

Při střídání více strojů nesčítat zaměstnanci stejnou minutu vícekrát. MTH se počítají nezávisle na pracovních hodinách. Noční směny a změna letního/zimního času vyžadují datum, časové pásmo a jednoznačné okamžiky. Starší data obsahující pouze čas od–do mohou být nejednoznačná.

### 5.3 Evidence strojů a servis

Karta stroje má obsahovat typ/značku/model, interní číslo, rok výroby, VIN/výrobní číslo a případně SPZ; dále aktuální MTH/km, historii servisů, následující servis a spotřebu.

Požadovány jsou servisní intervaly podle konkrétního stroje, upozornění před termínem, materiál a práce, náklady, filtry a olejové náplně, fotografie, přílohy a poznámky.

Příklad: Liebherr L566-6, interní číslo 3. Interval 500 MTH a upozornění 100 MTH předem jsou konfigurační příklady; nejsou univerzální zákonnou lhůtou. Úplnost všech uvedených polí a nákladových výpočtů musí Grok teprve porovnat se zdrojovým modelem.

### 5.4 Docházka zaměstnanců

Zaměstnanec: příchod, odchod, začátek/konec přestávky, stav směny, dnešní doba, historie, synchronizace a žádost o opravu.

Vedoucí: založení a správa pracovišť, přiřazení zaměstnanců, ověřovací režim, QR, GPS okruh, schvalování výjimek a oprav, audit a přehledy podle osoby/pracoviště/období.

Režimy:
1. QR;
2. GPS;
3. QR + GPS;
4. ruční záznam se schválením.

Pracoviště má název a adresu; GPS režim navíc střed, poloměr a požadovanou přesnost. Ruční režim nemá vyžadovat vymyšlené souřadnice. Příklad poloměru 150 m není zákonná hodnota.

Statický QR lze přeposlat či vyfotit. Přísnější režim má použít časově omezený podepsaný QR a ověření na serveru. Nepřesná nebo chybějící GPS, stav mimo okruh a offline záznam nesmějí být vydávány za automaticky prokázanou přítomnost; mají mít výjimku a schválení.

GPS se má používat při konkrétní události, nikoli jako trvalé sledování zaměstnance. V dosavadním modelu se podle auditních podkladů na server neukládají přesné souřadnice zaměstnance, ale výsledek a technické údaje ověření. Grok to má potvrdit v kódu a logování.

Docházka a deník se propojují přes účet, datum a ID pracoviště. Starší volné názvy pracovišť vyžadují ruční porovnání.

### 5.5 Přehled vedení a automatické předání

Po úspěšné synchronizaci musí oprávněné vedení vidět záznam v centrální evidenci bez ručního posílání PDF a opětovného přepisování. V offline stavu se aktualizace projeví až po přijetí serverem.

Požadovány jsou filtry, přehled neuzavřených výkazů, porovnání docházky s výkazy, servisní upozornění a stav řešení závad. Oprávnění musí vynucovat server, včetně přístupu k přílohám.

## 6. Offline režim — závazný cíl a skutečný stav

Cíl: po prvotním přihlášení a potřebném načtení má zaměstnanec bez internetu aplikaci znovu otevřít, vyplnit a bezpečně uložit deník, šichtovnici i servis; přílohy mají mít viditelný stav čekání.

Požadavky: trvalá místní fronta, obnovení po zavření aplikace, stabilní ID událostí, opakované odeslání bez duplicit, detekce konfliktů, oddělení účtů a potvrzení serverem. Uchovávat čas zařízení odděleně od serverového času a od času schválení. Expirace přihlášení nesmí tiše zničit rozepsaná data; synchronizace vyžaduje platnou identitu a kontrolu oprávnění.

Doložený stav k poslední etapě:
- docházka má vlastní frontu a nouzový formulář;
- deník má místní koncept;
- úplná offline fronta všech deníků, servisů a příloh dokončená není;
- skutečné spuštění za soukromou bránou Sites bez internetu, po zavření aplikace a po expiraci relace není přejaté.

Samotná možnost instalace PWA ani ikona na ploše nedokazují plný offline provoz.

## 7. Exporty — co zachovat a jak mají fungovat

### 7.1 Společná pravidla

Export se vytváří ze stejného uloženého modelu a stejné výpočetní logiky jako obrazovka. Podporovat výběr období, zaměstnance, stroje, pracoviště a zakázky v rozsahu oprávnění. Jasně uvést zahrnuté stavy; koncept není potvrzený originál.

U exportu uvést firmu, období/filtr, čas vytvoření, ID a revizi záznamů a podle potřeby autora/potvrzení. Zachovat diakritiku, jednotky, dlouhé texty a stránkování. Neztrácet staré hodnoty ani nevyvozovat nový význam historických dat bez označené migrace.

### 7.2 PDF šichtovnice

Současná šablona má 13 základních sloupců, které je třeba zachovat při pokračování původního formuláře:

| Pořadí | Sloupec |
| --- | --- |
| 1 | Datum |
| 2 | Stroj |
| 3 | Objednatel |
| 4 | Pracoviště / dílna |
| 5 | Jízda * |
| 6 | SPZ vozidla na pracoviště |
| 7 | Pracovní hodiny celkem |
| 8 | Údržba / servis / oprava |
| 9 | SPZ vozidla z pracoviště |
| 10 | Ubytování ANO/NE |
| 11 | MTH začátek |
| 12 | MTH konec |
| 13 | Zakázka |

Význam položky Jízda * musí navazovat na původní firemní formulář, nikoli být odhadnutý novým asistentem. Součty mají srozumitelně uvádět celkovou pracovní dobu a její členění. Dlouhé popisy a detaily patří do čitelné přílohy s vazbou na řádek.

### 7.3 PDF provozního deníku

Zachovat stroj, den, směnu, obsluhu/posádku, pracoviště, činnosti, časy, MTH, kontroly, závady a jejich odstranění, servis, poznámky a odkazy na přílohy. Podpis či potvrzení zobrazovat pouze podle skutečně existujících údajů a úrovně ověření.

### 7.4 Excel a CSV

Současný XLSX vytváří listy Šichtovnice, Deník stroje, Servis a opravy, Nahlášené závady, Přílohy a Revize zápisů; při potřebě i Dlouhé texty. Zachovat ID, revize, stav a původní časové úseky. Čísla a data mají být skutečné datové typy, hlavičky čitelné, filtry a tisk použitelný.

Samostatně exportovat celkovou dobu, ostatní práci, servis, prostoje a MTH. Ošetřit textové hodnoty začínající jako tabulkový vzorec. Tabulka s názvem přílohy sama neobsahuje soubor přílohy. List Revize zápisů s číslem aktuální revize sám nedokazuje export celé historické posloupnosti.

CSV má sloužit pro přenos a import; nepředstírat zachování všech funkcí XLSX. Google Sheets je cílový požadavek kompatibility/případné integrace. Živý automatický zápis do Google Sheets nebyl v této etapě doložen; import XLSX/CSV a napojení přes API jsou odlišné funkce.

### 7.5 Docházkové exporty

Dosavadní XLSX obsahuje události, porovnání s pracovními výkazy a opravy/výjimky. Uchovat typ události, zaměstnance, pracoviště, čas zařízení, čas přijetí serverem, efektivní čas, stav ověření a údaje o rozhodnutí.

Docházkový export není automaticky úplným mzdovým podkladem ani kompletní evidencí podle § 96 zákoníku práce.

### 7.6 Archiv, záloha a obnova

JSON archiv / šifrovaný .demstav soubor má přenést určený rozsah dat a příloh. Současná šifrovaná záloha vybraného deníku není úplnou zálohou celé infrastruktury: nenahrazuje úplné databáze, správu identit a všechny serverové klíče.

Obnova deníku přes uživatelský import vytváří nové koncepty. Nesmí předstírat nové potvrzení původní osobou. Zachovat původ jako archivní informaci a pravdivě zaznamenat nového importujícího autora a čas.

PDF je výstup pro čtení/tisk; XLSX/CSV jsou upravitelné přehledy; úplná autoritativní historie a obnovitelná záloha jsou samostatná věc.

### 7.7 Konkrétní zjištěný úkol

Kód lib/work-time.ts už odděluje práci, servis a prostoje. Část starších vysvětlivek v dokumentaci a tabulkovém exportu stále uvádí rovnost celkem = práce bez servisu + servis, bez prostojů. Ověřit a sjednotit popisky a součty podle aktuálního významu všech kategorií. Při tomto předání se kód neopravoval.

## 8. Právní rámec a ukládání dokumentace

Tato část rozlišuje právní povinnost, interní pravidlo a implementační požadavek. Působnost předpisů musí odpovídat skutečné činnosti, stroji a pracovišti. Jde o podklad pro dokončení, nikoli potvrzení způsobilosti celé aplikace pro ostrý provoz.

### 8.1 Provozní dokumentace stroje

Základní rámec tvoří zákon č. 309/2006 Sb., zejména § 4, a NV č. 378/2001 Sb., zejména § 2 a § 4. Provozní dokumentace je širší než denní tabulka: zahrnuje návody a příslušné záznamy kontrol. Podle § 4 odst. 3 NV 378/2001 se uchovává po celou dobu provozu zařízení. Denní zápis nenahrazuje dokumentaci výrobce, kontroly a revize. [L1]

U staveništních strojů je relevantní také NV č. 591/2006 Sb., příloha č. 2, část XIV bod 1: evidence závad/provozních odchylek a řádné seznámení střídající obsluhy. Výchozí právní audit projektu ověřoval znění po novele č. 319/2025 Sb. Před ostrou přejímkou znovu zkontrolovat úplné aktuální konsolidované znění. Tento předpis sám neurčuje univerzální 13sloupcový formulář naší šichtovnice. [L2]

Konkrétní kontroly a servis vycházejí z výrobce, příslušných předpisů a místního provozního bezpečnostního předpisu. Interval 500 MTH je příklad nastavení, nikoli obecný zákon.

### 8.2 Elektronické vedení a průkaznost

SÚIP v odpovědi z 9. 9. 2024 k dokumentaci VTZ zdůrazňuje určení konkrétní pověřené osoby, čas a ochranu proti zpětné manipulaci. Zmiňuje přihlášení do systému jako možnou cestu prokazatelnosti a upozorňuje na zvláštní režim zdvihacích zařízení. Jde o výklad k danému okruhu zařízení, ne certifikaci DEMSTAV. [L3]

Důsledky pro aplikaci: vlastní účty, autor akce, čas, vazba potvrzení ke konkrétní revizi, historie změn, důvod opravy a dostupnost. Obrázek podpisu není kvalifikovaný elektronický podpis. Vyplněné jméno strojníka nedokazuje, že zápis provedl nebo potvrdil právě on.

Pro podrobnější podpisový režim navazovat na § 562 občanského zákoníku, zákon č. 297/2016 Sb. a eIDAS podle typu jednání. Kvalifikované podpisy či časová razítka nejsou tímto předáním označeny za implementované.

### 8.3 Stavební deník stavby je jiná evidence

Stavební deník podle § 166 zákona č. 283/2021 Sb. zachycuje provádění/odstraňování stavby a má vymezené oprávněné zapisující osoby. Obsah a způsob vedení stanoví vyhláška č. 131/2024 Sb., § 10 a příloha č. 12. Deník stroje a šichtovnice ho automaticky nenahrazují. [L4, L5]

§ 166 odst. 3 řeší předání originálu po dokončení; elektronickou variantu předáním ve strojově čitelném formátu nebo uchováním a zajištěním přístupu stavebníkovi a určeným osobám po uvedenou desetiletou dobu. Nelze z toho vyvodit jednotné desetileté uchování všech dat aplikace, zvlášť GPS. Samostatné povinnosti vlastníka stavby a konkrétní počátek lhůty je třeba posoudit v příslušném režimu. [L4]

Pokud má aplikace nově plnit i zákonný stavební deník stavby, jde o samostatné rozšíření s obsahovou a právní přejímkou.

### 8.4 Pracovní doba a docházka

§ 96 zákona č. 262/2006 Sb. stanoví evidenci pracovní doby. MPSV výslovně odlišuje přítomnost na pracovišti od evidence pracovní doby. Odpovědnost nese zaměstnavatel, i když zaměstnanec poskytuje součinnost. Potřebné jsou také příslušné údaje o přesčasech, noční práci a pohotovosti; samotné příchody/odchody ani týdenní součet nestačí. [L6]

Přestávky musí aplikace klasifikovat podle skutečného druhu a pravidel; prostoj nelze automaticky vydávat za neplacenou přestávku. Úplné personální a mzdové členění není podle posledního auditu hotové.

### 8.5 GPS, osobní údaje a retence

GDPR vyžaduje konkrétní účel a právní důvod, přiměřený rozsah, zabezpečení a uchování omezené na potřebnou dobu. Stanovit informační povinnost a přístup, řešit zpracovatele a případné předávání dat. Pro GPS je nutné posoudit i § 316 zákoníku práce a nezbytnost proti mírnějším způsobům ověření. Zaměstnanecký souhlas nelze pokládat za automaticky svobodné univerzální řešení. [L7, L8]

Neexistuje zde doložená jednotná zákonná lhůta pro uchování všech GPS údajů. Technické ověřovací údaje mají samostatnou retenční politiku. Rozvrh uchování musí rozlišit provozní dokumentaci, pracovní/mzdové podklady, přílohy, audit a GPS; určit účel, lhůtu, její počátek a výjimku při sporu.

### 8.6 Báňský a zvláštní režim

U konkrétního lomu, úpravny nebo činnosti prováděné hornickým způsobem posoudit také zákon č. 61/1988 Sb. a příslušné vyhlášky ČBÚ, zejména č. 26/1989 Sb. a č. 51/1989 Sb. Nelze automaticky vztáhnout jeden režim na každé recyklační pracoviště. Vyhrazená zařízení mohou mít další povinnosti podle zákona č. 250/2021 Sb. a prováděcích předpisů.

Konkrétní působnost má potvrdit odpovědná osoba zaměstnavatele pro daný provoz. Tento dokument neověřuje povolení jednotlivých provozoven.

## 9. Technický stav a zdroje

Existující projekt:
- název: DEMSTAV · Deník a šichtovnice / DEMSTAV OPERATIONS;
- ID: appgprj_6adaeac67eb88191ac65a9bb09c08d74;
- dosavadní soukromá adresa: https://demstav-denik-sichtovnice.jannhrbacek.chatgpt.site.

Dostupný archiv poslední popsané etapy: DEMSTAV_OPERATIONS_PWA_SOURCE.zip. Starší DEMSTAV_OPERATIONS_SOURCE.zip není automaticky stejně aktuální.

Stack podle přečtených zdrojů: React, TypeScript, Next.js/Vinext, Tailwind, původní D1/R2 rozhraní, PDF přes pdf-lib, XLSX přes ExcelJS a QR knihovny. Samostatný cíl používá Node/Next.js, PostgreSQL adaptér, neveřejné souborové úložiště, Keycloak, OAuth2 Proxy a Caddy; orchestrace je připravená v Docker Compose.

Důležité soubory:
- docs/pwa/ETAPA-2026-10-23.md — poslední etapa a omezení;
- standalone/README.md — infrastruktura, identity, migrace a zálohy;
- docs/LEGAL_DIARY_RESEARCH.md — provozní deník a právní rozdíly;
- docs/attendance/ — audit docházky, migrace a testovací protokol;
- docs/EMPLOYEE_EXPORTS.md — výkazy a exporty;
- lib/work-time.ts, lib/export.ts, lib/tabular-export.ts, lib/attendance-export.ts — výpočty a exporty;
- tests/ — automatizované testy.

| Oblast | Doložený stav z poslední etapy |
| --- | --- |
| Deník, šichtovnice, servis, revize a exporty | Implementované; před ostrým provozem přejímka skutečných postupů a dat. |
| Docházka, pracoviště, QR/GPS, opravy | Implementované a automatizovaně testované; fyzická kamera/GPS na telefonech nepřejatá. |
| Firemní uživatelská jména a hesla | Serverová implementace připravená; živý Keycloak a firemní přihlášení neověřené. |
| Role vlastníka a odvolání správce | Testované v aplikační vrstvě; infrastruktura a nouzové přístupy vyžadují firemní vlastnictví. |
| Mobilní instalace | Základ PWA a instalační panel existují; skutečné telefony vyžadují test. |
| Kompletní offline provoz | Požadavek, zatím neúplný. |
| Automatické serverové zálohy | Skripty restic a časovač připravené; cíl, aktivace a úplná obnova neověřené. |
| Migrace původních produkčních dat | Plný přenos na vlastní server nebyl dokončen. |
| Ostrá provozní/právní přejímka | Nedokončená. |

Uložený protokol uvádí 106 úspěšných testů, bez selhání, a dokumentace úspěšné sestavení obou variant. Při tomto předání byl protokol přečten, testy nebyly znovu spuštěny. Testování PostgreSQL využívalo PGlite/WASM; identity měly nahrazené HTTP odpovědi. Není to důkaz živého běhu celé serverové sestavy.

Současný nasazený stav webu nebyl při sestavení tohoto souhrnu znovu ověřován. Rozhodující jsou načtené zdroje, protokoly a poslední předání, nikoli domněnka o dostupnosti webu.

## 10. Data, zálohy a přechod na vlastní server

Požadavek: automatická šifrovaná záloha mimo hlavní server, firemní kontrola přístupů a klíčů, ruční export a skutečně otestovaná obnova.

Předchozí výpis databáze zkracoval dlouhé payloady a neobsahoval samotné soubory R2. Není úplnou provozní zálohou. Před přenosem získat úplné tabulky a přílohy, ověřit počty, ID, revize a kontrolní součty souborů.

Převod identit provádět výslovnou mapou, zachovat autorství a audit. Nespárovat zaměstnance automaticky jen podle podobného jména. Přenos vyzkoušet v oddělené kopii, potom řízeně zastavit původní zápisy, přenést rozdíly a přepnout. Dva systémy nesmějí vytvářet konfliktní autoritativní historii.

Před ostrým provozem určit server, doménu, skutečného vlastníka, úložiště záloh, pravidla obnovy a tolerovanou ztrátu dat. Denní záloha může znamenat ztrátu téměř celého dne; firma musí určit, zda potřebuje častější ochranu.

## 11. Budoucí rozšíření — Technik v kapse

Požadované navazující rozšíření: servisní AI nad oprávněně dostupnými manuály konkrétního stroje a servisní historií. Odpověď má uvést dokument, verzi a stránku, odlišit doložený údaj od hypotézy a nehádat utahovací momenty, elektrická zapojení ani bezpečnostní postupy.

Má pomáhat technikovi v terénu s diagnostikou a evidencí zásahu. GPS docházka a AI byly také uvažovány jako samostatně nabízené moduly. Funkční napojení servisní AI ani konkrétní obchodní podmínky tímto předáním nejsou potvrzené. Jde o další etapu po spolehlivém dokončení základní aplikace.

## 12. Doporučené pořadí další práce pro Grok

1. Načíst skutečný archiv, určit verzi a porovnat funkce s tímto dokumentem; nic neoznačovat jako hotové pouze podle textového popisu.
2. Zajistit úplnou zálohu a ověřit obnovu v izolovaném prostředí.
3. Zkontrolovat výpočty, přestávky, prostoje, více strojů, noční směny a shodu všech exportů.
4. Dokončit offline deníky, servis, přílohy, obnovu relace a synchronizační konflikty.
5. Zprovoznit vlastní infrastrukturu a skutečné účty s firmou jako vlastníkem; oddělit jemnější oprávnění.
6. Přejmout celé pracovní postupy na skutečném Androidu a iPhonu včetně kamery, GPS a režimu letadlo.
7. Uzavřít s firmou pravidla evidence, potvrzování, oprav, GPS, uchování a záloh.
8. Migrovat data až po úspěšné přejímce a připravit návratový plán.
9. Teprve potom rozšiřovat servisní AI a další moduly.

Přejímací scénář musí projít od osobního přihlášení přes pracoviště, docházku, dva stroje, servis a závadu, offline uložení a opětovné odeslání až po zobrazení vedoucímu, opravu s historií, PDF/XLSX a obnovu zálohy. Ověřit také zamítnutí přístupu cizí osoby, deaktivaci správce vlastníkem a zachování historie deaktivovaného zaměstnance.

## 13. Co má Grok vrátit uživateli

- Srozumitelné potvrzení účelu a hranic aplikace.
- Tabulku skutečně ověřeno / připraveno / chybí s odkazy na konkrétní zdroje a testy.
- Konkrétní seznam oprav a priorit; ne další obecný slib.
- Při vývoji upravené skutečné soubory, migrace, výsledky testů a popis rizik.
- Exporty shodné s aplikací, pravdivý audit a bezpečný návrat při migraci.
- Pouze nezbytné otázky: neznámý vlastník firmy, infrastruktura, originální firemní formulář či provozní pravidlo.

## 14. Právní a projektové zdroje

Právní zdroje byly znovu konzultovány 26. 10. 2026 v níže popsaném rozsahu. Dynamický úplný text některých předpisů v e-Sbírce nebyl dostupný; konkrétní závěry byly opřeny také o oficiální výklady a původní projektový právní audit. Před ostrým nasazením ověřit účinné znění a působnost ke konkrétnímu provozu.

[L1] SÚIP — Převoz stroje ze zahraničí a uvedení do provozu, výklad § 2 a § 4 NV 378/2001 a zákona 309/2006; dostupný plný text:
https://suip.gov.cz/vsechny-clanky/-/asset_publisher/BwIpyjT9IXe0/content/prevoz-stroje-ze-zahranici-do-ceske-republiky-a-jeho-uvedeni-do-provozu
Oficiální předpis: https://e-sbirka.gov.cz/sb/2001/378

[L2] NV 591/2006 a novela 319/2025:
https://e-sbirka.gov.cz/sb/2006/591
https://e-sbirka.gov.cz/sb/2025/319
Oficiální evidence novely: https://public.psp.cz/sqw/text/sbirka.sqw?cz=319&r=2025
Konkrétní ustanovení o závadách navazuje na přečtený projektový audit z 23. 10.; úplný aktuální text e-Sbírky se při tomto čtení nenačetl.

[L3] SÚIP — Provozní deníky v elektronický verzi, 9. 9. 2024; plný text znovu přečten:
https://suip.gov.cz/vsechny-clanky/-/asset_publisher/BwIpyjT9IXe0/content/provozni-deniky-v-elektronicky-verzi

[L4] MZe — text § 166 stavebního zákona, plný text znovu přečten:
https://mze.gov.cz/public/portal/mze/legislativa/vap96922-51319
Oficiální předpis: https://e-sbirka.gov.cz/sb/2021/283

[L5] MMR — vyhláška 131/2024, otevřená stránka i připojený text předpisu; § 10 / příloha 12:
https://mmr.gov.cz/cs/ministerstvo/stavebni-pravo/pravo-a-legislativa/novy-stavebni-zakon/vyhlasky/navrh-vyhlasky-o-dokumentaci-staveb

[L6] MPSV — Evidence pracovní doby, výklad § 96; plný text znovu přečten:
https://ppropo.mpsv.cz/VIII9Evidencepracovnidoby

[L7] Ministerstvo vnitra — zásady a právní důvody podle GDPR; plný text znovu přečten:
https://mv.gov.cz/gdpr/zasady-zpracovani-osobnich-udaju

[L8] WP29, stanovisko 2/2017 ke zpracování údajů na pracovišti, zveřejněné ÚOOÚ; interpretační podklad, nikoli nový zákon:
https://uoou.gov.cz/media/zahranici/dokumenty/ostatni-dokumenty-sboru/stanovisko-2-2017-ke-zpracovani-udaju-na-pracovisti.pdf

Další předpisy k ověření podle konkrétní funkce:
https://e-sbirka.gov.cz/sb/2006/262
https://e-sbirka.gov.cz/sb/2012/89
https://e-sbirka.gov.cz/sb/2016/297
https://e-sbirka.gov.cz/sb/1988/61
https://e-sbirka.gov.cz/sb/1989/26
https://e-sbirka.gov.cz/sb/1989/51
https://eur-lex.europa.eu/legal-content/CS/TXT/?uri=CELEX:32016R0679

Projektové podklady skutečně přečtené při tomto předání: poslední etapa PWA z 23. 10., standalone README, právní audit deníku, dokumentace exportů, související výpočetní/exportní kód a uložený protokol 106 testů. Nový běh testů, živý server, produkční databáze ani fyzické telefony nebyly součástí této souhrnné kontroly.

