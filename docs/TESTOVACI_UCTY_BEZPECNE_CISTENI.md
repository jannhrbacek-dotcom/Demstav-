# DEMSTAV – bezpečné vyčištění testovacích účtů (návrh k ověření)

Tato větev vychází ze záložní větve `main-2`. **Není nasazená na Emergent.** Nic v produkční MongoDB nebylo smazáno.

## Postup administrátora

1. Proveďte externí úplnou obnovitelnou zálohu MongoDB a úložiště příloh. GitHub není záloha databáze.
2. V `Uživatelé a přístupy` u každého skutečně TESTOVACÍHO účtu typu `employee` klikněte `Označit jako test`. Existující skutečné zaměstnance neoznačujte.
3. Otevřete panel `Správa testovacích účtů`, vyberte označené osoby a klikněte `Zobrazit náhled`.
4. Pokud je u testovacích záznamů pravidelný servis (`intervalService`) nebo je na záznam navázán poslední servis stroje, systém další postup zablokuje. Tyto zápisy je nutno předem prověřit.
5. Stáhněte ZIP zálohu, otevřete ji a zkontrolujte obsah (JSON soubory a skutečné přílohy). ZIP není automatický obnovovací systém a neobsahuje heslové hashe.
6. Potvrďte uložení ZIP a externí zálohy, vyplňte své heslo a text `SMAZAT TESTOVACÍ ÚČTY`. Aplikace před odstraněním znovu porovná otisk vybraných dat; při jakékoliv změně požaduje novou zálohu.
7. Zkontrolujte audit a nově vygenerujte týdenní exporty označené jako zastaralé.

## Zachovává se

- Jednatel (`owner`), admin (`admin`), vedoucí výroby (`manager`) a všichni zaměstnanci bez explicitního příznaku `is_test=true`.
- Evidence strojů, motohodiny, servisní stav, pracoviště, QR nastavení, auditní historie.
- Veškerá data ostatních uživatelů.

## Omezení před ostrým nasazením

- Ověřit reálný stav na Emergentu a provést testy na kopii databáze. Nové přihlašovací heslo k VS Code nebylo serverem přijato, proto současný serverový stav nemohl být prohlédnut.
- Výběrové mazání více kolekcí nepoužívá distribuovanou transakci. Při výpadku serveru může vzniknout částečně uklizený stav. Pro ostrý provoz používat obnovitelnou externí zálohu; před nasazením ověřit chování při chybě během mazání na testovací MongoDB.
- ZIP záloha je omezená počtem dokumentů a velikostí. U větších dat bude nutná servisní archivace.
- Již vytvořené týdenní exporty, které zahrnovaly odstraněná data, nejsou fyzicky likvidované z úložiště; jsou označené jako `stale` a server brání jejich dalšímu stažení, dokud se nevygenerují znovu. Po kontrole je třeba staré binární soubory samostatně archivovat či zlikvidovat.
- Testovací aplikace DEMSTAV může mít účty s dříve veřejně známými demo hesly. Před veřejným ostrým nasazením **resetovat všechna výchozí hesla**, rotovat podpisové klíče a ověřit oprávnění.
- `SEED_DEMO_ACCOUNTS` je ve výchozím stavu vypnuté; pro izolovaný demo provoz lze výslovně zapnout a povinně nastavit silné `SEED_DEMO_PASSWORD` (nejméně 12 znaků).
- Při prvním startu nové databáze musí být nastavené `OWNER_EMAIL` a silné `OWNER_PASSWORD` (nejméně 12 znaků). Existujícímu vlastníkovi aplikace sama heslo nepřepisuje.
- Toto řešení **není plnohodnotná úklidová migrace legislativně povinných provozních či pracovních záznamů**. Mazat jen testovací údaje, ne skutečné provozní/docházkové záznamy.

## Rychlé technické kontroly

```bash
python3 -m compileall -q backend
# Frontend obsahuje JSX; ověřit build ve vývojovém prostředí:
cd frontend && yarn install --frozen-lockfile && yarn build
```

Automatické syntaktické kontroly jsou přidané do GitHub Actions na této větvi, skutečné integrační testy mazání s MongoDB a úložištěm je ale třeba provést samostatně.

**Nepoužívat plošné `POST /api/admin/wipe-data`: endpoint vždy vrací HTTP 410.**
