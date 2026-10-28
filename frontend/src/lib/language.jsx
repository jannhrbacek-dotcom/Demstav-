import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/*
 * DEMSTAV interface language. Czech source messages remain the fallback:
 * never translate machine IDs, stored work records, personal names or numbers.
 * Persistent per-browser preference; no schema or API changes.
 */
export const LANGUAGE_STORAGE_KEY = "demstav:language";
export const LANGUAGES = [
  { value: "cs", label: "Čeština" },
  { value: "uk", label: "Українська" },
];
const uk = {
  "Jazyk aplikace": "Мова застосунку",
  "Čeština": "Чеська",
  "Ukrajinština": "Українська",
  "Dnes": "Сьогодні",
  "Zápisy": "Записи",
  "Docházka": "Облік робочого часу",
  "Fronta": "Черга",
  "Více": "Більше",
  "Přehled vedení": "Огляд керівництва",
  "Kontrola výjimek": "Перевірка винятків",
  "Všechny zápisy": "Усі записи",
  "Pracoviště": "Робочі місця",
  "Stroje": "Машини",
  "Uživatelé": "Користувачі",
  "Přehled": "Огляд",
  "Ke kontrole": "На перевірку",
  "Tým": "Команда",
  "Můj den": "Мій день",
  "Vedení": "Керівництво",
  "Jak na to": "Як користуватися",
  "Moje přehledy": "Мої звіти",
  "Dovolená a absence": "Відпустки та відсутність",
  "Kalendář týmu": "Календар команди",
  "Exporty a reporty": "Експорт і звіти",
  "Odhlásit": "Вийти",
  "Jednoduchý režim": "Спрощений режим",
  "Zap.": "Увім.",
  "Jedn.": "Прост.",
  "Synchronizováno a potvrzeno serverem": "Синхронізовано й підтверджено сервером",
  "Čeká na odeslání": "Очікує надсилання",
  "Vyžaduje opravu synchronizace": "Потрібно виправити синхронізацію",
  "Offline nebo server nebyl ověřen": "Немає мережі або сервер не перевірений",
  "Opakovat": "Повторити",
  "Detail": "Деталі",
  "položek ve frontě.": "елементів у черзі.",
  "Přihlášení": "Вхід",
  "Přihlašovací jméno nebo e-mail": "Ім’я користувача або електронна пошта",
  "Heslo": "Пароль",
  "Přihlásit": "Увійти",
  "Přihlašuji…": "Вхід…",
  "Provozní deník stroje, šichtovnice a docházka. Zapište jednou – vedoucí to uvidí hned po odeslání.": "Журнал роботи машини, табель і облік робочого часу. Запишіть один раз — керівник побачить після надсилання.",
  "Účet vám založí správce a předá dočasné heslo. Při prvním přihlášení si ho změníte.": "Адміністратор створить обліковий запис і видасть тимчасовий пароль. Під час першого входу змініть пароль.",
  "Jak na to – průvodce aplikací": "Як користуватися — посібник",
  "Moje přehledy (šichtovnice, deník, směny)": "Мої звіти (табель, журнал, зміни)",
  "Dovolená, volno, lékař, nemoc": "Відпустка, вихідний, лікар, хвороба",
  "Sdílený kalendář zaměstnanců": "Спільний календар працівників",
  "Společný výkaz práce a vážní lístky": "Спільний звіт робіт і вагові квитанції",
  "Exporty a reporty (PDF, XLSX, CSV)": "Експорт і звіти (PDF, XLSX, CSV)",
  "Změnit heslo": "Змінити пароль",
  "Větší tlačítka i text; skryje volitelné sekce pro snadné ovládání.": "Більші кнопки й текст; необов’язкові розділи приховано.",
  "Kontrola výjimek docházky": "Перевірка винятків обліку часу",
  "Pracoviště a QR": "Робочі місця та QR",
  "Seznam strojů": "Список машин",
  "Uživatelé a přístupy": "Користувачі та доступ",
  "Upozornění (push)": "Сповіщення (push)",
  "Zapnout upozornění": "Увімкнути сповіщення",
  "Vypnout upozornění": "Вимкнути сповіщення",
  "Poslat test": "Надіслати тест",
  "Aplikace v telefonu": "Застосунок на телефоні",
  "Přidat na plochu": "Додати на головний екран",
  "Aplikace běží jako nainstalovaná.": "Застосунок запущено як встановлений.",
  "Dostáváte oznámení i při zavřené aplikaci (nové žádosti o volno, STOP závady, blížící se servisy).": "Ви отримуєте сповіщення також після закриття застосунку (відпустки, критичні несправності, техобслуговування).",
  "Zapněte, aby vám chodila oznámení i při zavřené aplikaci.": "Увімкніть сповіщення, щоб отримувати їх також після закриття застосунку.",
  "Tento prohlížeč push notifikace nepodporuje. Nainstalujte aplikaci na plochu a použijte moderní verzi Chrome/Edge/Safari.": "Цей браузер не підтримує push-сповіщення. Додайте застосунок на головний екран і використовуйте сучасний Chrome, Edge або Safari.",
  "Oznámení jsou v prohlížeči zablokována. Povolte je v nastavení prohlížeče pro tuto doménu.": "Браузер заблокував сповіщення. Дозвольте їх у налаштуваннях для цього сайту.",
  "iPhone: v Safari klepněte na Sdílet → Přidat na plochu. Android: v Chrome nabídka ⋮ → Instalovat aplikaci.": "iPhone: Safari → Поділитися → На головний екран. Android: Chrome → ⋮ → Встановити застосунок.",
  "Po prvním načtení se aplikace otevře i bez internetu; zápisy se ukládají do fronty v telefonu. Ikona na ploše sama o sobě neznamená ověřený offline provoz na vašem zařízení.": "Після першого завантаження застосунок може відкриватися без інтернету, записи зберігаються в черзі на телефоні. Піктограма не гарантує повну автономну роботу на вашому пристрої.",
  "Příchod / odchod": "Прихід / вихід",
  "Čistá doba dnes": "Чистий час сьогодні",
  "Nový denní zápis": "Новий щоденний запис",
  "Stroj · práce · motohodiny · šichtovnice": "Машина · робота · мотогодини · табель",
  "Po směně: společný výkaz práce a tonáže": "Після зміни: спільний звіт робіт і тоннажу",
  "Jen pověřený zaměstnanec vyplňuje společný výkaz a vážní lístky.": "Спільний звіт і вагові квитанції заповнює лише уповноважений працівник.",
  "ANO · otevřít výkaz": "ТАК · відкрити звіт",
  "NE": "НІ",
  "Dnešní zápisy": "Записи за сьогодні",
  "Zatím žádný zápis.": "Записів поки немає.",
  "Bez stroje": "Без машини",
  "Moje zápisy": "Мої записи",
  "Import JSON": "Імпорт JSON",
  "Nový zápis": "Новий запис",
  "Žádné zápisy": "Немає записів",
  "Pro zvolený filtr zatím nic není.": "За вибраним фільтром записів немає.",
  "Všechny stavy": "Усі стани",
  "Koncepty": "Чернетки",
  "Potvrzené": "Підтверджені",
  "Offline – zobrazena poslední stažená data.": "Офлайн — показано останні збережені дані.",
  "Upravit stroj": "Редагувати машину",
  "Přidat stroj": "Додати машину",
  "Stroj uložen": "Машину збережено",
  "Datum, stroj a pracoviště": "Дата, машина і робоче місце",
  "Pracovní čas": "Робочий час",
  "Provedená práce": "Виконана робота",
  "Motohodiny (MTH)": "Мотогодини (MTH)",
  "Přílohy": "Додатки",
  "MTH začátek": "MTH на початку",
  "MTH konec": "MTH наприкінці",
  "Rozdíl": "Різниця",
  "Vyfotit": "Сфотографувати",
  "Přepsat papírový deník / šichtovnici": "Розпізнати паперовий журнал / табель",
  "Vyfotit dokument": "Сфотографувати документ",
  "Vybrat fotografii": "Обрати фотографію",
  "Zkontrolujte návrh přepisu": "Перевірте розпізнаний текст",
  "Vložit označené údaje do formuláře": "Вставити позначені дані у форму",
  "Zobrazit celý rozpoznaný text": "Показати весь розпізнаний текст",
  "Zopakovat rozpoznání fotografie": "Повторити розпізнавання фото",
  "Jak na to ·": "Як користуватися ·",
  "Celý tutoriál od začátku": "Почати посібник спочатку",
  "Zpět": "Назад",
  "Další": "Далі",
  "Rozumím, začít": "Зрозуміло, почати",
  "Přeskočit prohlídku – návod najdu v nabídce Jak na to": "Пропустити огляд — посібник доступний у меню «Як користуватися»",
  "Vítejte v DEMSTAVu": "Ласкаво просимо до DEMSTAV",
  "1. Příchod a odchod": "1. Прихід і вихід",
  "2. Přestávky se počítají samy": "2. Перерви враховуються автоматично",
  "3. Zápis práce a stroje": "3. Запис роботи й машини",
  "4. Uložení, potvrzení a fotografie": "4. Збереження, підтвердження й фото",
  "5. Když není internet": "5. Коли немає інтернету",
  "6. Přehledy a další možnosti": "6. Звіти та інші можливості",
  "7. Přehled a schvalování pro vedení": "7. Огляд і погодження для керівництва",
};
const Context = createContext({ language: "cs", setLanguage: () => {}, t: value => value });
export function LanguageProvider({ children }) {
  const [language, update] = useState(() => {
    try { return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "uk" ? "uk" : "cs"; }
    catch (_) { return "cs"; }
  });
  useEffect(() => { if (typeof document !== "undefined") document.documentElement.lang = language; }, [language]);
  const setLanguage = value => {
    const next = value === "uk" ? "uk" : "cs";
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch (_) { /* private mode */ }
    update(next);
  };
  const value = useMemo(() => ({ language, setLanguage, t: (text) => language === "uk" ? (uk[text] || text) : text }), [language]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useLanguage = () => useContext(Context);
export function LanguageSelect({ compact = false, dark = false }) {
  const { language, setLanguage, t } = useLanguage();
  return <label className={`inline-flex items-center gap-2 text-sm font-semibold ${dark ? "text-white" : "text-slate-900"}`} data-testid="language-select">
    {!compact && <span>{t("Jazyk aplikace")}</span>}
    <select aria-label={t("Jazyk aplikace")} value={language} onChange={e => setLanguage(e.target.value)}
      data-testid="language-choice"
      className={`min-h-11 rounded-lg border px-2 text-sm font-semibold ${dark ? "border-white/30 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900"}`}>
      <option value="cs">CZ</option>
      <option value="uk">УКР</option>
    </select>
  </label>;
}
