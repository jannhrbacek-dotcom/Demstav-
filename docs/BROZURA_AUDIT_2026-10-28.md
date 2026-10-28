# Brožura DEMSTAV - verze 3, 29. 10. 2026

Nová brožura má 8 stran A5: 4 české a 4 ukrajinské. Každá obsahuje
skutečný snímek rozhraní a tři krátké bloky návodu. Nahrazuje podrobnou
18stránkovou verzi bez screenshotů. Neobsahuje dnešní skutečnou směnu,
reálné jméno ani podpis. Digitální hodnoty na snímcích jsou fiktivní DEMO.

## Původ snímků

Snímky pořídil prohlížeč z nasazené stránky /help/preview/index.html,
verze zdroje PR #38 / f3090ab. Ukázka používá skutečné React komponenty
Dnes, RecordForm, Attendance a Guide s izolovanými fiktivními daty.
Auth, API, synchronizace a koncepty jsou při sestavení nahrazené mocky;
CSP zakazuje síťové spojení, celý obsah je pouze ke čtení. Nejde o
přihlášenou produkční relaci ani o graficky napodobené screenshoty.

Originální JPEG jsou v scripts/guide-assets/{today,record,attendance,guide}.jpg.
PDF používá výřez původního snímku; samotné zdrojové bitmapy neupravuje.
Ukrajinská část popisuje stejné české UI snímky ukrajinským textem.

## Obsah a ověření

Dnes a nastavení; deník, MTH, práce, servis, doprava a fotografie;
docházka, přestávky, žádosti a volno; historie, import, přehledy, výkazy,
exporty, offline, vedení a správa. AI je místní Qwen3.5-0.8B na vyžádání,
nikoli placená serverová služba. Vyžaduje stažení asi 0,9 GB, WebGPU
s fp16 a volnou paměť. Přesnost rukopisu není zaručená.

Generátor: python scripts/build_user_guide.py, obsah guide_v3_content.py.
Chybějící screenshot nebo přetečení textu ukončí generování před přepsáním
PDF. Všech osm stran bylo vyrenderováno Popplerem a vizuálně ověřeno.
PDF má 8 vložení snímků a 8 odkazů do odpovídajících částí aplikace.

Úplný průchod živým uložením směny nebyl proveden: aplikace odmítla
obě uživatelem zadaná přihlášení. Brožura proto nevydává statické testy
za důkaz provozní správnosti všech funkcí.
