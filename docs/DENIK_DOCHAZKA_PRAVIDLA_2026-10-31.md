# Oddělení strojního deníku, docházky a šichtovnice

## Rozsah změny

Docházka zůstává samostatným zdrojem událostí zaměstnance. Nový zápis nabízí převzetí příchodu/odchodu do prázdné zaměstnanecké směny jedním tlačítkem; je to návrh vyžadující kontrolu skutečné práce. Doba přítomnosti není sama o sobě odpracovaná doba a už vůbec ne čas chodu stroje. Při otevřené směně se neodhaduje konec. Po zapsání odchodu může návrh dokončit odpovídající prázdný konec; změněné ruční časy nepřepisuje. Časy jsou v Europe/Prague. Události čekající na schválení, cizí účty, neplatná návaznost a nejednoznačné noční směny se nepřenášejí. Zdroj návrhu je posledních 31 dní serverové docházky včetně účtově oddělené offline cache; lokální neodeslané události nejsou potvrzená docházka.

Pokud pro den již existuje jiný zápis s časem, celá směna se nepřenese znovu. Uživatel rozděluje skutečné úseky mezi stroje. Současný datový model má zaměstnanecké úseky u jednotlivých zápisů; tato změna jej bez migrace nepřevádí na jeden samostatný denní timesheet. Pracoviště se doplní jen do prázdného pole, stejně jako jeho ID. Návrh nemění historii docházky.

Návrhy popisu práce se řadí podle četnosti potvrzených minulých zápisů stejného stroje a účtu. Navíc jsou dostupné Obsluha linky a Odvoz od třídiče. Nejde o potvrzenou dnešní práci; uživatel návrh volí. Již vyplněný popis se mění až po výslovném potvrzení. Servisy, závady, potvrzení kontrol, podpisy a konečné MTH se nekopírují. Návrhy počátečních MTH používají dříve zavedenou návaznost na stroj.

## Strojní deník

PDF a XLSX deníku používají explicitně povolené strojní položky podle dosavadního firemního vzoru: datum, směna, identita stroje, obsluha/posádka, stavba, práce stroje, kontroly, závady a opravy, servis, MTH, doplněné kapaliny, předání a identifikace revize. Nevstupuje zaměstnanecká směna, příchod/odchod, SPZ pro cestu do práce, ubytování, cestovní čas, fakturační souhrny ani obecná zaměstnanecká poznámka. Skutečné předání stroje a servis zůstávají zachované. Návrh popisu je třeba před potvrzením věcně zkontrolovat; software nemůže z volného textu zaručit pravdivost činnosti.

Výchozí export obsahuje potvrzené zápisy; koncepty lze přidat výslovně a jsou označené. Export ověřuje řetězec revizí i plnou shodu aktuálního záznamu s posledním snapshotem. Nepodepsaná starší data bez historie nebo manipulace znamenají chybu 409 a požadavek na prověření, nikoli tichou migraci či vymyšlení historie. Servisní přílohy se kontrolují proti SHA-256 uloženému v revizi. Změněná či nedostupná příloha export zastaví.

Potvrzené záznamy se opravují existujícím postupem s důvodem, novou revizí a auditní stopou. Excel má zamčené buňky a strukturu; text se nevyhodnocuje jako vzorec. Tyto ochrany nejsou šifrování ani kvalifikovaný elektronický podpis a lze je externím editorem obejít. Hashový řetězec nebrání správci databáze přepsat celou historii včetně hashů. Autoritativní data zůstávají na serveru a vyžadují omezení přístupu i nezávislé zálohy. Změny neodstraňují původní data a nedoplňují chybějící podpisy či kontroly.

## Právní a normativní hranice – veřejné zdroje ověřené 31. 10. 2026

- MPSV, Evidence pracovní doby, § 96 zákoníku práce: zaměstnavatel nese odpovědnost za evidenci; samotná přítomnost na pracovišti není evidence odpracované doby. https://ppropo.mpsv.cz/viii9evidencepracovnidoby
- SÚIP, Provozní deníky v elektronický verzi (9. 9. 2024): stanovisko k VTZ požaduje prokazatelnost konkrétní osoby a času vložení a zajištění proti zpětné manipulaci. Stanovisko k VTZ není univerzálním schválením aplikace pro všechny stroje či všechny druhy elektronických podpisů. https://suip.gov.cz/vsechny-clanky/-/asset_publisher/BwIpyjT9IXe0/content/provozni-deniky-v-elektronicky-verzi
- SÚIP, Otázky a odpovědi / stroje: odkazuje na zákon 309/2006 Sb. a NV 378/2001 Sb., provozní dokumentaci, kontroly a požadavky návodu výrobce či místního provozního bezpečnostního předpisu. https://suip.gov.cz/bezpecnost-prace-otazky-a-odpovedi
- Primární odkazy NV 591/2006 Sb. a NV 378/2001 Sb.: https://e-sbirka.gov.cz/sb/2006/591 a https://e-sbirka.gov.cz/sb/2001/378. Veřejný textový nástroj z těchto aktuálních stránek nevrátil čitelný obsah; nejde o tvrzení, že byl kompletně ověřen každý paragraf aktuálního znění.
- Agentura ČAS vysvětluje ověřování platnosti a dostupnosti textů konkrétních ČSN: https://dap.agenturacas.gov.cz/PPV/Detail?guid=1bc6be0b-20ff-4c0d-a59b-cdac3a4767e8

Nelze tvrdit obecnou certifikaci souladu se všemi aktuálními zákony a normami pouze na základě těchto úprav. K úplnému posouzení chybí schválený rozsah pro konkrétní typy strojů/VTZ, jejich návody výrobce a příslušné MPBP, aktuální příslušné ČSN, pravidla podpisů a uchovávání dokumentace. Před ostrým nasazením strojní export porovnat s platným firemním vzorem a nechat rozsah potvrdit odpovědnou osobou BOZP/provozovatele. Přehled směny není stavební deník stavby.
