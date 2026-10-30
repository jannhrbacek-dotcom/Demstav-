# Kontrola nasazení DEMSTAV – 30. 10. 2026

## Ověřené nasazení

Produkční služba `demstav-operations` (`srv-dbg4a0ivcj2c73b4ht30`, https://demstav-operations.onrender.com) má poslední deploy `dep-dbhe8g6c6qcc73f6e4jg` ve stavu `live`, commit `8e585af8372d333b613226ff7ef0d2f78af5c97e`. Dokončeno 29. 10. 2026 07:16:19 CET. Tento commit odpovídá hlavě `main-2`. CI: https://github.com/jannhrbacek-dotcom/Demstav-/actions/runs/40827996919.

Nasazené změny 29. října: lokální fotoasistent a průvodce (`8f1c4ec8`), předání OCR a ruční kontrola (`fded3d86`), připomínky servisu (`9bcda477`), dlaždice Více / PR #43 (`bb96c469`), galerie a zámek / PR #44 (`edccf73f`), animace a témata (`825e305e`), kontrast barevných tlačítek (`aea04c0d`), celkové téma a navigace (`8e585af8`). Starší deploye jsou nyní `deactivated`, protože je nahradila novější verze.

Autorství Antigravity nelze z autorů commitů a popisů PR prokázat. Kontrola pokrývá vzdálený repozitář a Render, nikoli neodeslané soubory na uživatelově počítači.

## Samostatná selhávající služba

Oznámení patří službě `Demstav-` (`srv-dbg4psuk1f9s73bbjcjg`, https://demstav.onrender.com), nikoli produkční službě výše. Deploy `dep-dbhdbcnavr4c739mr4lg` commitu `bb96c469` měl úspěšný build, ale při startu spouštěl `uvicorn main:app --host 0.0.0.0 --port $PORT`. Log: `Could not import module "main"`, exit 1. V repozitáři `main.py` není. Správný kontejner spouští `cloud_app:app` z `/app/backend`.

Další rozdíly: chybná služba používá runtime `node`, ne Docker, health check `/healtz` místo `/api/ready` a automatické nasazování při commitu. Nelze opravit jen název modulu a považovat tím službu za ekvivalent produkce: build musí připravit i frontend, systémové OCR závislosti a správné připojení úložiště. Nepropojovat druhou zapisující instanci se stejnou produkční databází bez záměru a ověření architektury.

Nejkratší další krok je určit účel této druhé služby a připravit její konfiguraci konzistentní s tímto účelem. Současná oprava vzhledu její nastavení nemění ani ji znovu nespouští.

## PR #42 a zbývající blokátory

https://github.com/jannhrbacek-dotcom/Demstav-/pull/42 zůstává otevřený koncept. Jeho CI na `69765b60` je úspěšné. Větev obsahuje externí vision OCR a překrývající se starší implementace navigace/zámku; neslučovat ji automaticky přes novější produkční úpravy. Potřebné funkce nejprve porovnat a přenést jednotlivě.

Aktuální produkční záloha MongoDB a příloh včetně testovací obnovy ani produkční nastavení externího OCR nejsou touto kontrolou ověřeny. Historický archiv, samotný snapshot a zelené CI nedokládají aktuální obnovitelnost. Postup: `docs/OSTRA_ZALOHA_API_NASAZENI_2026-10-29.md` ve větvi PR #42. Před zásahem do produkce je třeba získat fyzické archivy, checksumy a protokol izolované obnovy; OCR klíč ani přepínače při tomto auditu neměnit.

## Ověřená záloha po přihlášení – 30. 10. 2026

Databázový dump vytvořen 13:57:55 UTC (14:57:55 CET): `/data/db/backups/demstav-20261030T135755Z.archive.gz`, cca 144 KiB. SHA-256: `1a3724ae32b2b18e985da3904117a21b4607b4adad2d30c60876225443e7ad3e`.

Zkušební obnova proběhla do samostatného namespace `backup_verify_20261030T135901Z` na stejné MongoDB instanci, bez přepisování produkční databáze. Ověřeno 20 kolekcí / 121 dokumentů; počty dokumentů i indexů bez rozdílů. Následné SHA-256 porovnání serializovaného obsahu všech kolekcí potvrdilo úplnou shodu ve 14:00:04 UTC. Ověřovací DB je ponechána, nebyla smazána. Nešlo o obnovu na nezávislé instanci. Soubor protokolu má příponu `.verification.json` vedle archivu.

Přílohy archivovány ve 14:00:42 UTC: `/var/data/backups/demstav-objects-20261030T140042Z.tar.gz`, cca 11 MiB / 3 soubory. SHA-256: `8a5b744a4f19fabe54f82780cda7a495fd6edeff0ceafcfc66c623dceedd39b7`. Archiv lze celý přečíst; SHA-256 obsahu každého souboru z archivu odpovídá zdrojovému souboru. Kontrolní protokol je ve stejném adresáři. Soubory nebyly přepisovány ani rozbalovány do produkčního úložiště.

**Stále zbývá:** nezávislá kopie obou archivů mimo Render a ověření checksumů v cíli, ověření vazeb příloh a vizuální kontrola opravy. Archivy jsou zatím pouze na příslušných trvalých discích Renderu. Web Shell nenabízí stažení souborů a pro SSH nebyl nastaven přístup. Proto stále neproběhl merge ani deploy PR #45. CI na kódu `16954879` před touto dokumentační aktualizací prošlo celé: https://github.com/jannhrbacek-dotcom/Demstav-/actions/runs/41064100607.
