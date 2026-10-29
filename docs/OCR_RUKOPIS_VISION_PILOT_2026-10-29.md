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
