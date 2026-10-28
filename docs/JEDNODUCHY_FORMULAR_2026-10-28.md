# Denní formulář a obnova konceptu — #20

Hlavní pořadí stávající obrazovky je nyní datum/stroj/pracoviště → pracovní čas a popis → vlastní MTH. Servis, přejezd a závada jsou rozbalovací části. Doprava, kontroly, kapaliny, předání a přílohy jsou pod Další údaje. Všechny původní hodnoty zůstávají v jednom formuláři a procházejí původní validací; chyby otevřou doplňující údaje. Nejde pouze o zvětšení písma.

Skrytí sekce nemaže obsah. Původní destruktivní Ano/Ne volby byly odstraněny. CSS jednoduchého režimu už z formuláře neskrývá vyplňovatelná pole příloh a kapalin. Sekce má aria-expanded a vazbu na ovládaný obsah. MTH mají na úzkém displeji jeden sloupec; ukládací panel je součástí toku stránky.

Rozepsaný formulář se ukládá průběžně do IndexedDB odděleně podle účtu a ID/nového zápisu. Uchová původní základní revizi pro kontrolu konfliktu při odeslání. Obnova po návratu či restartu proto nesmí přepsat novější serverovou revizi bez konfliktu. Uložený koncept se smaže až po předání do synchronizační fronty; opožděný autosave jej nemůže znovu vytvořit. Při chybě úložiště je zřetelná chyba a formulář neslibuje úspěšné uložení.

Ověřeno: 14 React testů (8 sad), včetně skutečného DOM formuláře, pořadí hlavních sekcí, zachování servisu při skrytí a uložení, obnovy konceptu a izolace účtů. Produkční build se ověřuje před PR. Nejde o vizuální test telefonu: Android/iPhone, klávesnice, 320–428 px a aktualizace PWA zůstávají na staging kontrolu. Navazující oprava významu Jízda a jeho polí je v PR #26; pravomoci servisu v PR #25. Před sloučením všech větví vyžadovat společný test, nepřenášet starší znění těchto polí přes novější opravy.

Žádné historické záznamy, účty ani produkční prostředí nebyly změněny. Řeší AUD-12/13/20 a část AUD-23. Ostatní úkoly se tímto neuzavírají.
