# Журнал читання вимог

<!--
Ваш журнал — один файл: скан вимог PM за таксономією, питання до PM і власні припущення. Скіл spec-clarify заповнює його
за структурою нижче. Комітите в PR «Специфікація» (разом зі зміною специфікації, яку ці питання стосуються).
Питання до PM — issues у репо вимог PM через вебформу «Питання до вимог»
(https://github.com/<pm>/<team-slug>-spec/issues/new?template=question.yml; форма ставить мітку question) з повною
адресою вимоги (issue PM або шлях docs/requirements/… у репо PM) і AC. Тут, у вашому репо, голе #7 — ваш власний issue
чи PR, тому вимогу пишіть як <pm>/<team-slug>-spec#7 або файлом знімка requirements/7-….md. Перед новим issue
перегляньте наявні в репо PM: якщо таке питання вже є — коментар із новим випадком там, а не дублікат.
Для PM це матеріал нотатки «порівняння реалізацій»: де одні вимоги прочитали по-різному.
-->

Вимоги: solomchaak/property-workflows-spec · джерело: issues · знімок 2026-10-27

<!-- Розділи нижче до «Зріз 2» — зріз 1 (WS6, знімок 2026-10-19). Зріз 2 (WS7, знімок 2026-10-27) — розділ «Зріз 2» унизу. -->

## Зріз 1

## Скан за таксономією

<!-- Крок 1 скіла spec-clarify: усі 11 категорій (.claude/skills/spec-clarify/references/ambiguity-taxonomy.md).
Статус — Ясно / Частково / Немає; «Де» — AC ID або вимога (<pm>/<team-slug>-spec#7 чи requirements/7-….md, не голе
#7). Після нового /requirements-sync скан замінюється (попередній лишається в історії git). -->

| # | Категорія | Статус | Де |
|---|---|---|---|
| 1 | Функціональний обсяг | Ясно | solomchaak/property-workflows-spec#2 і solomchaak/property-workflows-spec#3: «Поза межами» перелічено |
| 2 | Ролі й доступ | Частково | AC-RUN-04, AC-TASK-03 — вже питання solomchaak/property-workflows-spec#5 і solomchaak/property-workflows-spec#4 |
| 3 | Домен і модель даних | Частково | solomchaak/property-workflows-spec#1 (Section має «order») проти solomchaak/property-workflows-spec#2 («Section order … not checked»); чи копіюються секції в run — питання solomchaak/property-workflows-spec#7 |
| 4 | Потік взаємодії (UX) | Частково | порядок і порожній стан списку run (не питаємо: власне припущення) |
| 5 | Нефункціональні вимоги | Ясно | Kyiv time, часових правил немає |
| 6 | Інтеграції й обмеження платформи | Ясно | листів і розкладу в зрізі немає |
| 7 | Граничні випадки й збої | Частково | AC-RUN-03, AC-RUN-07 — пробіли навколо назви і межа 100 символів — питання solomchaak/property-workflows-spec#6; унікальність назви кейсу (власне припущення) |
| 8 | Обмеження й компроміси | Ясно | — |
| 9 | Термінологія | Частково | «Section» з порядком проти «не перевіряється» (див. категорію 3, solomchaak/property-workflows-spec#7) |
| 10 | Сигнали завершеності | Ясно | статус run видно в списку й на сторінці run (власне припущення) |
| 11 | Заглушки й розмиті слова | Ясно | тексти повідомлень і «N of M done» задано дослівно |

## Питання до PM

<!-- «Issue» — посилання на issue в репо PM (<pm>/<team-slug>-spec#3) або на ваш коментар у наявному issue
(…/issues/3#issuecomment-M). «Рішення» — що ви робите, поки PM не відповів, і що зробили після відповіді.
Приклад рядка:
| Q1 | AC-…-02 (<pm>/<team-slug>-spec#7) | Що означає «…»? | B: … | <pm>/<team-slug>-spec#3 | очікуємо | у специфікації — текст PM, питання в Open questions; у матриці «відкладено» |
-->

| # | AC / вимога | Питання | Рекомендація | Issue в репо PM | Відповідь PM | Рішення (що зробили) |
|---|---|---|---|---|---|---|
| Q1 | AC-RUN-04 | що менеджер бачить про інших користувачів | A | solomchaak/property-workflows-spec#5 (питання колеги) | очікуємо | робоче припущення: показуємо мінімум для вибору — email; роль і решту профілю не показуємо; RLS на profiles не послаблюємо. |
| Q2 | AC-TASK-03 | що бачить менеджер, який не має доступу до запуску, і досяжність AC для співвиконавця | A | мій коментар: https://github.com/solomchaak/property-workflows-spec/issues/4#issuecomment-6273815465 (у питанні колеги solomchaak/property-workflows-spec#4) | очікуємо | робоче припущення: чужий запуск за прямим посиланням дає «Run not found»; правило «лише виконавець задачі, менеджер запуску чи адмін» перевіряється в базі, повідомлення AC-TASK-03 показується при дії. |
| Q3 | AC-RUN-03, AC-RUN-07 | пробіли по краях назви й межа 100 символів | A | solomchaak/property-workflows-spec#6 | очікуємо | робоче припущення: обрізаємо пробіли по краях, перевіряємо порожнє й довжину на обрізаному тексті, зберігаємо обрізане. |
| Q4 | AC-RUN-01, AC-RUN-02, AC-TASK-08 | чи зберігає запуск секції шаблону й чи групує задачі | A | solomchaak/property-workflows-spec#7 | очікуємо | робоче припущення: запуск копіює секції (назва й порядок) і показує задачі згрупованими в порядку шаблону. |

## Власні припущення

<!-- Те, що вирішили самі без питання до PM, і чому. Якщо згодом PM відповів інакше — допишіть, що змінили. -->

- Статус запуску («in progress» / «completed») показуємо і в списку запусків, і на сторінці запуску.
- Необов'язкові задачі після завершення запуску: не вирішуємо; PM-Q1 (solomchaak/property-workflows-spec#3): поведінка не специфікується, правила понад вимоги PM не додаємо.
- Список запусків: новіші першими, порожній список показує «No runs yet».
- Назви випадків не унікальні.

## Що пропустив би без скіла / що скіл знайшов зайве

<!-- 2–3 речення для ретроспективи. -->

Без скіла я б, найімовірніше, не помітив суперечності між визначенням Section («name and an order») у Product і рядком «Section order … not checked» у вимозі solomchaak/property-workflows-spec#2: через неї незрозуміло, чи зберігає запуск секції (питання solomchaak/property-workflows-spec#7). Скіл також дав структуру скану за 11 категоріями, яка допомогла знайти граничний випадок з пробілами в назві кейсу (питання solomchaak/property-workflows-spec#6). Зайвим виявилось питання, де показано статус «completed»: вимога вже каже, що статус і прогрес видно і в списку, і на сторінці запуску, тому я перевів його у власні припущення. Сам я знайшов, що AC-TASK-03 досяжний через звичайний інтерфейс для співвиконавця запуску (він бачить усі задачі запуску), і написав про це коментар у питанні колеги solomchaak/property-workflows-spec#4.

## Зріз 2

Вимоги зрізу 2 (WS7, знімок 2026-10-27): solomchaak/property-workflows-spec#19 (`requirements/19-use-one-design-system.md`, AC-DSYS-01…08), solomchaak/property-workflows-spec#20 (`requirements/20-edit-a-template-with-version-control.md`, AC-EDITOR-01…29); уточнені solomchaak/property-workflows-spec#2 (AC-RUN-10…12), solomchaak/property-workflows-spec#3 (AC-TASK-10…18, зміни AC-TASK-01, 02, 04, 07) і Продукт solomchaak/property-workflows-spec#1. Специфікація: зміни `add-templates-editor` і `update-templates-editor` (PR «Специфікація»).

### Скан за таксономією (зріз 2)

| # | Категорія | Статус | Де |
|---|---|---|---|
| 1 | Функціональний обсяг | Частково | AC-EDITOR-01: що входить у «reorders» (перенесення задачі між секціями) — питання solomchaak/property-workflows-spec#36; чи можна перейменувати шаблон — питання колеги solomchaak/property-workflows-spec#29 |
| 2 | Ролі й доступ | Частково | AC-EDITOR-02, AC-EDITOR-07, AC-DSYS-02: менеджер і шаблон, що ніколи не зберігали як версію — питання колег solomchaak/property-workflows-spec#25, solomchaak/property-workflows-spec#26; AC-EDITOR-08, AC-EDITOR-09: гість напряму — solomchaak/property-workflows-spec#32 |
| 3 | Домен і модель даних | Частково | AC-EDITOR-06: запуски до появи версій — solomchaak/property-workflows-spec#33; унікальність назв шаблонів — solomchaak/property-workflows-spec#30 |
| 4 | Потік взаємодії (UX) | Частково | AC-DSYS-03, AC-EDITOR-09: куди користувач потрапляє після входу — питання solomchaak/property-workflows-spec#35; порожні списки шаблонів і версій — solomchaak/property-workflows-spec#27; збереження без змін — solomchaak/property-workflows-spec#22 |
| 5 | Нефункціональні вимоги | Ясно | Kyiv time, формат DD.MM.YYYY HH:MM (AC-EDITOR-05), контраст і фокус — «Вигляд і тон» |
| 6 | Інтеграції й обмеження платформи | Ясно | листів, імпорту й розкладу в зрізі немає |
| 7 | Граничні випадки й збої | Частково | AC-EDITOR-04: секція без задач — solomchaak/property-workflows-spec#24, порожні назви — solomchaak/property-workflows-spec#28, запуск шаблону без версії — solomchaak/property-workflows-spec#21; AC-EDITOR-01: збій автозбереження — solomchaak/property-workflows-spec#31 |
| 8 | Обмеження й компроміси | Ясно | один набір непублікованих змін на шаблон, одночасне редагування поза межами (solomchaak/property-workflows-spec#20) |
| 9 | Термінологія | Ясно | Version, Current version, Unpublished changes, Editor, Design system — у глосарії Продукту (solomchaak/property-workflows-spec#1) |
| 10 | Сигнали завершеності | Ясно | повідомлення «Unpublished changes», «Template version N» задано дослівно; текст успіху «Version 2 saved» — приклад у «Вигляд і тон» (див. власні припущення) |
| 11 | Заглушки й розмиті слова | Частково | «Dark theme» поза межами (AC-DSYS) — пропозиція колеги solomchaak/property-workflows-spec#34; решта текстів задана дослівно |

### Питання до PM (зріз 2)

Перед питаннями переглянуто всі відкриті issues з міткою `question` у репо PM: більшість прогалин зрізу вже спитано (solomchaak/property-workflows-spec#21–#34), тому дублікатів не створювали; власні — лише там, де такого питання не було.

| # | AC / вимога | Питання | Рекомендація | Issue в репо PM | Відповідь PM | Рішення (що зробили) |
|---|---|---|---|---|---|---|
| Q5 | AC-DSYS-03, AC-EDITOR-09 | куди потрапляє відвідувач після входу з прямого посилання | A | solomchaak/property-workflows-spec#35 (моє) | Option A прийнято (2026-10-27) | AC-DSYS-08 додано PM; робоче припущення стало вимогою. |
| Q6 | AC-EDITOR-01 | чи можна переносити задачу в іншу секцію | A | solomchaak/property-workflows-spec#36 (моє) | Option A прийнято (2026-10-27) | AC-EDITOR-28 додано PM; перенесення задач між секціями — вимога. |
| Q7 | AC-EDITOR-04 | запуск шаблону, що ніколи не зберігали як версію | A (колега) | solomchaak/property-workflows-spec#21 (питання колеги) | Option B прийнято (2026-10-27) | AC-EDITOR-10 і AC-EDITOR-11: шаблон без версії недоступний у формі запуску й напряму. |
| Q8 | AC-EDITOR-03 | збереження шаблону без непублікованих змін | A (колега) | solomchaak/property-workflows-spec#22 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-12: збереження без змін не створює версію; в редакторі його не пропонують. |
| Q9 | AC-EDITOR-01 | підтвердження перед видаленням секції чи задачі | A (колега) | solomchaak/property-workflows-spec#23 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-13 і AC-EDITOR-14: видалення з підтвердженням «This cannot be undone». |
| Q10 | AC-EDITOR-04 | секція без задач під час збереження версії | A (колега) | solomchaak/property-workflows-spec#24 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-15: «Every section needs at least one task». |
| Q11 | AC-EDITOR-02 | де менеджер відкриває шаблон і що там показано | A (колега) | solomchaak/property-workflows-spec#25 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-02 переформульовано: сторінка шаблону для менеджера. |
| Q12 | AC-EDITOR-02 | менеджер відкриває за прямим посиланням шаблон без збереженої версії | A (колега) | solomchaak/property-workflows-spec#26 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-16: «Template not found». |
| Q13 | — | порожні списки шаблонів і версій | A (колега) | solomchaak/property-workflows-spec#27 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-17 і AC-EDITOR-18: порожні списки шаблонів і версій. |
| Q14 | AC-EDITOR-04 | порожні назви шаблону, секції чи задачі | A (колега) | solomchaak/property-workflows-spec#28 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-19 і AC-EDITOR-20: назви обов'язкові, пробіли = порожньо. |
| Q15 | — | перейменування шаблону й назва в запуску | B (колега) | solomchaak/property-workflows-spec#29 (питання колеги) | Option B прийнято (2026-10-27) | AC-EDITOR-21 і AC-EDITOR-22: назва належить версії, запуск показує назву своєї версії. |
| Q16 | — | однакові назви шаблонів | A (колега) | solomchaak/property-workflows-spec#30 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-23 і AC-EDITOR-24: унікальність без урахування регістру й пробілів. |
| Q17 | AC-EDITOR-01 | збій автозбереження | A (колега) | solomchaak/property-workflows-spec#31 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-25: «Your last change was not kept. Try again.» |
| Q18 | AC-EDITOR-08, AC-EDITOR-09 | гість напряму змінює шаблон | A (колега) | solomchaak/property-workflows-spec#32 (питання колеги) | Option B прийнято (2026-10-27) | AC-EDITOR-26: гість напряму — відмова й перенаправлення на вхід. |
| Q19 | AC-EDITOR-06 | версія запусків, створених до появи версій | A (колега) | solomchaak/property-workflows-spec#33 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-27: запуски до версій показують «Template version 1». |
| Q20 | вимога solomchaak/property-workflows-spec#19 | світла чи темна тема за вибором користувача | A (колега) | solomchaak/property-workflows-spec#34 (питання колеги) | Option A прийнято (2026-10-27) | AC-DSYS-05, AC-DSYS-06, AC-DSYS-07: вибір теми System / Light / Dark. |
| Q21 | AC-EDITOR-02, AC-EDITOR-07 | менеджер напряму запитує старі версії чи непубліковані зміни | A (колега) | solomchaak/property-workflows-spec#37 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-29 додано; загальне правило PM: усе, що заборонено ролі, недосяжне й напряму (матриця прав у `requirements/product.md`). |
| Q22 | AC-EDITOR-03 | що адміністратор бачить одразу після збереження версії | A (колега) | solomchaak/property-workflows-spec#38 (питання колеги) | Option A прийнято (2026-10-27) | AC-EDITOR-03 переформульовано: «Version N saved» на сторінці шаблону. |

Усі питання Q5–Q22 закрито PM 2026-10-27 («Вимоги оновлено (27.10): за вашими питаннями #21–#38»); знімок вимог оновлено командою `/requirements-sync`, переклад — зміна `update-templates-editor`.

### Власні припущення (зріз 2)

- Власних припущень понад вимоги PM немає: усі питання Q5–Q22 закрито PM 2026-10-27, їхні відповіді стали AC (AC-EDITOR-10…29, AC-DSYS-05…08) і припущеннями PM у `requirements/`.

### Що пропустив би без скіла / що скіл знайшов зайве (зріз 2)

Перевірка наявних питань у репо PM показала, що 14 з очевидних прогалин зрізу вже спитали колеги, тому я не створював дублікатів, а шукав те, чого ще не було: куди потрапляє відвідувач після входу з прямого посилання (solomchaak/property-workflows-spec#35) і чи можна переносити задачу між секціями (solomchaak/property-workflows-spec#36). Скіл `spec-review` не знайшов блокерів: усі 43 AC перекладено рівно по одному сценарію, а три дрібниці (нумерація Q, підтвердження останньої задачі без окремого AC, перехід на зимовий час) свідомо лишено без правок. Зайвим вважаю питання про зимовий час для AC-EDITOR-05: воно не змінює ні реалізацію, ні тести.