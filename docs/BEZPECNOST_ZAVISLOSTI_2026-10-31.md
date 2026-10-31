# Bezpečnost produkčních závislostí – 31. 10. 2026

Výchozí commit: `845781c3714d27513fcfc8a2a467b90e2f4de1f2` na `main-2`.
Dockerfile i cloudové CI instalují `backend/requirements-cloud.txt`.
Rozsáhlý `backend/requirements.txt` je jiný seznam a tento audit ho celý neposuzuje.

## Doložený výsledek

`pip-audit 2.10.0`, služba PyPI, Python 3.12, čerstvé rozlišení cloudových závislostí:

| Stav | Rozlišených balíčků | Položek hlášení | Různých identifikátorů hlášení |
| --- | ---: | ---: | ---: |
| Před opravou | 44 | 127 | 89 |
| Po opravě | 46 | 0 | 0 |

Původní výsledek obsahuje i opakované identické identifikátory. Číslo 127 proto
neznamená 127 různých CVE. Různé identifikátory navíc mohou mít společné aliasy.
Samotný nález neprokazuje úspěšné zneužití ani dosažitelnost chyby v aplikaci.
Jde o instalaci podle repozitáře; inventář skutečně běžícího obrazu na Renderu
nebyl v tomto kroku získán. Nulový výsledek se vztahuje na známé nálezy služby
PyPI v okamžiku kontroly, ne na všechny možné chyby nebo systémové balíčky Dockeru.

| Dotčený balíček | Původní verze | Připravená verze |
| --- | --- | --- |
| Starlette | 0.37.2 | 1.10.0 |
| PyJWT | 2.10.1 | 2.15.1 |
| python-dotenv | 1.0.1 | 1.2.4 |
| python-multipart | 0.0.20 | 0.0.32 |
| requests | 2.32.5 | 2.34.2 |
| PyMuPDF | 1.26.5 | 1.28.2 |
| Pillow | 11.3.0 | 13.0.0 |

FastAPI se mění z 0.110.1 na 0.162.0, aby podporovalo opravenou Starlette.
Cloudový seznam nově výslovně připíná Starlette i testovaný Pydantic 2.14.2.
Verze FastAPI/Starlette jsou sladěné také v rozsáhlém seznamu; jeho úplné
rozlišení a ověření nad rámec produkčního seznamu není součástí této změny.

[Strojově čitelné výsledky](security/dependencies-2026-10-31.json) zachovávají
verze všech rozlišených balíčků, počty původních položek, identifikátory,
aliasy a opravné verze. Duplicitní záznamy téhož identifikátoru jsou v seznamu
sloučené; původní počet zůstává uveden zvlášť.

## Oprava přihlášení účtu bez e-mailu

`create_access_token` přistupovalo k `user["email"]`, přestože uživatel může být
vytvořen jen s přihlašovacím jménem. Samostatný test před opravou reprodukoval
`KeyError: 'email'`. Token nyní použije prázdný volitelný e-mail. Identitou
zůstává uživatelské ID; životnost tokenu a kontrola oprávnění se nemění.

Regresní test ověřuje přihlášení, načtení identity, změnu dočasného hesla,
zneplatnění původního tokenu a funkčnost nového tokenu.

## Ověření a opakování kontroly

V odděleném lokálním prostředí bez produkčních přístupů prošlo 89 backendových
testů (88 původních a nový průchod přihlášením), kontrola synchronizace a
`pip check`. Zůstávají upozornění na zastarávající startup/shutdown API
`on_event`; testy jimi neselhávají.

```sh
python3 -m venv /tmp/demstav-verify
/tmp/demstav-verify/bin/pip install -r backend/requirements-cloud.txt httpx==0.28.1 pytest==8.4.2 pytest-asyncio==1.2.0 mongomock-motor==0.0.36 pytest-xdist==3.8.0 pip-audit==2.10.0
/tmp/demstav-verify/bin/python -m pytest tests/test_*.py backend/tests/unit/test_production.py -q
node tests/sync_integrity.cjs
/tmp/demstav-verify/bin/pip check
/tmp/demstav-verify/bin/pip-audit -r backend/requirements-cloud.txt --strict --progress-spinner off
```

Cloudové CI má samostatnou povinně vyhodnocovanou úlohu `dependency-audit`:
nález nebo nemožnost závislosti rozlišit způsobí neúspěch úlohy. Nejde o nově
nastavenou ochranu větve; správce musí vyžadovat kontroly před merge. Stávající
úloha `verify` dále sestavuje produkční Docker a ověřuje aplikaci s reálnou
MongoDB před restartem i po něm. Lokálně Docker ani MongoDB server nejsou
dostupné, proto tyto kroky patří do CI.

## Zbývající samostatné práce z auditu

- Nezávislá kopie databáze a příloh mimo Render a zkouška obnovy na jiné instanci.
- Ověření účelu druhé služby `Demstav-` před případnou změnou nebo zrušením.
- Kontrola skutečných produkčních hlaviček, nastavení CORS a adres za proxy.
- Oprava omezení přihlašovacích pokusů, ověření obsahu příloh a omezení dotazů
  přehledu. Tyto změny vyžadují vlastní regresní scénáře.

Tato změna nezahrnuje merge do `main-2`, nasazení ani zásah do produkčních dat.

## Primární podklady

- [FastAPI: poznámky k vydáním](https://fastapi.tiangolo.com/release-notes/)
- [Starlette: poznámky k vydáním](https://www.starlette.io/release-notes/)
- [Metadata FastAPI z PyPI](https://pypi.org/pypi/fastapi/0.162.0/json)
- [pip-audit: rozsah a používání](https://github.com/pypa/pip-audit)
