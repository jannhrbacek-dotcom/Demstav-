# Společný výkaz práce a tonáže

Cesta: **Dnes → Vedete dnes společný výkaz práce a tonáže?** nebo **Více → Společný výkaz práce a vážní lístky** (`/vykazy-vazeni`).

Výkaz vede jeden člověk za celou posádku. Ostatním nevzniká povinnost ani duplicitní zápis do osobních hodin. Vedení může v modulu vybrat obvyklé zpracovatele ze skutečných aktivních účtů (například Marcel Schmidt a Hana Hynčicová); při záskoku se může přihlášený zaměstnanec ujmout výkazu tlačítkem „Ano, dnes vedu společný výkaz“. Přidělení podle jména samo o sobě neuděluje přístupová oprávnění.

## Údaje a podklady

Datum, odběratel, pracoviště, akce/zakázka, posádka, stroje, přídavné zařízení, začátek/konec práce, vypočtené hodiny, celkové tuny, popis práce, jméno zástupce odběratele a poznámka. Rozdílné stroje a členové posádky patří do jednoho společného výkazu.

Každý lístek má vlastní fotografii/PDF, číslo, materiál/frakce a celkovou hmotnost lístku. Více frakcí na jednom lístku se popíše společně a uvede se jejich součet. Aplikace fotografie automaticky nepřepisuje pomocí OCR. Součet neúplných nebo rozdílných lístků zobrazuje upozornění; odevzdání vyžaduje vysvětlení. Podklady mohou být průběžně doplňovány. Koncept lze uložit bez lístků; odevzdání vyžaduje alespoň jeden.

Odevzdání není podpis odběratele. PDF obsahuje místo pro podpis a za výkazem všechny uložené podklady. Nedostupná příloha export zastaví, aby nevznikl neúplný dokument. Podporované soubory: JPG, PNG, WEBP, PDF, nejvýše 15 MB na soubor, 50 lístků na výkaz.

## Ukládání a přístupy

Rozepsaná verze se ukládá do IndexedDB pod účtem uživatele. Explicitní uložení/odevzdání přidá výkaz do existující fronty; fotografie se posílají před výkazem. Stav přijetí serverem je uveden v seznamu a ve Frontě odesílání. Připojení, platné přihlášení a funkční objektové úložiště jsou nutné k dokončení synchronizace. Lokální data nejsou záloha proti vymazání dat prohlížeče.

Zaměstnanec má přístup jen ke svým společným výkazům; vedení ke všem. Opakování téže operace je idempotentní, změny používají revizi proti souběžnému přepsání a zapisují audit s předchozí a novou verzí. Po konfliktu lze výslovně načíst serverovou verzi; neodeslané změny se bez potvrzení nezahazují.

## Nasazení

Nový router je připojen v `backend/server.py`; při startu vzniknou unikátní indexy kolekcí `production_reports` a `production_settings`. Změna nemaže ani nepřepisuje existující deníky, účty ani docházku. Fotografie používají stávající službu `storage.py` a `/attachments`; před nasazením ověřit, že je toto úložiště funkční v cílovém prostředí.

Na každém telefonu je třeba ověřit první načtení aplikace, otevření offline, přidání fotografie, zavření a otevření rozepsaného výkazu, obnovení připojení a přijetí serverem. Automatické testy používají testovací úložiště, nikoli produkční účet.

## Ověření

- `python3 -m pytest backend/tests/unit/test_production.py -q -c backend/pytest.ini`
- `node frontend/production-check.cjs` vyžaduje také `react-test-renderer` odpovídající verzi Reactu. Pro izolované ověření: `npm install --prefix /tmp/demstav-check @babel/parser @babel/core @babel/plugin-transform-react-jsx @babel/plugin-transform-modules-commonjs react@19.0.0 react-dom@19.0.0 react-test-renderer@19.0.0`, poté `DEMSTAV_CHECK_MODULES=/tmp/demstav-check/node_modules node frontend/production-check.cjs`.
- Produkční sestavení: `cd frontend && npm ci --legacy-peer-deps --no-audit --no-fund && REACT_APP_BACKEND_URL='' GENERATE_SOURCEMAP=false npm run build`.
- Integrační kontrola fotografie → výkaz → PDF → oprávnění: `python3 -m pytest tests/test_production_api.py -q -c backend/pytest.ini`.
- Testy pokrývají validaci hmotnosti/časů, povinné podklady, vysvětlení rozdílů, duplicitní fotografii, izolaci zaměstnanců, revize, opakované operace, pořadí příloh a dlouhý PDF obsah. Kontrola JS zahrnuje parsování zdrojů, offline frontu a obnovení rozepsaného formuláře.

Výkaz se za přiložený den 26. 10. automaticky nezakládá: viditelná část lístku ukazuje dílčí údaj 31,35 t, který není doložením celkových 183,45 t ve výkazu.
