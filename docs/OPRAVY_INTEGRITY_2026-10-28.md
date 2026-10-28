# První opravy auditu: přístup, revize a synchronizace

Zdroj: `main-2` na `a16b309`. Řeší AUD-03, AUD-04, AUD-05, AUD-11 a AUD-14 z auditu v PR #24.

- Vlastník záznamu se ověřuje i před idempotentní odpovědí na PUT.
- Pravidelný servis povoluje role owner/operations_manager nebo explicitní zařazení mechanik, strojník/mechanik či externí servis. Název zaměstnance ani výběr dodavatele oprávnění neudělují. **Stávající účty se nepřevádějí**; správce musí oprávněnému pracovníkovi přiřadit odpovídající zařazení. Výběr „externí firma“ nadále popisuje provedenou práci.
- Globální mazání vrací 410; žádná data se tímto PR nemažou. Selektivní čisticí návrh PR #3 se neslučuje automaticky.
- Unikátní revize v existující `record_versions` je bodem potvrzení zápisu. Jen vítězná revize se promítne do `records`. Zápis přerušený po uložení revize lze dokončit při opakování nebo startu; staré revize bez nového příznaku se nepřepisují. Není vyžadován replica set ani změna architektury MongoDB.
- Fronta ukládá neměnný obsah každé operace a rozpracovanou novější úpravu nepřepisuje odpovědí staršího požadavku. Souběžná úprava dostane navazující základní revizi. Při změně účtu se zahodí pouze opožděné odpovědi v paměti; jeho vlastní fronta zůstává uložená.
- Fronta a lokální zápisy se ukládají jedním atomickým IndexedDB záznamem `sync-v2`; při prvním otevření se načtou i původní klíče. Nesmazat data prohlížeče během aktualizace. Starší aplikace nový klíč neumí číst, proto při rollbacku nejprve synchronizovat a zajistit kopii lokálních konceptů.

Ověření: 58 Python testů prošlo včetně opravy cizího retry, souběhu se stejnou revizí, obnovy po přerušení a zakázaného wipe; 10 existujících React testů prošlo. Node regresní test používá skutečný sync modul s izolovanými adaptéry a ověřuje pomalou odpověď i přepnutí účtu. GitHub CI nově spouští obě nové sady. Výsledek buildu se uvádí v PR.

Před sloučením: revize změn, CI s reálným MongoDB a kontejnerem; před nasazením ověřit na testovacím telefonu restart během odesílání a upgrade staré lokální fronty. Opakování vedlejších efektů (např. push po pádu procesu) není tímto změněno na garantované doručení. Žádné produkční účty, historické záznamy ani cloud konfigurace nebyly upraveny. PR není nasazení.
