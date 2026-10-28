# Výpočty a exporty — část úkolu #22

Řeší AUD-01/02/07/08/19 a část AUD-10 z auditu #24, nezávisle na bezpečnostním PR #25.

- Osobní union noční směny sdílí společnou kotvu mezi všemi stroji označenými datem začátku téže směny. Test 22–02 + 01–03 nyní dává 5 hodin. Dnes používá union, nikoli prostý součet hodin strojů. Při skutečně různých směnách je nutné uvést odpovídající data.
- Strojní XLSX používá stejné schválené pauzy jako ostatní výstupy. Schválená směna 06–17 bez pauzy má 11 hodin také v XLSX.
- Jízda je osobní doba H:MM s novým explicitním `driveMinutes`. Rozlišuje se 0:00 a nevyplněno. Zachovávají se SPZ a role řidič/spolujezdec; čas se k práci znovu nepřičítá. Čipování zůstává neověřeno i při podvrženém vstupu od klienta.
- Staré celočíselné `drive` se uchová beze změny a nepřevádí se na minuty. Při zobrazení/exportu je označeno neověřeno. Zaměstnanec musí skutečnou dobu doplnit; žádný hromadný přepis historie.
- PDF zachovává 13 sloupců, XLSX/CSV doplňují osobní jízdu a SPZ. Test PDF ověřuje dvě osobní šichtovnice pro řidiče a spolujezdce s dobou 0:45.
- Nepotvrzené extrémní MTH už neurčují servisní stav. Historie předvyplnění používá pouze potvrzené záznamy a zohledňuje datum cílového zápisu. Potvrzení fyzicky nemožného rozdílu nad 24 MTH za den je blokováno; zápis lze uchovat jako koncept pro kontrolu.

Ověřeno: první celkový běh 59 Python testů; po doplnění PDF scénáře 7 cílených testů. React: 13 testů, šest sad. Produkční build se kontroluje před předáním PR. Bez produkční DB, nasazení nebo změny historických šichtovnic. Úkol #22 tím ještě není celý hotov: předání, převzetí, verze balíků a živý plánovač jsou samostatná práce. Přechod letního času, noční výjimky pauz podle druhého kalendářního dne a mobilní průchod vyžadují další ověření.
