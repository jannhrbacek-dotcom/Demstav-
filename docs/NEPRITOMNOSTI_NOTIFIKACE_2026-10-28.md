# Nepřítomnosti a druhý schvalovací krok — #19/#21

Přechod dovolené od vedoucího k finálnímu schválení nyní upozorní jednatele a vedoucího provozu. Změna stavu používá podmínku původního stavu; souběžné rozhodnutí ani opakování nesmí způsobit druhou změnu/oznámení. Rušení žádosti má stejnou ochranu. Push zpráva neobsahuje soukromou poznámku, diagnózu ani poznámku schvalovatele. Samotné odeslání push není důkaz doručení telefonu; žádost zůstává dostupná v aplikaci i bez push.

Vedení dostává samostatný minimální přehled s daty, zaměstnancem, typem a stavem; DTO neobsahuje poznámky/historii. Na dashboardu jsou dnešní a blízké nepřítomnosti, v agendě absence filtry období/zaměstnanec/stav/typ. Kalendář vedení zobrazuje i čekající žádosti; zaměstnanec vidí čekající pouze vlastní. Nemoc kolegy zůstává obecnou nepřítomností bez soukromé poznámky.

Ověřeno: 55 Python testů, 10 React testů a produkční build prošly. Nové testy ověřují oba kroky dovolené, jediné upozornění v mezikroku, konečné rozhodnutí, odstranění soukromých poznámek z push/přehledu, ochranu API před běžným zaměstnancem a filtr čekajících událostí kalendáře. Neplatné kalendářní datum žádosti nyní vrací 400 místo neošetřené výjimky.

Zůstává fyzický test doručení na Android/iPhone PWA, zavřená aplikace, chybějící/expirující subscription a UX na telefonu. Není zaveden zaručený doručovací outbox; tento PR nelze označit za důkaz doručení v produkci. Stávající pravomoci rolí se nemigrují a žádná živá žádost nebyla změněna.
