# Design

## Context

- Специфікація: `openspec/specs/template-editor/`, `design-system/`, дельти `run-launch` і `run-tracking`; вимоги й матриця прав — `requirements/product.md`; ADR зрізу 1 — `docs/decisions/0001-run-model.md`; робочі рішення до відкритих питань solomchaak/property-workflows-spec#21–#36 — `docs/spec-reading.md` («Зріз 2»). PM на ці питання ще не відповів: рішення нижче — робочі припущення розробника, відповідь PM змінює лише їх.
- Що є зараз (зріз 1): `templates`, `template_sections`, `template_tasks` читають усі authenticated (`using (true)`), запис — лише `service_role`; `launch_run` копіює секції й задачі шаблону в `run_sections`/`run_tasks`; `runs` не знає версії шаблону; сторінки `/runs`, `/runs/new`, `/runs/[id]`; редактора й екрана шаблонів немає. Роль — `profiles.role` (`manager`/`admin`), хелпер `private.current_app_role()`.
- Тести бази досі пропускались у CI (немає Docker). У цьому зрізі правила в Postgres покриваємо на PGlite (`tests/db/`, без Docker), тож «реалізовано» ставимо й для правил бази.
- CI: jobs `spec`, `app`, `conformance`, `db-check`, `db-deploy` не змінюємо; нові перевірки — окремим workflow `architecture.yml`. Перед кодом сторінок читаємо гайд у `node_modules/next/dist/docs/` (ця версія Next.js має зміни щодо API).

## Goals / Non-Goals

**Goals:**
- Кожне правило зрізу (хто бачить непубліковані зміни, хто зберігає версію, що бачить гість) гарантує база, а не лише UI; сторінки й дії дублюють перевірку заради зрозумілої відмови.
- Кожне рішення прив'язане до AC.

