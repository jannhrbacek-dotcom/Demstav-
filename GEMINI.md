# DEMSTAV OPERATIONS – instrukce pro Gemini

**Než začneš měnit kód, přečti kompletní [předání projektu](docs/GEMINI_HANDOFF_2026-10-28.md).** Je tam stav projektu, seznam otevřených úkolů #5, #6, #7 a #17 až #23, schválená pravidla šichtovnic, tonáže, GPS, OCR, Androidu a postup připojení na GitHub.

## Správná větev a pracovní postup
- Repo: `jannhrbacek-dotcom/Demstav-`.
- **Produkční zdrojová větev: `main-2`; výchozí GitHub `main` není totéž.**
- Nepracuj přímo na `main-2`. Vytvoř novou větev podle čísla issue, např. `fix/20-simple-mode-gemini`, a předlož PR **do `main-2`**.
- Nesmíš bez předchozí kontroly měnit živou DB, účty, podpisy, soubory uživatelů, cloud konfiguraci, tajemství či release.
- Proveď testy a uveď jejich skutečné výsledky. Nepředstírej, že implementace, nasazení, OCR či propojení s druhým modelem už fungují.
- Zachovej odděleně docházku, skutečné pracovní hodiny, motohodiny strojů a celkovou tonáž posádky. Servis/prostoje/přejezdy nesčítej dvakrát.
- Když něco chybí, dej přednost bezpečnému návrhu nebo PR bez deploye před neověřeným zásahem.

## Nejbližší priority
1. [#20](https://github.com/jannhrbacek-dotcom/Demstav-/issues/20): oprav **skutečně jednoduchý formulář**, nejen velikost písma.
2. [#22](https://github.com/jannhrbacek-dotcom/Demstav-/issues/22): týdenní předání šichtovnic s kontrolou a převzetím vedením.
3. [#5](https://github.com/jannhrbacek-dotcom/Demstav-/issues/5), [#6](https://github.com/jannhrbacek-dotcom/Demstav-/issues/6): jeden součet tonáže **až po skončení směny** ze všech vážních lístků.
4. [#18](https://github.com/jannhrbacek-dotcom/Demstav-/issues/18): test bezplatného open-source OCR na českém rukopisu, jeden potvrzený digitální záznam.
5. [#19](https://github.com/jannhrbacek-dotcom/Demstav-/issues/19), [#21](https://github.com/jannhrbacek-dotcom/Demstav-/issues/21): push žádostí a přehled absencí.
6. [#17](https://github.com/jannhrbacek-dotcom/Demstav-/issues/17), [#23](https://github.com/jannhrbacek-dotcom/Demstav-/issues/23): GPS a Android APK/AAB, nejdříve interní test, nikoli nepřetržitý monitoring bez právní revize.

## Hranice práce
- Tohle je **veřejný repozitář**: žádné tajné klíče, hesla, produkční fotografie rukopisů ani osobní údaje v commitech, issues, promtech a testech.
- Webová aplikace Gemini s importem GitHubu čte snímek repozitáře, **nedává ti automatické právo zápisu**. Nástroj pro git zápis musí být zvlášť autorizovaný.
- Každé tvrzení o stavu opři o aktuální soubory, testy a stav nasazení.
