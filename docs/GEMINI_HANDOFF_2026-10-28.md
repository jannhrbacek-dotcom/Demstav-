# DEMSTAV OPERATIONS – předání projektu Gemini (28. 10. 2026)

> Účel: předat Gemini bezpečně a úplně kontext projektu, prioritizované úkoly a ověřitelný postup práce. Toto je **zadání pro vývoj**, nikoli tvrzení, že je něco již naprogramováno. Dokument neobsahuje hesla, API klíče ani osobní údaje pracovníků.

## 1. Kde je pravda a co se NESMÍ poplést

- Repozitář: https://github.com/jannhrbacek-dotcom/Demstav-
- **Provozní vývojová větev: `main-2`** (kontrolováno 28. 10. 2026, commit `e8078db1021baacc42b60a778494a29cc498b380`). **Výchozí branch na GitHubu je `main`, ale Render používá `main-2`.** Nezakládej PR do `main` automaticky.
- Render služba: `demstav-operations` (web PWA + FastAPI), `render.yaml` sleduje `main-2`, automatické nasazení vypnuté. Poslední ověřený Render deploy byl LIVE pro commit uvedený výše; stav nové práce musíš ověřit znovu.
- Frontend: React 19, PWA; `frontend/src/pages/`, `frontend/src/lib/`, `frontend/public/manifest.json` a `frontend/public/sw.js`. 
- Backend: Python FastAPI, MongoDB, `backend/server.py`, `backend/routes_*.py`, `backend/exports.py`, `backend/worktime.py`, `backend/routes_data.py`.
- GitHub issue ≠ implementace. Nové požadavky jsou otevřené a nebyly ověřeny jako nasazené. Tvrzení o hotovém stavu musí být doloženo změnou v kódu, testy, PR a skutečným deploymentem.
- Změny dokumentace lze připravit přímo v repozitáři; změny aplikace vždy vlastní pracovní větev → testy → pull request proti `main-2` → kontrola → řízené nasazení. **Neprováděj neohlášené přímé zásahy do živé databáze, migrace, hromadné přepisy záznamů ani mazání.**

## 2. Hlavní účel produktu

DEMSTAV chce zredukovat papírování strojníků. Denní práce se zapíše **jednou** a využije se pro provozní deník stroje, týdenní šichtovnici, servisní přehled a export pro vedení. Strojník má používat jednoduché velké ovládací prvky, předvyplňování, případně foto-import a offline koncept. Vedoucí má plný, auditovatelný přehled; opravy musí být dohledatelné.

Provozní pravidla:
- **Docházka ≠ začátek práce stroje**, **motohodiny MTH ≠ pracovní hodiny**.
- Strojník může během dne použít více strojů; každý má samostatné MTH a intervaly. Například číslo stroje 2 s řádově 14 000 MTH neprohazovat za jiný stroj; nepřebírat hodnoty bez identity stroje.
- Servis, prostoje a přejezdy jsou **součástí pracovní doby**, nesmí se přičítat podruhé.
- Automatické přestávky jsou 12:00–12:30 a 15:30–16:00, podle průniku se směnou; změna podle schvalované žádosti.
- Offline zápisy mají lokální frontu, ochranu proti duplicitě a audit potvrzení serverem. Neztratí se při přepnutí jednoduchého režimu.
- Schválený společný výkaz **tonáže**: **všechny fyzické vážní lístky se seberou až po skončení směny**; jediný pověřený zaměstnanec je vyfotí/zadá; systém **automaticky spočítá jeden celkový součet hmotností všech frakcí** za společnou směnu. Nikdo nezačíná průběžné zápisy vážních lístků při práci a nevyplňuje ručně celkovou tonáž.

## 3. Otevřené úkoly a priority (stav ověřen 28. 10. 2026)

