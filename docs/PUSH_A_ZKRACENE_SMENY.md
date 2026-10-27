# Push upozornění a plánované směny

## Co se mění

- V nabídce Více lze zapnout a vypnout Web Push pro přihlášený účet a konkrétní zařízení, případně odeslat zkušební zprávu.
- Service worker zpracovává push i bez otevřeného okna. Klepnutí otevře příslušné místo aplikace; cizí adresy z payloadu se nepovolují.
- Odhlášení odpojí odběr na zařízení. Přihlášení jiného účtu nepřevezme odběr předchozího uživatele bez nového zapnutí.
- Existující serverové události: žádost o nepřítomnost, rozhodnutí o žádosti, plánovaná výjimka, STOP závada. Nově se po potvrzení deníku vyhodnocuje také servisní limit a posílá se upozornění strojníkovi a vedení. Stejný limit a stav se po úspěšném předání push službě neopakují. Nejde o časově plánovaný kontrolní proces.
- Pozdní příchody a dřívější odchody z formuláře Dovolená a nepřítomnost jsou viditelné také v přehledu vybraného zaměstnance za daný týden. Jde o oznámení, nikoli schválenou docházku.
- Pravidelný servis smí potvrdit pracovní zařazení `mechanik`, `strojnik_mechanik`, `externi_servis` a dosavadní administrátorem spravovaný účet se jménem Jan Hrbáček. Samotný výběr provádějící firmy ve formuláři oprávnění nedává. Správce může nové zařazení nastavit ve správě uživatelů.

## Nastavení serveru

1. Použijte HTTPS a stávající backend s balíčkem `pywebpush` z requirements.txt.
2. Pokud již existuje pár VAPID, ponechte jej. V opačném případě na serveru vytvořte soukromý klíč mimo repozitář: `python backend/generate_vapid.py --private-file /bezpecna/cesta/vapid_private.pem`. Výstup obsahuje pouze veřejný klíč. Skript odmítne přepsat existující soubor.
3. Nastavte `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY_FILE` (absolutní cesta k soukromému PEM) a `VAPID_SUBJECT` (např. `mailto:admin@demstav.cz`). Soubor musí být trvale uložený a čitelný procesem backendu. Soukromý klíč nikdy necommitujte.
4. Restartujte backend a nasaďte frontend včetně `/sw.js`. `GET /api/push/public-key` vrací 501, pokud chybí veřejný klíč nebo soukromý soubor.
5. V telefonu otevřete Více → Upozornění i při zavřené aplikaci → Zapnout upozornění. Potom odešlete zkušební zprávu. Úspěšná odpověď serveru potvrzuje předání push službě, nikoli zobrazení uživateli.

Na iPhonu/iPadu je potřeba iOS/iPadOS 16.4+ a aplikace přidaná na plochu. Android vyžaduje podporovaný prohlížeč a povolená oznámení. Internet, systémová oprávnění a pravidla baterie ovlivňují doručení. Vynucené zastavení prohlížeče není totéž jako zavření okna PWA.

## Ověření

- `python -m pytest tests/test_phase5.py -q` (testovací závislosti: pytest, pytest-asyncio, httpx, mongomock-motor; běhové závislosti backendu).
- `node --test tests/push-worker.test.cjs`.
- Build frontend podle `frontend/package.json` v původním prostředí Emergent.
- Na cílovém nasazení: zapnout odběr, zavřít okno aplikace, vyvolat událost z jiného účtu, ověřit doručení a cílovou stránku. Vyzkoušet odhlášení a přepnutí účtu na sdíleném zařízení.
- Na produkčním MongoDB ověřit migrace/indexy ze startupu, protože automatické testy používají paměťovou náhradu databáze.

Fyzické doručení, skutečné VAPID nastavení, mobilní GPS/QR a PDF exporty vyžadují ověření v nasazeném prostředí. Tato změna je neoznačuje za prověřené.
