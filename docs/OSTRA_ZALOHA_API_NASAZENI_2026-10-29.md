# DEMSTAV: ostrá záloha a ověření před nasazením

**Cíl:** https://demstav-operations.onrender.com, větev \`main-2\` na Renderu.
**Databáze:** \`demstav-mongo\`, soukromý port 10000, datový disk \`/data/db\`.
**Přílohy:** \`demstav-operations\`, trvalý disk \`/var/data/objects\`.

## Co víme a co nesmíme zaměňovat

Dřívější záloha z 28. 10. 2026 byla hlášena jako
\`/var/data/backups/pre-pr31-20261028T145127Z.tar.gz\` se zkouškou obnovy
18 kolekcí / 72 dokumentů v izolované DB. Tato historie **nedokazuje**
čerstvost ani plnou obnovitelnost současných příloh. V Mongo logu lze vidět
\`demstav_backups.fs.files\` a \`fs.chunks\` z 28. 10., což dokazuje jen vznik
kolekcí, ne správnost či úplnost obsahu.

Render automaticky vytváří snapshoty disků, ale pro MongoDB přímo varuje
před jejich použitím k obnově živé databáze. Potřebujeme \`mongodump\`,
ověřený \`mongorestore\` a kopii objektů **mimo Render**.

Tento repozitář ani GitHub Actions nemají přímý přístup k fyzickým datům
ostré databáze. Úspěšné CI s izolovanou MongoDB není důkaz produkční zálohy.
Nepřidávat neveřejné zálohy, hesla nebo zaměstnanecké fotky do GitHubu.

## Postup s bezpečným režimem bez nových zápisů

1. Vyhlaste krátké okno bez zápisů a synchronizujte všechny offline fronty
   před zahájením. Zaznamenejte aktuální commit, počet dokumentů a příloh.
2. Na Render Dashboard v **demstav-mongo → Shell** nejprve ověřte, že
   \`command -v mongodump\` vrací binárku. Pak spusťte:

   \`\`\`bash
   umask 077
   export DSBACKUP="demstav-$(date -u +%Y%m%dT%H%M%SZ)"
   mongodump --host 127.0.0.1 --port 10000 \
     --username "$MONGO_INITDB_ROOT_USERNAME" \
     --password "$MONGO_INITDB_ROOT_PASSWORD" \
     --authenticationDatabase admin --db demstav \
     --archive="/tmp/$DSBACKUP.archive.gz" --gzip
   test -s "/tmp/$DSBACKUP.archive.gz"
   sha256sum "/tmp/$DSBACKUP.archive.gz"
   \`\`\`

   Poznámka: MongoDB v kontejnerech využívá vlastní autentizaci. Příkazy
   spouštět výhradně v chráněném Render Shell, nezveřejňovat výpis argumentů
   ani hesel. Přesunutí na \`/tmp\` **není bezpečná trvalá záloha**.

3. Zkopírujte archiv přímo z databázové služby na zabezpečené šifrované
   úložiště mimo Render pomocí Render SSH/SCP, nikoliv do repozitáře. Ověřte
   SHA-256 místního souboru. Render SSH databáze:
   \`srv-dbg48bec6qcc73e9scn0@ssh.frankfurt.render.com\`.
4. Na Render Dashboard v **demstav-operations → Shell** vytvořte druhý archiv:

   \`\`\`bash
   umask 077
   export DSOBJECTS="demstav-objects-$(date -u +%Y%m%dT%H%M%SZ)"
   test -d /var/data/objects
   tar -C /var/data -czf "/tmp/$DSOBJECTS.tar.gz" objects
   test -s "/tmp/$DSOBJECTS.tar.gz"
   tar -tzf "/tmp/$DSOBJECTS.tar.gz" >/dev/null
   sha256sum "/tmp/$DSOBJECTS.tar.gz"
   \`\`\`

   Přeneste a ověřte SHA-256 tohoto archivu stejně jako databázi.
   Render SSH aplikace:
   \`srv-dbg4a0ivcj2c73b4ht30@ssh.frankfurt.render.com\`.
5. Obnovte databázový archiv pomocí \`mongorestore\` do **jiné izolované
   databáze / MongoDB instance**, nikdy nepoužívejte \`--drop\` vůči produkční
   DB. Porovnejte názvy a počty kolekcí/dokumentů, čitelnost reprezentativního
   záznamu a všechny vazby k souborům.
6. Archiv příloh rozbalte na odděleném testovacím místě. Ověřte počet
   objektů, SHA-256 a čitelnost několika příloh, včetně fotografie deníku
   a generovaného výkazu.
7. Zapište datum a čas obou archivů, SHA-256, místo nezávislé kopie,
   výsledek testovací obnovy a jméno ověřovatele. Bez tohoto protokolu
   **neslučovat PR ani nenasazovat**.

## API klíč pro OCR

OpenAI Platform: vytvořte *samostatný projektový klíč DEMSTAV OCR* s
rozpočtovým limitem a uložte pouze jako secret do Renderu
\`demstav-operations → Environment\`:
- \`OPENAI_API_KEY\`: tajný klíč, nikdy do repozitáře, komunikace ani prohlížeče;
- \`OCR_VISION_ENABLED=1\`: nastavit až po povolení práce s podnikovými
  fotografiemi a funkčním pilotním testu;
- \`OCR_VISION_MODEL\`: výchozí \`gpt-6-luna\`, ověřit aktuální podporu modelu,
  obrazového vstupu a JSON schémat ve vybraném projektu.

Pouhé nastavení env var může vyvolat restart/nasazení. Nastavit **až po
ověřené čerstvé záloze**. Každý request externí AI vyžaduje výslovný souhlas
uživatele; automatický přepis není automatické schválení výkazu.

## Nasazení a návrat

Po úspěšném CI PR #42 a všech blokátorech:
1. Sloučit PR do \`main-2\` bez přepsání historie.
2. Render služba má \`autoDeployTrigger=off\`, vyvolat jediný vědomý deploy.
3. Vyčkat \`LIVE\` a \`/api/ready = 200\`, ověřit login, český i ukrajinský
   text, PIN na testovacím telefonu, offline frontu, fotograﬁi/OCR, PDF a
   oprávnění zaměstnanec / vedoucí / jednatel.
4. Při neúspěchu přejít na předchozí funkční commit pouze po ověření
   kompatibility uložených offline záznamů. Databázovou obnovu spustit
   výhradně se samostatným schválením a plánem na zachování zápisů od zálohy.

**Stav k 29. 10. 2026:** postup připraven; nová fyzická kopie ostré DB,
obnova příloh, vložení produkčního API klíče a nasazení NEJSOU zatím ověřeny.
