# Nasazení DEMSTAV z main-2 na Render

Výchozí zdroj: `main-2`, commit `2e10ac59c4ce3aa55e37b708e8e0ec54524cf0bc`.
Tato úprava přidává přenosné nasazení existující aplikace; nepřepisuje ji novou aplikací.

## Co se spustí

- `demstav-operations`: sestavený React a původní FastAPI na jedné HTTPS adrese.
- `demstav-mongo`: MongoDB 7.0.45 na soukromé síti s vygenerovaným heslem.
- Dva trvalé disky po 5 GB: databáze `/data/db`, soubory aplikace `/var/data/objects`.
- Region Frankfurt, placené instance bez uspávání kvůli nečinnosti.
- Kontrola `/api/ready` ověřuje dostupnost databáze. `/api/health` je pouze kontrola procesu.

Rozpočtový pilot: 2 × 7 USD za instance + 10 × 0,25 USD za disk = přibližně
16,50 USD/měsíc. Nezahrnuje daně, přenosy nad limity nebo další placené služby.
512 MB je počáteční pilotní konfigurace, nikoli ověřená kapacita pro celý podnik.
Při nedostatku paměti navyšte příslušnou instanci. Aktuální ceník:
https://render.com/pricing . Placené instance neusínají:
https://render.com/docs/faq . Trvalé disky:
https://render.com/docs/disks . Připojený disk znamená krátký výpadek při novém nasazení.

## Spuštění

1. V Render vytvořit Blueprint z repozitáře `jannhrbacek-dotcom/Demstav-`, větev `main-2`, soubor `render.yaml`.
2. Nastavit `OWNER_EMAIL` na skutečného vlastníka a silné `OWNER_PASSWORD` alespoň 12 znaků.
   Hodnoty vyplnit přímo v Render; nepatří do Gitu ani chatu. Hesla MongoDB a JWT se generují.
3. Spustit obě služby. MongoDB není veřejná. Po úspěšném sestavení a startu ověřit
   `/api/ready`, přihlášení jménem `jednatel` a vynucenou změnu hesla.
4. Správce následně založí skutečné účty admina a vedení. Testovací účty se automaticky nezakládají.
5. Automatické nasazování je vypnuté. Novou verzi nasadit vědomě po testech a záloze.

Stejný Dockerfile lze použít na jiném kontejnerovém hostingu. Potřebuje MongoDB,
`MONGO_URL`, `DB_NAME`, `JWT_SECRET`, údaje pro první účet a trvalý disk `/var/data`.
Alternativou k `MONGO_URL` jsou `MONGO_HOSTPORT`, `MONGO_USERNAME`, `MONGO_PASSWORD`.
Přihlašovací údaje v připojovací adrese se bezpečně kódují.

## Přesun současných dat a návrat

Konfigurace vytváří nové prostředí. Sama nekopíruje data z Emergentu a nemění jeho běh.
Před ostrým přepnutím je nutné:

1. Z původního prostředí bezpečně získat a ověřit konzistentní `mongodump` a všechny
   skutečné soubory příloh. Záloha zdrojového kódu není záloha databáze.
2. Obnovit dump do nové MongoDB a překopírovat každý objekt podle databázových
   `storage_path` a záznamů týdenních exportů přes `storage.put_object` při `STORAGE_BACKEND=local`.
   Přílohy jsou v novém úložišti atomické objekty s metadaty, nekopírovat holé soubory pod odhadnutým názvem.
3. Porovnat počty dokumentů a SHA-256 příloh, ověřit účty a přihlašovací údaje,
   oprávnění, jeden skutečný deník, šichtovnici PDF/XLSX a přílohy.
4. Před změnou adresy nechat telefony synchronizovat fronty na staré adrese.
   IndexedDB a offline fronty jsou vázané na původ webu a na novou doménu se samy nepřenesou.
5. Udělat krátké okno bez zápisů a finální synchronizaci. Staré prostředí ponechat jako
   návratový bod. Po prvních zápisech v novém prostředí vyžaduje návrat nejdřív přenos
   těchto nových dat; pouhé přepnutí adresy by je rozdělilo mezi dvě databáze.

Pravidelně zálohovat MongoDB i objekty do odděleného úložiště a zkusit obnovu.
Samotný trvalý disk není nezávislá záloha. Automatické aplikační zálohy tato konfigurace nezavádí.

## Funkce vyžadující další konfiguraci

- Přepis hlasu: původní kód používá Emergent STT. Cloud instalace tento volitelný
  balíček neobsahuje a bez klíče vrací řízenou nedostupnost 503. Přepis není v novém cloudu aktivován.
- Web Push: vyžaduje stabilní VAPID klíče a ověření skutečného doručení na telefonu.
  Změny z otevřeného PR #2 nejsou součástí tohoto přenosu větve main-2.
- Týdenní automatické exporty: vyžadují externí plánovač a `CRON_SECRET`; samotné API není plánovač.
- QR, GPS a offline režim jsou zachované ve zdrojích. Jejich funkčnost na nové HTTPS adrese
  se musí ověřit v reálném telefonu; jednotkové testy nenahrazují GPS, fotoaparát nebo chování Androidu.

## Ověření předávané změny

`tests/test_cloud_deployment.py`: trvalé uložení a načtení binárního objektu po reloadu,
bezpečnost cest, idempotentní mazání objektu, bezpečné založení vlastníka bez resetu
hesla a bez demo účtů, obsluha SPA a API, české fonty v PDF.
Testy používají náhradu MongoDB v paměti, nikoli skutečnou cloudovou databázi.
Docker build ani cloudový start nejsou ověřené, dokud neproběhnou na cílovém hostingu.

## Kompatibilita jádra Renderu

První nasazení MongoDB 8 skončilo před inicializací databáze chybou SERVER-121912
(nekompatibilita TCMalloc s jádrem hostitele). Pro nové prázdné prostředí je použit
MongoDB 7.0.45, který používá dřívější alokátor. Nejde o downgrade existující databáze.
Soukromý port je explicitně 10000 a WiredTiger cache je pro pilot 0,25 GB.
Odkazy: https://www.mongodb.com/docs/v7.0/release-notes/7.0/ a
https://jira.mongodb.org/browse/SERVER-121912 . Existující MongoDB 8 data se nesmějí
připojit přímo k serveru 7.0; případný převod vyžaduje samostatný ověřený export/import.