**Non-Goals:**
- Правила понад вимоги PM: перейменування шаблону, унікальність назв, заборона порожніх назв і секцій без задач, відкидання непублікованих змін, одночасне редагування, перемикач теми (питання solomchaak/property-workflows-spec#24, #28–#30, #34, PM-Q1). Їх не реалізуємо, поки PM не відповів.
- Видалення шаблону й відкриття старішої версії для читання (поза межами вимог).

## UI і компоненти

Дизайн-система (AC-DSYS-01…04) — перша задача зрізу, бо сторінки нижче будуємо вже на ній.

- **Токени й компоненти.** `src/app/globals.css`: `:root`, `@media (prefers-color-scheme: dark)`, `@theme inline`; значення — з `DESIGN.md`, який виводимо з розділу «Вигляд і тон» у `requirements/product.md` (чого там немає — «TODO: питання PM»). Компоненти shadcn/ui в `src/components/ui/` (`button`, `input`, `label`, `card`, `table`, `badge`, `dialog`, `select`, `alert`); сторінки не мають сирих кольорів (`npm run check:design`) і власних `button`/`input`/`label`/`table`.
- **Статуси (AC-DSYS-01).** Один компонент `StatusBadge` у `src/components/status-badge.tsx`: слово статусу завжди поруч з кольором; мапа «in progress» → синій, «completed» і «done» → зелений, «to do» → нейтральний сірий, «Unpublished changes» → теплий жовтий, помилка → червоний; ті самі токени в списку й на сторінці запуску. Окремий тест перевіряє мапу слово → токен.
- **Макет повідомлень.** Один компонент `PageMessage` (заголовок/текст + необов'язкове посилання) для відмов і порожніх станів, у тому самому `<main>`-макеті, що й інші сторінки (AC-DSYS-02, AC-DSYS-03, AC-DSYS-04, AC-TASK-10); помилки форм — `Alert`.
- **Сторінки.**

| Маршрут | Що робить | AC |
|---|---|---|
| `/login` | Вхід у загальному макеті; після входу — на `next`, якщо він безпечний (робоче рішення до solomchaak/property-workflows-spec#35, варіант A) | AC-DSYS-03, AC-EDITOR-09 |
| `/templates` | Адміністратор — усі шаблони з `StatusBadge` «Unpublished changes»; менеджер — лише збережені; порожній список — повідомлення з наступним кроком (рішення до solomchaak/property-workflows-spec#27) | AC-EDITOR-02 |
| `/templates/[id]` | Поточна збережена версія для менеджера (секції, задачі з «required»/«optional») і для адміністратора; шаблон без збереженої версії менеджеру — «Template not found» (рішення до solomchaak/property-workflows-spec#25, #26) | AC-EDITOR-02 |
| `/templates/[id]/edit` | Редактор для адміністратора: секції й задачі (додати, перейменувати, змінити порядок, перенести задачу між секціями — рішення до solomchaak/property-workflows-spec#36, видалити з підтвердженням «This cannot be undone» — до solomchaak/property-workflows-spec#23), позначка «required»/«optional», автозбереження, «Unpublished changes», кнопка «Save version»; менеджеру — «Not enough rights» і «Back to templates» | AC-EDITOR-01, 03, 04, AC-DSYS-02 |
| `/templates/[id]/versions` | Список версій (номер, `DD.MM.YYYY HH:MM` за Kyiv, email автора, новіші першими); менеджеру — «Not enough rights» без версій | AC-EDITOR-05, 07 |
| `/runs`, `/runs/[id]` | Порожній стан із посиланням, назва шаблону, «Template version N», секції, email виконавців, «required»/«optional», підтвердження останньої обов'язкової задачі | AC-DSYS-04, AC-EDITOR-06, AC-TASK-10…18 |

- **Редактор.** Клієнтський компонент зі станом секцій і задач; автозбереження — debounce ~800 мс → Server Action `saveTemplateDraft` (повний вміст як JSON); при збої — `Alert` «Changes could not be saved» (текст не від PM, рішення до solomchaak/property-workflows-spec#31). Чиста логіка (операції над списком секцій/задач, перенесення, перевірка «є обов'язкова задача») — в `src/lib/templates/`, щоб тестувати без бази й браузера. Фокус видимий, усе доступне з клавіатури.
- **Діалог підтвердження останньої обов'язкової задачі (AC-TASK-04, AC-TASK-16).** `Dialog` з назвою задачі й «This cannot be undone»; «Confirm» → `markTaskDone`, «Cancel» нічого не викликає. Чи задача остання обов'язкова, визначає чиста функція (`isLastRequiredTask`) над даними сторінки; право й автозавершення, як і раніше, у `mark_task_done`.

## Дані й RLS

Модель: робоча копія (непубліковані зміни) лишається в існуючих `template_sections`/`template_tasks` і оновлюється автозбереженням (`save_template_draft`, версію не створює); знімок у таблицях версій створює лише збереження версії (`publish_template`, кнопка «Save version»), і він незмінний; менеджери й `launch_run` працюють лише зі знімком поточної версії (AC-EDITOR-02, AC-EDITOR-06). Альтернатива «версія — рядок з `published=false` для чернетки» відкинута: політики видимості менеджеру ускладнюються, а знімок простіше тестувати. Альтернатива «версії в JSON-колонці» відкинута: ламає копіювання в `run_sections`/`run_tasks` і прапорець `required` у запитах.

| Об'єкт | Зміна |
|---|---|
| `templates` | + `current_version integer` (null до першого збереження), + `has_unpublished_changes boolean not null default true` |
| `template_versions` (нова) | `id`, `template_id`, `version integer` (унікальна разом із `template_id`), `created_by` → `profiles`, `created_at` |
| `template_version_sections` (нова) | `id`, `version_id`, `name`, `position` |
| `template_version_tasks` (нова) | `id`, `version_id`, `section_id`, `name`, `required`, `position` |
| `runs` | + `template_version integer` (для наявних запусків — 1) |

Міграція одна на зміну (`npx supabase migration new`, мітка новіша за `origin/main`): таблиці, бекфіл (для наявного шаблону «Tenant move-in» створити версію 1 зі знімком робочої копії, `current_version = 1`, `has_unpublished_changes = false`, `runs.template_version = 1` — рішення до solomchaak/property-workflows-spec#33), політики, функції, `create or replace launch_run`. Застосовані міграції не редагуємо.

- **Права (AC-EDITOR-02, 07, 08, 09).** Для нових таблиць: `enable row level security`; `revoke all … from anon, authenticated`; явні `grant select` лише `authenticated`; `service_role` — повний доступ. Запису для `authenticated` немає ні в одній таблиці шаблонів (наявні `grant` на запис і не було).
  - `templates`: політика `select to authenticated using (admin або current_version is not null)` (менеджер не бачить ніколи не збережений шаблон; рішення до solomchaak/property-workflows-spec#21, #26).
  - `template_sections`, `template_tasks` (робоча копія): політики **замінюємо** на `select … using (admin)`, бо там непубліковані зміни.
  - `template_versions`: `select … using (admin)` — менеджер не бачить список версій (AC-EDITOR-07).
  - `template_version_sections/tasks`: `select … using (admin або версія є поточною версією свого шаблону)` через хелпер `private.can_read_template_version(version_id)` (`security definer`, `set search_path = ''`, `revoke execute from public, anon`, `grant execute to authenticated`), щоб політики не посилались одна на одну (42P17).
  - Усі політики — `to authenticated` і `(select auth.uid())`/`(select private.current_app_role())`; політика на кожну надану операцію (лише `select`), решта заборонена відсутністю `grant`.
- **Запис — лише функціями (AC-EDITOR-01, 03, 04, 08).** Публічні обгортки `security invoker` + реалізація в `private` (`security definer`, `set search_path = ''`); `revoke execute from public, anon`, `grant execute to authenticated`. Першим рядком кожної — перевірка ролі `admin` (інакше виняток `FORBIDDEN`, код `42501`), далі `for update` на рядку шаблону.
  - `create_template(p_name)`: новий шаблон, `current_version = null`, `has_unpublished_changes = true`.
  - `save_template_draft(p_template_id, p_content jsonb)`: замінює робочу копію вмістом (секції → задачі, `required`, порядок) і ставить `has_unpublished_changes = true`; версію не створює; збій відкочує все (одна транзакція).
  - `publish_template(p_template_id)`: якщо в робочій копії немає жодної обов'язкової задачі — виняток із текстом `A template needs at least one required task` (AC-EDITOR-04), нічого не змінюється (ні версії, ні робочої копії, ні прапорця); якщо змін немає (`has_unpublished_changes = false`) — нічого не створює й повертає поточну версію (рішення до solomchaak/property-workflows-spec#22); інакше створює знімок із номером `max(version) + 1` (номер не використовується повторно), ставить `current_version` і `has_unpublished_changes = false`, `created_by = auth.uid()` (AC-EDITOR-03).
  - `launch_run` (`create or replace`, та сама сигнатура): копіює секції й задачі зі знімка **поточної** версії, записує `runs.template_version`; якщо `current_version is null` — технічна помилка (запуск ніколи не йде з непублікованих змін, для всіх ролей; рішення до solomchaak/property-workflows-spec#21). Решта кроків (обрізання пробілів, повідомлення, виконавці) без змін (AC-RUN-11, AC-RUN-12 — уже забезпечені копією; тести додаємо).
- **Список версій (AC-EDITOR-05).** Звичайний запит до `template_versions` з email автора з `profiles` (адміністратор бачить усі профілі за наявною політикою); сортування `version desc`; форматування `DD.MM.YYYY HH:MM` за Kyiv — чиста функція в `src/lib/templates/`.
- **Видимість у запусках.** Email виконавців біля задач (AC-TASK-11) і в виборі виконавця (AC-RUN-10) — як раніше, через `private.list_assignable_users()` (лише `id` і `email`); окремої політики на `profiles` не додаємо.
- Типи БД: `database.types.ts` — із Summary прогону `db-check`.

## Auth

- **Роль і сесія.** Усі сторінки й Server Actions починаються з `requireRole(...)` у `src/lib/auth/require-role.ts`: `supabase.auth.getClaims()` (ніколи `getSession()`), роль — з `profiles.role` (ніколи з `user_metadata`). Немає claims → сторінка редіректить на `/login?next=<безпечний шлях>`, дія повертає помилку «Sign in to continue» (текст не від PM).
- **`next` після входу (робоче рішення до solomchaak/property-workflows-spec#35).** Чиста функція `safeNextPath` у `src/lib/auth/safe-next.ts` (приймає лише відносний шлях того самого сайту, інакше `/`); дія входу після успіху веде на цей шлях. Відмови для користувача з входом лишаються тими самими (AC-TASK-10, AC-DSYS-02).
- **Шаблони — лише адміністратор.** Дії `createTemplate`, `saveTemplateDraft`, `publishTemplate` → `requireRole("admin")`; менеджер отримує «Not enough rights» (AC-EDITOR-07, AC-DSYS-02), але правило тримає база: тест викликає функції й оновлення таблиць напряму від імені менеджера (AC-EDITOR-08). Гість без входу не має ні `grant`, ні `execute`; сторінки редіректять на вхід (AC-EDITOR-09, AC-DSYS-03).
- **Секретного ключа в застосунку не потрібно:** усі дії йдуть клієнтом користувача, admin-клієнт не додаємо. Друге архітектурне правило CI — `check:boundary` (`scripts/check-server-boundary.mjs`): ключ не потрапляє в клієнтський код.
- **Тести доступу (PGlite).** Адаптер `tests/db/supabase-pglite.ts` (`asUser`, `asAnon`, `asServiceRole`) застосовує всі міграції до одноразової бази: менеджер не читає робочу копію, версії й ніколи не збережені шаблони; менеджер і гість не пишуть напряму й функціями; адміністратор зберігає версії. Кожен відмовний AC перевіряє і відмову, і те, що дані не змінились.

## Decisions

### D1. Знімок версії, а не посилання на робочу копію (AC-EDITOR-02, 03, 06)
Збереження копіює робочу копію в `template_version_*`; запуск копіює зі знімка. Версія ніколи не змінюється, а менеджер фізично не має доступу до робочої копії.

### D2. Рішення бази — авторитет, сторінка лише повідомляє (AC-EDITOR-04, 07, 08, 09, AC-DSYS-02, 03)
Перевірка ролі й правила «є обов'язкова задача» — у функціях; Server Actions і сторінки перекладають винятки в тексти AC. Дублювання правила в TypeScript (`hasRequiredTask`) — лише для кнопки «Save version» і швидкого повідомлення; обидва шляхи покриті тестами.

### D3. Одна наскрізна нумерація питань і робочих рішень
Усе, що в таблицях вище позначено «рішення до solomchaak/property-workflows-spec#N», — робоче припущення за рекомендацією питання; тексти повідомлень, яких PM не задав, позначені «не від PM» і в тестах не є критерієм AC.

## Risks / Trade-offs

- [Заміна політик `select` на `template_sections/tasks` ламає наявну форму `/runs/new`, що читає робочу копію] → перевести форму на знімок поточної версії в тій самій задачі, що й міграція; тест форми/дії.
- [Часу на добу обмаль] → задачі впорядковано за цінністю: дизайн-система й версії в базі з тестами — обов'язкові; редактор — друга; доведення запусків (AC-TASK-10…18, AC-RUN-10…12) — остання; не доведене лишається «відкладено (чекає реалізації)» з причиною.
- [Автозбереження перезаписує робочу копію повністю] → одна транзакція; одночасне редагування двома адміністраторами поза межами (вимоги PM), останній запис перемагає.
- [Definer-функції — поверхня безпеки] → лише схема `private`, `set search_path = ''`, `execute` відкликано в `public`/`anon`, першим рядком перевірка ролі; тести на `FORBIDDEN`.
- [Бекфіл версії 1 торкається наявних даних] → лише додає знімок і заповнює нові колонки; деструктивних операцій немає, ризик позначити в описі PR.
- [Робочі рішення до питань PM] → ізольовані в згаданих місцях; відповідь PM змінює лише їх.

## Migration Plan

1. Нові файли міграцій лише через `npx supabase migration new <назва>`; мітка новіша за `origin/main` (`node scripts/check-migration-order.mjs`); застосовані файли не редагуємо. Одна міграція на зміну (версії шаблонів: таблиці → бекфіл → політики → функції → `launch_run`).
2. Типи БД — із Summary `db-check` (або `npm run db:types`).
3. Застосування в базу — лише CI `db-deploy` після merge у `main`; ніколи `supabase db push` з ноутбука. Відкат — новою міграцією-виправленням.
4. Після merge: перевірка прод-сторінок за ролями, `docs/img/ws7-role-<роль>-<сторінка>.png`.
