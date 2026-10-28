# DEMSTAV: kontrola OCR a návrh asistenta

## Co bylo ověřeno

Výchozí provozní větev main-2, commit 323f6d9. Sdílený rozhovor byl otevřen a porovnán s kódem a PR. PR #35 (našeptávač, menší historie, další překlady) je samostatná otevřená práce a touto změnou se neslučuje. Živá aplikace zobrazila přihlášení; dvě uživatelem zadaná přihlášení odmítla. Nebyla měněna hesla ani účty. Úplný průchod potvrzením zápisu v produkci proto není ověřen.

Existující tři testy parseru prošly, ale nepokrývaly zápis tisíců s mezerou. Původní parser převedl `MTH začátek: 8 440` na `8` a vynechal `Datum: 28. 10. 2026`. Oprava přijímá celé jednoznačné hodnoty a odmítá neúplná či konfliktní čísla; 8 testů parseru nyní prošlo. Nejde o zlepšení samotného čtení rukopisu.

Nový lokální test Tesseract ces+eng / PSM 6 se stejným předzpracováním jako server proběhl na existujícím digitálním vzoru `reference/denik_p0.png`. Vzor obsahuje dva záznamy, data 22./23. 10. 2026, MTH 11767→11770 a 11770→11773. Automatický výstup vyplnil pouze stroj Liebherr L566/3; datum ani MTH nepřevedl. Použita verze ces z oficiálního tessdata_fast; výsledek není měřením přesné produkční instalace ani novým testem původní ručně psané fotografie L576/5, která v tomto chatu nebyla dostupná. Kvalita OCR stále nestačí pro spolehlivý automatický přepis tabulek.

## Navržený asistent

V novém zápisu nabídnout dva vstupy: fotografii dokumentu a vedené vyplnění. Obě cesty vytvoří strukturovaný koncept, nikoliv potvrzenou směnu. AI vrací pro každé pole hodnotu nebo null a zdroj (fotografie / odpověď / evidence). Nečitelné číslice nevymýšlí. Aplikace sama určuje povinná pole podle druhu práce a klade jen chybějící otázky.

1. Datum, pracovník a evidovaný stroj včetně interního čísla; kontrola záměny podobných strojů.
2. Pracoviště, zakázka a objednatel.
3. Celá směna, skutečné přestávky a případné střídání strojů. MTH nepřevádět na pracovní dobu.
4. Počáteční a konečné MTH, návaznost na poslední potvrzený stav; nesoulad ukázat člověku.
5. Popis práce, výkon a jednotka. Tonáž pouze z úplných vážních lístků a od pověřené osoby.
6. Servis, prostoje, závady, kontroly, kapaliny, doprava a SPZ podle potřeby. Nevytvářet podpisy ani tvrzení o provedené kontrole.
7. Fotografie vedle editovatelného návrhu, chybějící hodnoty zvýraznit; až po potvrzení uživatelem uložit jeden zdrojový záznam s auditní stopou a ochranou před duplicitou.

Pevný seznam chybějících údajů může fungovat bez AI a bez tokenových nákladů; model potřebujeme zejména na fotografii a převod volné odpovědi. Konverzace má být CZ/UK podle volby uživatele. Provozní deník stroje není sám o sobě úplným stavebním deníkem; před doplněním tohoto modulu je potřeba stanovit jeho samostatná pole a oprávnění.

## Open source pilot

Qwen3.5-4B (Apache 2.0) umí text i obraz a je vhodný kandidát pro jeden společný model. Menší Qwen3.5-2B porovnat jako úspornou variantu; schopnost číst český rukopis není zaručená. PaddleOCR-VL-1.6 (Apache 2.0, přibližně 1B) porovnat jako specialistu na dokumenty a tabulky, ne jako plného doptávacího asistenta.

Současný Render má 512 MB RAM a žádný z těchto modelů se do něj realisticky nevejde. Doporučený pilot: existující firemní PC s 16 GB RAM, krátký kontext, jeden požadavek současně, GPU podle naměřené odezvy. 16 GB je plánovací doporučení, ne změřené minimum. Ollama běží pouze lokálně; worker si úlohy vyzvedává odchozím autentizovaným HTTPS spojením. Nevystavovat veřejný Ollama port. Při vypnutém PC musí zůstat ruční zápis dostupný.

