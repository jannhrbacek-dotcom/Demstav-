# Verzované týdenní balíky a převzetí — #22

Generátor používá pro PDF/XLSX/CSV potvrzené záznamy, zatímco kontrola zahrnuje i koncepty. Blokuje předání při konceptech, rozporných MTH, neověřené osobní jízdě, překryvech, nevyřízené docházce, docházce bez deníku a chybějících přílohách. Kontrola serveru nemůže zjistit neodeslanou frontu v jednotlivých telefonech; omezení je výslovně uvedené. Schválená nepřítomnost bez práce není chybějící deník a má vlastní výstup v balíku. Diagnózy/soukromé poznámky se do něj nepřenášejí.

Každé generování má nové export_id, číslo verze, neměnnou cestu souborů, otisky SHA-256 a manifest zdrojových revizí a schválení. Původní archiv se při prvním novém generování zachová jako verze 0; staré soubory se neodstraňují ani nepřepisují. Přijetí pozdějšího balíku není přepsáním předchozího. Download ověřuje otisk souboru.

Stavy: Návrh → Předáno v aplikaci → Převzato / Vráceno k opravě. Předávající zvolí konkrétního aktivního příjemce z vedení. Příjemce musí být jiný člověk. Rozhodnout může jen určený příjemce, s kontrolou souběžného stavu a povinným důvodem vrácení. Před předáním se znovu porovná otisk zdrojů: po změně podkladů je nutná nová verze. Odesílá se pouze interní push s odkazem do autentizované aplikace, nikoli PDF e-mailem. Zaznamenání předání v aplikaci ani odpověď push služby není důkaz doručení na telefon.

UI uvádí skutečný stav a již neslibuje nedoložené automatické pondělí v 5:00. Nový plánovač v existujícím procesu FastAPI používá Mongo lease, nejvýše tři pokusy a stabilní identitu balíku týdne. Po restartu převezme nedokončenou úlohu až po vypršení lease; opakování nemá znovu vytvořit ani předat stejný balík. Blokující podklady automatické předání zastaví a příjemci se upozorní na kontrolu. Oprava vyžaduje novou ruční verzi. Živá konfigurace není měněna.

**Výchozí stav je vypnutý.** Aktivace vyžaduje výslovnou konfiguraci `WEEKLY_EXPORT_SCHEDULE` ve tvaru JSON s `enabled: true`, celočíselným `weekday` (0=pondělí), `hour`, `minute` a explicitním seznamem `recipients` (ID aktivních oprávněných příjemců). Čas není v kódu předvolen. Konfiguraci nastavit až po revizi, se schváleným termínem a testovacími účty; neaktivovat současně druhý nezávislý plánovač. UI zobrazuje konfiguraci, poslední kontrolu a stav úloh. Samotná konfigurace není potvrzením úspěšného doručení. Legacy cron endpoint sdílí identitu týdenního balíku, ale neaktivuje se žádnou změnou UI.

Před produkcí nutno ověřit chování lease při ukončení/restartu skutečného kontejneru, reálné push a výkon instance. Scheduler neprovádí automatické převzetí za příjemce.

Závislost před ostrým použitím: PR #26 dodává správný union a osobní minuty jízdy; bez něj kontrola staré jízdy správně požaduje opravu. PR #25 chrání integritu zdrojových záznamů. Před sloučením musí projít společná integrační větev. Staré podepsané deníky ani účty se nemigrují. Nové kolekce verzí/čítače používají stejnou MongoDB a úložiště.

Testy: nezávislé soubory dvou verzí, dostupnost staré verze, adresné převzetí, zákaz vlastní akceptace, neplatnost návrhu po změně podkladů, blokující koncept a PDF zaměstnance jen s dovolenou. Přesný souhrn v PR. Zbývá vizuální kontrola firemního vzoru a fyzické telefony, aktivace živého plánu a skutečné doručení. Neuzavírat celý #22 pouze na základě těchto testů.
