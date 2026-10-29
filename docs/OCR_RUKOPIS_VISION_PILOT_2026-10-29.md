# Volitelný přepis rukopisu pomocí obrazové AI (pilot)

Důvod: serverový Tesseract na Renderu rozpoznává tisk, nikoliv spolehlivě český rukopis v tabulkách. Přidán samostatný opt-in endpoint a ovládání pro již přiloženou fotografii. **Původní OCR, manuální zápis i místní Qwen zůstávají zachované.**

## Bezpečný provoz
- Vypnuto bez kombinace \`OCR_VISION_ENABLED=1\` a serverového \`OPENAI_API_KEY\`. Klíč nesmí být v GitHubu, frontendu ani chatu.
- Před odesláním má zaměstnanec výslovný text o externím zpracování a kliká na samostatné tlačítko. Bez kliknutí se fotografie třetí straně neposílá.
- Server kontroluje přihlášení, souhlas, příponu/MIME, 10MB limit, dekódování a 24 MP; fotce odstraní EXIF, úlohu omezuje. Odesílá přes HTTPS pouze do API OpenAI, \`store=false\`, neuchovává výstup v aplikačním DB.
- Výstup je pouze návrh: ve formuláři jsou všechna políčka NEZAŠKRTNUTÁ, automaticky se nepotvrzuje záznam, účet, MTH ani šichtovnice. Každé číslo musí člověk porovnat s fotografií.
- Model standardně \`gpt-6-luna\` (lze změnit \`OCR_VISION_MODEL\`), režim detail \`original\`. Poplatky API jsou oddělené od předplatného ChatGPT a mohou vzniknout při každém kliknutí.
- Žádné automatické nasazení na Render, žádná změna databáze ani tajných klíčů. Zajistit souhlas firmy se zpracováním fotografií externím poskytovatelem.

## Kontroly před nasazením
Spustit \`pytest -q tests/test_ocr_vision.py tests/test_ocr_parse.py\`, příslušné frontendové testy a build. Na anonymizovaných skutečných fotografiích ověřit stroj/den/MTH/čas/práci proti ručnímu přepisu. Při nedostupném API má zůstat původní OCR a ruční zápis funkční. Reálná přesnost rukopisu ani produkční nasazení tímto PR nejsou prokázané.


## Dodatečná ochrana při kontrole formuláře
- Každá uživatelem vybraná hodnota se před vložením validuje stejným validátorem jako lokální průvodce. Neplatné kalendářní datum, poškozené MTH, sestupné MTH a stroj mimo aktivní evidenci se odmítají, i kdyby uživatel pole zaškrtnul.
- Originální fotografie je dostupná pro porovnání v rozbalitelném náhledu, lze ji otevřít ve větším rozlišení. Používá dočasnou URL v prohlížeči a po změně nebo zavření ji uvolní.
- Poškozená fotografie vrací HTTP 400, nesrozumitelná odpověď externí AI se hlásí jako nedostupnost služby. Nikdy z ní nevznikne potvrzený deník.
- Bez dostupných povolení a klíče není externí tlačítko k dispozici. Základní OCR ani ruční zápis tím nejsou ovlivněny.

## Stav pilotu
PR #42 je pracovní návrh, cílová větev je `main-2`. Dokud neprojde CI všech navazujících změn a není potvrzená záloha + firemní svolení s externím zpracováním + API projekt s účtovacím limitem, neslučovat ani nenasazovat. Pro přesnost rukopisu je nezbytná původní čitelná fotografie, nikoli náhled z brožury.
