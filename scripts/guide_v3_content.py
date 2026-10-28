"""Concise Czech and Ukrainian copy for the real-screenshot user guide."""
CZ=[
 {'title':'Jedna aplikace. Méně papírů.','asset':'today.jpg','route':'/dnes',
  'intro':'DEMSTAV Operations spojuje docházku, deník stroje a šichtovnici. Základ pracovního dne najdete na stránce Dnes.',
  'blocks':[
   ('Začněte tady','Přihlaste se účtem od správce a změňte dočasné heslo. Dnes otevře nový zápis a důležité denní úkony.'),
   ('Ovládání podle vás','CZ / УКР přepíná jazyk. Ve Více zapnete Jednoduchý režim, upozornění a instalaci na plochu. Jak na to najdete nahoře vedle DEMSTAV.'),
   ('Návod v kapse','Česky: strany 1-4. Українською: сторінки 5-8. Obrázky ukazují skutečné rozhraní s fiktivními DEMO daty.'),
  ]},
 {'title':'Deník bez dvojího psaní','asset':'record.jpg','route':'/zapis/novy',
  'intro':'Vyberte datum, stroj a pracoviště. Doplňte čas směny, práci a MTH začátek/konec. Jeden zápis se využije v deníku i šichtovnici.',
  'blocks':[
   ('Doplňte, co se stalo','Rozbalte servis, prostoje, přejezdy, závady, kapaliny a předání podle potřeby. Vlastní jízdu H:MM zapisuje i spolujezdec. MTH nejsou odpracované hodiny.'),
   ('Foto nebo lokální AI','Fotografii lze přepsat do návrhu. Lokální AI stáhne Qwen3.5-0.8B až na vyžádání a běží v podporovaném zařízení přes WebGPU. Bez API poplatků za tokeny; potřebuje paměť a výkon.'),
   ('Kontrola před potvrzením','AI i OCR chybují, zejména u rukopisu. Ověřte datum, stroj, časy a MTH; nečitelné doplňte. Přiložte doklady, uložte a ověřte odeslání. Další stroj má vlastní zápis.'),
  ]},
 {'title':'Docházka, pauzy a volno','asset':'attendance.jpg','route':'/dochazka',
  'intro':'Vyberte pracoviště a Příchod. QR nebo poloha závisí na nastavení pracoviště. Na konci dejte Odchod; deník stroje vyplňte zvlášť.',
  'blocks':[
   ('Přestávky se odečítají samy','Zadávejte celou směnu. Pauzy 12:00-12:30 a 15:30-16:00 se počítají jen uvnitř směny. Neodečítejte je podruhé.'),
   ('Chybný čas nebo jiná pauza','Dole v Docházce požádejte o opravu či změnu přestávky: datum, skutečné časy a důvod. Do schválení platí původní odečet. Poloha při události není trvalé sledování.'),
   ('Nepřítomnost a kalendář','Ve Více zadejte dovolenou, lékaře, nemoc, volno nebo plánovanou výjimku. Sledujte stav schválení. Kalendář ukazuje dostupnost týmu. Vlastní žádost schvaluje jiná oprávněná osoba.'),
  ]},
 {'title':'Přehledy a další funkce','asset':'guide.jpg','route':'/jak-na-to','image_max':220,
  'intro':'Jak na to otevřete z horní lišty. Brožuru lze číst i stáhnout. Dostupné nabídky se řídí oprávněním účtu.',
  'blocks':[
   ('Zápisy, výkazy a výstupy','Zápisy: detail, přílohy, historie oprav a JSON import. Moje přehledy: šichtovnice, deník a směny. Exporty: PDF, XLSX a CSV. Pověřená osoba vede společný výkaz a tonáž z vážních lístků.'),
   ('Offline a nastavení','Zkontrolujte Frontu a přijetí serverem; do odeslání nemažte data aplikace. Exporty a schvalování potřebují spojení. Push není potvrzení přečtení. Heslo, jazyk, jednoduchý režim a instalace jsou ve Více.'),
   ('Vedení a správce','Přehled vedení, všechny zápisy, kontrola výjimek, absence, stroje/servis, pracoviště/QR a uživatelé. V Exportech vedení předá týdenní verzi příjemci k převzetí nebo vrácení.'),
  ]},
]
UK=[
 {'title':'Один застосунок. Менше паперу.','asset':'today.jpg','route':'/dnes',
  'intro':'DEMSTAV Operations об’єднує облік часу, журнал машини та табель. Основні дії робочого дня - на сторінці «Сьогодні».',
  'blocks':[
   ('Почніть тут','Увійдіть за даними від адміністратора й змініть тимчасовий пароль. «Сьогодні» відкриває новий запис та основні щоденні дії.'),
   ('Зручне керування','CZ / УКР змінює мову. У «Більше» доступні спрощений режим, сповіщення й установлення на головний екран. «Як користуватися» - вгорі біля DEMSTAV.'),
   ('Посібник у телефоні','Česky: strany 1-4. Українською: сторінки 5-8. Зображення показують справжній інтерфейс із вигаданими DEMO даними.'),
  ]},
 {'title':'Журнал без подвійного запису','asset':'record.jpg','route':'/zapis/novy',
  'intro':'Виберіть дату, машину та місце. Укажіть час зміни, роботу і MTH на початку/наприкінці. Один запис використовується для журналу й табеля.',
  'blocks':[
   ('Лише фактичні дані','Сервіс, простої, переїзди, несправності, рідини й передачу заповніть за потреби. Власну поїздку H:MM записує і пасажир. MTH не є годинами працівника.'),
   ('Фото або локальний AI','AI завантажує Qwen3.5-0.8B за запитом і працює на пристрої через WebGPU. Потрібні сумісність, пам’ять і потужність. API-плати за токени немає.'),
   ('Перевірте перед підтвердженням','AI й OCR помиляються в рукописі та числах. Звірте дату, машину, час і MTH. Додайте документи, збережіть і перевірте надсилання. Для іншої машини - окремий запис.'),
  ]},
 {'title':'Час роботи, перерви й відсутність','asset':'attendance.jpg','route':'/dochazka',
  'intro':'Виберіть місце та «Прихід». QR або геолокація залежать від налаштувань місця. Наприкінці натисніть «Вихід»; журнал машини заповніть окремо.',
  'blocks':[
   ('Перерви віднімаються автоматично','Вказуйте повну зміну. Перерви 12:00-12:30 і 15:30-16:00 рахуються лише в межах зміни. Не віднімайте їх вдруге.'),
   ('Помилковий час чи інша перерва','Унизу обліку часу подайте запит на виправлення або зміну перерви: дата, фактичні години й причина. До схвалення діє попередній розрахунок. Геолокація події не є постійним відстеженням.'),
   ('Відсутність і календар','У «Більше» оформіть відпустку, лікаря, хворобу, відгул або плановий виняток. Стежте за схваленням. Календар показує доступність колег. Власний запит схвалює інша уповноважена людина.'),
  ]},
 {'title':'Огляди та інші можливості','asset':'guide.jpg','route':'/jak-na-to','image_max':220,
  'intro':'«Як користуватися» доступно у верхній панелі. Посібник можна читати й завантажити. Меню залежать від прав облікового запису.',
  'blocks':[
   ('Записи, звіти й експорт','Записи: деталі, додатки, історія виправлень та JSON імпорт. Мої огляди: табель, журнал і зміни. Експорт: PDF, XLSX і CSV. Уповноважена людина веде спільний звіт і тоннаж із вагових квитанцій.'),
   ('Офлайн і налаштування','Перевірте «Чергу» й отримання сервером; до надсилання не видаляйте дані. Експорт і схвалення потребують мережі. Push не підтверджує прочитання. Пароль, мова, спрощений режим і встановлення - у «Більше».'),
   ('Керівництву й адміністраторам','Огляд керівництва, всі записи, контроль винятків, відсутності, машини/сервіс, місця/QR та користувачі. В експорті керівництво передає тижневу версію отримувачу для прийняття або повернення.'),
  ]},
]