| Priorita | Issue | Co je potřeba doručit | Ověřený stav |
|---|---|---|---|
| P0 | [#20](https://github.com/jannhrbacek-dotcom/Demstav-/issues/20) | **Jednoduché vyplnění**: místo všech 10 sekcí nahoře datum, stroj, pracoviště, pracovní čas, popis práce, MTH. Servis/přejezd/závada na velká rozbalovací tlačítka, „Další údaje“ pro doplňky. Zachovat všechna již vyplněná data a povinné kontroly. | Zadání otevřené; založena prázdná vývojová větev `fix/simple-mode-record-form-20261028`, nikoli hotový kód. |
| P0 | [#22](https://github.com/jannhrbacek-dotcom/Demstav-/issues/22) | **Týdenní šichtovnice automaticky**: kontrola záznamů, tvorba firemního PDF/XLSX/CSV a bezpečné odevzdání vedoucímu, potvrzení převzetí, audit verzí. Zohlednit dovolené/nemoci. | Částečný kód existuje: `backend/routes_data.py::generate_week`, cron endpoint a archiv; **živý scheduler a automatické doručení nejsou ověřeny**. |
| P0 | [#6](https://github.com/jannhrbacek-dotcom/Demstav-/issues/6) a [#5](https://github.com/jannhrbacek-dotcom/Demstav-/issues/5) | **Společný výkaz a tonáž posádky**: jedno sdílené hlášení a součet všech vážních lístků na konci směny; kompatibilita s PDF/XLSX. Konkrétní součet implementovat podle novějšího potvrzeného provozního pravidla výše; nepřepsat datový model bez migrace. | Požadavky otevřené; stávající `backend/production.py` má jednotlivé lístky i ručně zadaný celkový údaj, ne vždy automatický součet jako jedinou pravdu. |
| P1 | [#18](https://github.com/jannhrbacek-dotcom/Demstav-/issues/18) | **Foto → OCR → návrh digitálního záznamu**: zdarma/open-source model (Hugging Face/PaddleOCR), test na 3–10 českých rukopisech; výstrahy u nejasných MTH, strojů a časů, lidské potvrzení; jeden záznam pro deník i šichtovnici. | Kandidáti rešeršováni; OCR integrace ani ověřená přesnost nejsou hotové. |
| P1 | [#19](https://github.com/jannhrbacek-dotcom/Demstav-/issues/19) | **Notifikace**: vedoucí/vedoucí provozu/jednatel při žádosti o volno; po první fázi dovolené upozornit finálního schvalovatele; výsledek žadateli. Ověřit reálné doručení Android/iPhone. | Část push infrastruktury a volání již existuje; mezikrok a reálné doručení nejsou ověřené. |
| P1 | [#21](https://github.com/jannhrbacek-dotcom/Demstav-/issues/21) | **Přehled absencí** pro vedení/jednatele: kdo, kdy, jaký typ, schváleno/čeká, filtry, kalendář. Nezobrazovat diagnózy/citlivé poznámky. | Backend žádosti eviduje; přehled vedení zobrazuje zatím zejména počet čekajících žádostí. |
| P2 | [#17](https://github.com/jannhrbacek-dotcom/Demstav-/issues/17) | **GPS docházka, okruhy a přejezdy**: PWA MVP jednorázově na začátku/konci. Při cestě tlačítka Zahájit/Ukončit přejezd s časem a místy; bez dvojího započtení. Půlhodinové sledování a živé trasy teprve po právní/technické analýze. | Analýza, nic z nových režimů neprohlašovat za hotové. |
| P2 | [#23](https://github.com/jannhrbacek-dotcom/Demstav-/issues/23) | **Android APK/AAB**: pilot TWA/Bubblewrap z existující PWA, soukromé testování přes Play Console, ověřit QR/kameru, offline, push a GPS. Budoucí nativní background GPS oddělit od TWA a právně posoudit. | Repozitář má PWA manifest + SW, nikoliv Android projekt, APK/AAB ani publikaci. |
| P3 | [#7](https://github.com/jannhrbacek-dotcom/Demstav-/issues/7) | Lokalizace: čeština, angličtina, ukrajinština po uživatelském profilu. | Otevřený úkol. |

**Další rozpracované PR:** [PR #2](https://github.com/jannhrbacek-dotcom/Demstav-/pull/2) (push/servis/směny, míří do jiné větve) a [PR #3](https://github.com/jannhrbacek-dotcom/Demstav-/pull/3) (mazání jen testovacích účtů, staging). **Nepřenášej je slepě**; ověř historii, cílové větve a zda jde o duplicitní změny.

## 4. Bezpečná spolupráce Gemini a ChatGPT

- **GitHub issues a PR jsou společná „nástěnka“**. Oba asistenti čtou stejné issue a soubory a zapisují výsledky do vlastních větví.
- **Žádné dva modely nesmějí současně měnit stejnou větev/soubor bez koordinace.** Každý úkol má vlastní `feature/*` nebo `fix/*` branch, commit, test a PR. Ani jeden model nesmí samovolně merge/push do ostré `main-2` či deployovat Render.
- Doporučené dělení práce: Gemini zpracuje nezávisle OCR výzkum/test a Android TWA pilot; ChatGPT jednoduchý formulář, týdenní výkaz a revizi napojení. To jsou **navržené role**, nikoli agenti aktuálně běžící v pozadí.
- Po každém PR druhý model zreviduje diff (konzistence docházka/šichtovnice/MTH/přestávky, offline, GDPR, mobil, testy). Všechny závěry podložit soubory/řádky/testy.
- **Nezveřejňovat zaměstnanecké osobní údaje, podpisy, fotografie, hesla, VAPID/JWT/API klíče, Render env, produkční DB dump nebo telefonní čísla**. Repozitář je veřejný. Vzorové testovací podklady anonymizovat; secrety pouze v důvěryhodném úložišti, nikdy v issue/PR.
- Záloha a návratový bod před zásahy do databáze; neměnit práva, produkční účty a potvrzené šichtovnice bez schválené revizní procedury.

## 5. Jak napojit Gemini na GitHub

### Varianta A – rychlá analýza v Gemini webu (bez zápisu kódu)
1. **Na počítači** otevřít https://gemini.google.com. Podle oficiální nápovědy vkládání GitHub repozitáře není podporované v mobilní aplikaci.
2. Do konverzace: **Add file → More uploads → Import code** a vložit odkaz `https://github.com/jannhrbacek-dotcom/Demstav-/tree/main-2` (nebo přímo repo a vybrat `main-2`).
3. Je-li vyžadováno, propojit účet GitHub a povolit přístup **jen k příslušnému repozitáři**.
4. Zkopírovat úvodní prompt z části 6 tohoto souboru; Gemini musí ověřit, že opravdu vidí `main-2`, `GEMINI.md` a jednotlivé issues.
5. Omezení: import je **jednorázový snímek**, neaktualizuje se automaticky; v Gemini webu **nelze tímto připojením přímo commitovat/pushovat ani procházet issue/PR metadata**. Pro změny je potřeba vývojářské prostředí s git přístupem.

Oficiální návod: https://support.google.com/gemini/answer/16176929

### Varianta B – skutečné kódování a PR
1. Na počítači v podporovaném vývojářském prostředí s Gemini agentem (Google Antigravity nebo jiné prostředí s git integrací) klonovat repozitář a checkout `main-2`, případně otevřít existující projekt. Google účet/Gemini Pro není totéž jako vývojářský API kredit.
2. Pro konkrétní issue vytvořit vlastní větev z `main-2` (`git switch -c fix/issue-20-gemini`), implementovat, spustit testy, prohlédnout diff.
3. GitHub autorizaci řešit přes ověřené OAuth/SSH nebo GitHub App s minimem oprávnění. **Žádné osobní tokeny v chatu, souborech ani promptu.**
4. Push do nové větve a PR **do `main-2`**, s odkazem na issue, test reportem a rollback poznámkou. Bez výslovného souhlasu nemergovat ani nenasazovat.
5. Volitelný automatický review agent: placené/podnikové **Gemini Code Assist na GitHubu** podle aktuálních Google Cloud požadavků. Spotřebitelská varianta byla v roce 2026 ukončena; neplést s obyčejným importem v Gemini webu.
6. Pouze chcete-li *automatické* výměny model↔model, vyžaduje to oddělenou orchestraci s OpenAI/Gemini API, klíči, rozpočtem, logy a ochrannou před nekonečnými cykly. Toto **zatím není vytvořeno ani zapnuto**.

Oficiální odkazy:
- https://github.com/google-gemini/gemini-cli
- https://docs.cloud.google.com/gemini/docs/code-review/set-up-code-assist-github
- https://developers.google.com/gemini-code-assist/docs/deprecations/consumer-code-review

## 6. Úvodní zadání pro Gemini – vlož doslova

> Pracuješ na aplikaci DEMSTAV Operations. Nejdřív si přečti soubor `GEMINI.md` a `docs/GEMINI_HANDOFF_2026-10-28.md` a relevantní issues #5, #6, #17 až #23 v repozitáři `jannhrbacek-dotcom/Demstav-`. **Pracovní a produkční větev je `main-2`, nikoli výchozí `main`.** Ověř aktuální commit a nasazení, nic nepředpokládej. Cílem je maximální digitalizace a automatizace, jediné denní vyplnění, týdenní odevzdání šichtovnic ve firemním formátu a jednoduché UI pro strojníky. Nesmíš ztratit staré záznamy, plést MTH dvou strojů, zdvojit servis/přejezdy do pracovní doby ani měnit GDPR nastavení bez posouzení. Prvně proveď krátký audit proti otevřeným issues, vyber jeden izolovaný úkol a připrav konkrétní návrh kódu / testy v nové větvi. Napiš, co je skutečně hotové, co je pouze zadání a co vyžaduje moje rozhodnutí. Nepoužívej produkční osobní údaje ani secrety. Nikdy nemerguj do `main-2` nebo nenasazuj bez řízeného ověření. Pokud máš jen Gemini web s jednorázovým GitHub importem, proveď audit a připrav přesný patch/PR návrh, **nepředstírej přímý přístup pro zápis do GitHubu**.

## 7. Jak poznat skutečně hotový úkol

Hotovo = ověřená změna v souborech na správné větvi + automatické testy + ověření podkladů z reálného provozu bez osobních dat + PR review + bezpečné nasazení Render/Vercel + kontrola produkčního chování + stručný záznam do issue. Pouhé založení issue, textový prompt nebo vytvoření větve hotovou funkci **neznamená**.