Bez tokenového poplatku neznamená bez nákladů: elektřina, hardware, správa a dostupnost. Nejprve 10–20 anonymizovaných skutečných fotografií s pravdivým ručním přepisem; samostatně měřit správnost stroje, data, MTH a časů, počet oprav a dobu odezvy. Kritické nejistoty vždy předat člověku. Ve výsledné změně je dostupný místní model Qwen3.5-0.8B ONNX OPT přes Transformers.js 4.2.0. Spouští se až na vyžádání v prohlížeči s WebGPU + fp16, nikoli na Renderu; první stažení je asi 0,9 GB. Větší Qwen4B a PaddleOCR zůstávají kandidáty na samostatné PC.

## Cloudové srovnání ověřené 28. 10. 2026

Standardní ceny USD za milion účtovaných tokenů, bez cache, daní a dalších služeb:

| Model | Vstup | Výstup | Poznámka |
| --- | ---: | ---: | --- |
| GPT-6 Luna | 0,10 | 0,50 | Obrazový vstup, textový výstup; první cloudový kandidát pro pilot. |
| Gemini 3.5 Flash-Lite | 0,30 | 2,50 | Text, obraz a zvuk; kandidát pro srovnávací pilot. |
| Gemini 2.5 Flash-Lite | 0,10 | 0,40 | Přístup omezený na dosavadní uživatele, nevhodný základ nového projektu. |

Příklad 1000 zpracování po 4000 vstupních a 1000 výstupních účtovaných tokenech: Luna asi 0,90 USD, Gemini 3.5 Flash-Lite asi 3,70 USD. Není to cena za fotografii: počet obrazových tokenů, délka rozhovoru, opakování a případné reasoning tokeny se liší. Kvalita na denících nebyla u těchto modelů změřena. Doporučení znamená první kandidát k testu, ne záruku že postačí.

Běžná API integrace je účtována odděleně od předplatného ChatGPT a Gemini. Případné individuální kredity nebo podporované sdílení allowance nejsou automatickou součástí této aplikace a nebyly v účtu ověřeny. Pro první ruční porovnání lze využít vlastní předplacené chatové rozhraní; to samo nevytvoří propojení aplikace.

## Primární zdroje

- https://huggingface.co/Qwen/Qwen3.5-4B
- https://ollama.com/library/qwen3.5:4b
- https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/pricing
- https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/billing
- https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform

## Ověření změn

83 backendových testů a 46 frontendových testů prošlo. Produkční frontend sestavení prošlo s existujícími varováními o zdrojových mapách knihovny QR. Nová stručná 8stránková brožura je přístupná z Jak na to a obsahuje skutečné snímky komponent s fiktivními DEMO daty. Nejde o snímky produkční směny. Výsledek živého nasazení je potřeba ověřit samostatně.


## Doplnění 29. 10. 2026 - realizovaná místní varianta

Přidán skutečný lokální inference runtime, model revision
9a4c21d8f724176b0a7edaaed36303044451886e, Apache 2.0. Žádný API klíč,
serverový LLM ani automatické odeslání textu/fotografie. Síť stahuje veřejný
model a runtime. Model se nenačítá při otevření formuláře; uživatel musí
rozbalit AI a výslovně zahájit stažení. Pravidlové otázky na základní i
nepovinné údaje fungují i bez modelu. Nejde o záruku přesného rukopisu.

Výstup má whitelist provozních polí, ověření data/času/MTH/stroje a
samostatné označení hodnot k vložení. Jedna odpověď na začátek směny
nepřepíše existující konec ani další úseky. Změna stroje odstraňuje staré
MTH, pokud nejsou explicitně nahrazené návrhem. AI nevytváří podpis,
intervalový servis ani potvrzenou směnu. Dopravu H:MM, servisní intervaly,
přestávky a společnou tonáž musí dál zkontrolovat příslušné části formuláře.

Veřejná /ai-ukazka je izolovaná zkouška místní AI s fiktivním záznamem,
bez API zápisu, persistence či rozšíření produkčních oprávnění.

Primární implementační zdroje:
- https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX-OPT
- https://huggingface.co/spaces/webml-community/Qwen3.5-0.8B-WebGPU/blob/main/index.html

Předložený dodatečný audit je částečně zastaralý: aktuální Today již má
příchod/odchod před novým zápisem a servisní upozornění až pod nimi;
Absence už používá useLanguage. Neimplementovaná angličtina, zbytek
lokalizace, noční pauzy a serverový STT zůstávají oddělenými ověřovacími
body; tato změna je nevydává za vyřešené.
