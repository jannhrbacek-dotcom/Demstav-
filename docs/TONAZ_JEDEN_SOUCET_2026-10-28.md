# Jeden součet vážních lístků — #5/#6

Server počítá `tonnes` pouze z kompletních hmotností lístků. Ručně dodané souhrnné číslo jej nemůže přepsat. Neúplný součet je koncept; poznámka již neobchází povinnost doplnit všechny hmotnosti. Odevzdání vyžaduje potvrzení, že směna skončila, a server nepřijme budoucí konec směny. UI nevyžaduje ruční přepis součtu.

Nový/opravený výkaz může uložit pouze pověřený zaměstnanec nebo vedení. Pokud pověření dosud není nastavené, vedení je nastaví v existující obrazovce; PR nikoho automaticky nepověřuje. Dnes nabídne tonáž pouze pověřeným a vedení, s instrukcí po skončení směny.

Pro kombinaci datum/odběratel/pracoviště/zakázka/název směny se připouští jeden společný výkaz. Nové sparse unikátní indexy chrání identitu směny a ověřené otisky/identifikátory lístků. Kontrola běží i uvnitř jednoho výkazu. Existující výkazy se nepřepisují a nová pole dostanou až při novém uložení. Číslo lístku je pro deduplikaci omezeno na zákazníka a datum; různí vydavatelé se stejným číslem u stejného zákazníka vyžadují provozní rozlišení před nasazením.

PDF s přílohami zůstává; přidán autentizovaný XLSX/CSV přehled lístků a kontextu směny. Není tím dokončen celý zákaznický výkaz z #5: samostatné fakturovatelné řádky více strojů, přesné vizuální porovnání s původním papírem a auditovaný podpis odběratele stále chybějí. Jméno ani odevzdání se nevydává za podpis.

Testy ověřují odvozený součet 10,50 + 20 = 30,50, nemožnost nahradit chybějící váhu poznámkou, pověření, opakování stejné operace, duplicitní směnu a stejné fotografie napříč výkazy. Existující testy byly upraveny podle nového potvrzeného pravidla; dřívější povolení ručního nesouladu už není správné očekávání. Souhrn výsledků je v PR. Před nasazením vyžadována revize indexů na kopii DB, reálné Mongo testy souběhu a kontrola telefonu. Žádná produkční data ani pověření nebyla změněna.
