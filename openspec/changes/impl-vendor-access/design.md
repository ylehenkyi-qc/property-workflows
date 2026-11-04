# Design

## Context

- Специфікація: `openspec/specs/vendor-access/` (AC-VENDOR-01…10); вимога PM і матриця прав — `requirements/39-assign-a-vendor-own-tasks.md`, `requirements/product.md`; ADR зрізів 1–2 — `docs/decisions/0001-run-model.md`, `0002-template-versions.md`; питання й робочі рішення — `docs/spec-reading.md` («Зріз 3»). Станом на 2026-11-04 PM на питання solomchaak/property-workflows-spec#41–#50 ще не відповів, тому рішення з позначкою «рішення до …#N» — робочі припущення за рекомендованим варіантом питання; відповідь PM змінює лише їх.
- Що є зараз (зрізи 1–2), і що з цього для вендора **небезпечне без змін**:
  - `profiles.role` має `check (role in ('manager', 'admin'))`, `default 'manager'`; роль читає `private.current_app_role()`; `profiles` читає лише власник або admin, колонковий `grant update (full_name)`.
  - `private.can_see_run(run_id)` пускає admin, менеджера запуску **і виконавця хоча б однієї задачі** — для вендора це дало б усі задачі, секції й службові колонки запуску (`template_version`, `manager_id`). Політики `runs`, `run_sections`, `run_tasks` викликають цей хелпер.
  - `templates_select_visible` і `private.can_read_template_version` вимагають лише `current_app_role() is not null` — вендор читав би шаблони й знімки версій.
  - `private.launch_run` перевіряє лише `current_app_role() is null`, а виконавцем дозволяє тільки `manager`/`admin`; `private.list_assignable_users()` повертає email **будь-кому, хто увійшов**, — вендор отримав би email усіх менеджерів і адміністраторів.
  - `private.mark_task_done` для не-виконавця повертає дослівне повідомлення AC-TASK-03 (для запуску без задач вендора це розкрило б, що запуск існує).
  - Сторінки: `/runs/[id]` вимагає `requireRole(["manager","admin"])`, інакше `notFound()` (вендор не побачив би навіть свій запуск); `/runs` і `/runs/new` ролі не перевіряють (спираються на RLS); `/templates*` показують «Not enough rights» із посиланням «Back to home». Глобальної навігації немає: роль і посилання — на `/`.
- Тести бази — PGlite (`tests/db/supabase-pglite.ts`, `asUser`, `asAnon`, `asService`); користувачів бере з `supabase/demo-users.json` за порядком (нових додаємо лише в кінець, id існуючих не зсуваються).
- CI: jobs `spec`, `app`, `conformance`, `db-check`, `db-deploy` не змінюємо. Перед кодом сторінок читаємо гайд у `node_modules/next/dist/docs/`.

## Goals / Non-Goals

**Goals:**
- Кожне обмеження вендора тримає база (RLS, права на функції), а не лише сторінка: тест викликає функції й читає таблиці напряму від імені вендора. Сторінки дублюють перевірку лише заради зрозумілого повідомлення.
- Вендор нічого не отримує про чуже: ні рядків, ні кількості, ні службових колонок, ні відмінності між «немає» й «заборонено» (для запусків і задач — завжди «Run not found»).
- Кожне рішення прив'язане до AC ID.

**Non-Goals:**
- Правила понад вимоги PM (прийняття/відхилення задачі, дата візиту, вкладення, призначення вендора після запуску, запрошення, сповіщення) — «Поза межами» вимоги.
- Екрани керування користувачами й ролями (поза межами `requirements/product.md`): вендорів створює скрипт `npm run users:demo` із `supabase/demo-users.json`. Зміну ролі існуючого користувача (solomchaak/property-workflows-spec#45) не будуємо як екран; охорона бази — за часом, див. задачу 8.
- Нові AC: критерій на пряме читання (solomchaak/property-workflows-spec#50) PM ще не схвалив, тож читання перевіряємо тестами бази під назвою AC-VENDOR-04/06, а не новим ID.

## UI і компоненти

Усі нові елементи — з `@/components/ui` і наших обгорток (`PageShell`, `PageMessage`, `StatusBadge`, `Table`, `Card`, `Badge`, `Dialog` через наявний `MarkDoneButton`); без сирих кольорів, нативних віджетів і `confirm()` (`npm run check:design`, `npm run lint`). Тексти — дослівно з AC.

| Маршрут | Вендор бачить | AC |
|---|---|---|
| `/` | email і роль; єдине посилання — «Runs» (без «New run» і «Templates»; рішення до solomchaak/property-workflows-spec#44, варіант A) | AC-VENDOR-08 |
| `/login` | після входу без явного `next` — на `/runs`; із `next` — як раніше (рішення до solomchaak/property-workflows-spec#44) | AC-VENDOR-03 |
| `/runs` | таблиця: назва випадку (посилання), статус запуску (`StatusBadge`), «Your tasks: N of K done»; без назви шаблону й прогресу всього запуску (рішення до solomchaak/property-workflows-spec#42, варіант A); немає запусків — `PageMessage` «No tasks assigned to you yet.» без таблиці й без кнопки «New run» | AC-VENDOR-03, AC-VENDOR-10 |
| `/runs/[id]` | заголовок — назва випадку, «Your tasks: N of K done»; без статусу запуску, назви шаблону, версії, прогресу запуску (рішення до solomchaak/property-workflows-spec#41, варіант A); свої задачі, згруповані за секціями: назва, позначка «required»/«optional», `StatusBadge`; кнопка «Mark as done» на кожній своїй задачі «to do» (рішення до solomchaak/property-workflows-spec#43, варіант B: підтвердження «This cannot be undone» на кожній, а не лише на останній обов'язковій — так діалог нічого не розкриває про чужі задачі); без email виконавців. Запуск без задач вендора й неіснуючий id — однаково `not-found.tsx` «Run not found» | AC-VENDOR-04, 05, 06 |
| `/runs/new`, `/templates`, `/templates/[id]`, `/templates/[id]/versions`, `/templates/[id]/edit` | `PageMessage` «Not enough rights» із посиланням «Back to runs» у загальному макеті, без шаблонів, форми й даних (рішення до solomchaak/property-workflows-spec#47, варіант B, і #49, варіант A: те саме повідомлення, що в AC-VENDOR-08, а посилання веде на сторінку, яку вендор може відкрити) | AC-VENDOR-08 |

- **Менеджер і адміністратор:** у виборі виконавця під час запуску з'являються email вендорів (список той самий `list_assignable_users`, лише з ширшим набором ролей); на сторінці запуску email вендора біля його задачі показано як email інших виконавців (AC-TASK-11) — це вже робить `assigneeLabel`.
- **Чиста логіка** (тестується без бази й браузера) — `src/lib/runs/progress.ts`: `formatVendorProgress(tasks)` → «Your tasks: N of K done» (AC-VENDOR-03, 05, 10); `src/lib/runs/permissions.ts`: `canMarkDone` для ролі `vendor` — лише власна задача «to do»; `src/lib/auth/require-role.ts`: `AppRole` + `vendor`; хелпер `refusalLink(role)` — «Back to runs» для вендора й чинне посилання для інших.

## Дані й RLS

Модель: вендор — звичайний `profiles` із роллю `vendor`; нових таблиць немає. Читання вендором іде двома шляхами: **рядки задач і секцій — звичайними таблицями під RLS, звуженою до власних задач**, а **заголовок запуску (назва, статус, лічильники) — вузькою функцією**, бо `runs` має колонки (`template_id`, `template_version`, `manager_id`), які вендору бачити не можна, а колонковий `grant` не розрізняє ролей застосунку. Альтернатива «вендор читає `runs` напряму з політикою `can_see_run`» відкинута: розкриває версію шаблону, яку матриця прав вендору забороняє. Альтернатива «вендор читає лише через функції, а таблиці для нього порожні» відкинута: пряме читання `run_tasks` вендором мало б повертати рівно його задачі (рішення до solomchaak/property-workflows-spec#50, варіант A), а не «нічого».

Три міграції, по одній на задачу (одна міграція на зміну; мітка новіша за `origin/main`, `node scripts/check-migration-order.mjs`; застосовані файли не редагуємо). Користувачів із роллю `vendor` у базі **не створюємо**, доки не злито задачі 1–4 (група 5): до цього політики ще відкриті для нової ролі.

| Міграція (задача) | Зміна | AC |
|---|---|---|
| `vendor_role` (1) | роль у `profiles_role_check`; `launch_run`; `list_assignable_users` | AC-VENDOR-01, 02, 09 |
| `vendor_reads` (2) | `can_see_run`; політики `run_sections`, `run_tasks`, `templates`; `can_read_template_version`; `list_vendor_runs` | AC-VENDOR-03, 04, 06, 08, 10 |
| `vendor_mark_done` (3) | `mark_task_done` | AC-VENDOR-05, 07 |

- **Набір ролей (задача 1, AC-VENDOR-01).** Порядок із заголовка `20261012000000_profiles_and_roles.sql`: зняти `profiles_role_check` → `update` даних не потрібен (ніхто не стає вендором міграцією) → `default` лишається `'manager'` (його не міняємо: тригер `on_auth_user_created` і `users:demo` продовжують працювати, роль вендора ставить лише `service_role`) → новий `check (role in ('manager', 'admin', 'vendor'))`. Права на `profiles` не змінюємо: вендор бачить лише власний профіль, колонковий `grant update (full_name)` не дає йому змінити собі роль (матриця прав).
- **`launch_run` (задача 1, AC-VENDOR-01, 09).** `create or replace` (та сама сигнатура; тіло — з останньої версії в `20261027130053_template_versions.sql`), дві зміни: перший рядок — `private.current_app_role()` має бути `manager` або `admin`, інакше виняток `Not authorized` (`42501`) до будь-якого запису — вендор запуск не створює (AC-VENDOR-09); виконавцем призначення може бути `manager`, `admin` або `vendor` (AC-VENDOR-01), решта задач — менеджер запуску. Менеджером запуску стає лише той, хто запускає, тож вендор ніколи не менеджер запуску.
- **`list_assignable_users` (задача 1, AC-VENDOR-02).** `create or replace` приватної реалізації: ролі `manager`, `admin`, `vendor`; **лише для викликача з роллю `manager` або `admin`** (інакше порожній результат): вендор не бачить email нікого (матриця прав). Повертає, як і раніше, тільки `id` і `email` — без імені, ролі й профілю.
- **`private.can_see_run` (задача 2, AC-VENDOR-04, 06).** `create or replace`: `admin` — завжди; `manager` — менеджер запуску або виконавець; інша роль, зокрема `vendor`, — `false`. Політики `runs_select_visible` лишаються: вендор не читає рядків `runs`, тож `template_version`, `template_id` і `manager_id` не розкриваються.
- **`run_tasks`, `run_sections` (задача 2, AC-VENDOR-04, 06).** Політики `select` замінюємо (`drop policy` + `create policy`, `to authenticated`, `(select auth.uid())`): `run_tasks` — `can_see_run(run_id)` **або** (роль `vendor` і `assignee_id = (select auth.uid())`) — рівно власні задачі; `run_sections` — `can_see_run(run_id)` **або** хелпер `private.vendor_has_task_in_section(id)` (`security definer`, `set search_path = ''`, `revoke execute from public, anon`, `grant execute to authenticated`): секція видна вендору лише якщо в ній є його задача, тож назви секцій чужих задач не розкриваються. Запису для `authenticated` немає, як і раніше (лише `select`).
- **`list_vendor_runs(p_run_id uuid default null)` (задача 2, AC-VENDOR-03, 04, 06, 10).** Публічна обгортка `security invoker` + реалізація `private` (`security definer`, `set search_path = ''`, `revoke execute from public, anon`, `grant execute to authenticated`). Повертає `id`, `case_name`, `status`, `tasks_total` (K), `tasks_done` (N) лише для запусків, де викликач із роллю `vendor` має задачу; лічильники — лише по його задачах (припущення PM). Параметр звужує до одного запуску (сторінка запуску). Для інших ролей — порожній результат (вони читають `runs` напряму). Порядок — новіші першими (`runs.created_at desc`), як у списку менеджера.
- **Шаблони (задача 2, AC-VENDOR-08).** `templates_select_visible` і `private.can_read_template_version` змінюємо: `current_app_role() in ('manager', 'admin')` замість `is not null` (решта умов — як у ADR 0002). Політики `template_sections`, `template_tasks`, `template_versions`, `template_drafts` уже `admin`-лише, тож вендор не читає нічого з шаблонів; сторінка «Not enough rights» — додатковий шар.
- **`mark_task_done` (задача 3, AC-VENDOR-05, 07).** `create or replace` приватної реалізації, зберігаючи наявні рядки (блокування запуску й задачі, «повторна позначка нічого не змінює», автозавершення запуску). Додаємо перед перевіркою прав: якщо викликач — `vendor` і **не має жодної задачі в цьому запуску** (або задачі немає взагалі), виняток `Run not found` (`P0002`); вендор, що має інші задачі в запуску, але не виконавець цієї, отримує дослівне повідомлення AC-TASK-03 (`42501`) (рішення до solomchaak/property-workflows-spec#48, варіант B). В обох випадках задача лишається як була — нічого не змінюємо. Позначка власної задачі в запуску «completed» дозволена, як і раніше (статус запуску не перевіряємо; рішення до solomchaak/property-workflows-spec#46, варіант A).
- **Типи БД.** `src/lib/supabase/database.types.ts` — із Summary `db-check` після кожної міграції (нові функції `list_vendor_runs`).
- **Дані для тестів і демо.** `supabase/demo-users.json`: `vendor1@example.test` (виконавець задач у тестах), `vendor2@example.test` (без задач: AC-VENDOR-10) — в кінець списку, щоб id тестових користувачів не зсунулись; `tests/db/supabase-pglite.ts`: тип ролі + `vendor`.

## Auth

- **Роль і сесія.** Усі сторінки й Server Actions починаються з `requireRole(...)` (`getClaims()`, ніколи `getSession()`); роль — з `profiles.role`, ніколи з `user_metadata`. `AppRole` розширюємо до `"manager" | "admin" | "vendor"`.
- **Сторінки.** `/runs`, `/runs/[id]` — `requireRole(["manager", "admin", "vendor"])`, далі гілка за роллю (вендор — `list_vendor_runs` і таблиці під RLS; менеджер/адмін — як зараз). `/runs/new`, `/templates*` — `requireRole(["manager", "admin"])` (для `/templates/[id]/edit` і версій — як зараз, адмін), `forbidden` для вендора → «Not enough rights» із «Back to runs». Без входу — редірект на `/login?next=…`, як у зрізі 2.
- **Server Actions.** `launchRun` — `requireRole(["manager", "admin"])` першим рядком (вендор отримує відмову до виклику `rpc`); `markTaskDone` — лише `getClaims()` і `rpc` (право тримає база); додаємо в `markTaskErrors` код для `Run not found` (`P0002`), щоб сторінка не показувала помилку «Could not mark the task as done» для відмови, що має виглядати як відсутній запуск. Секретного ключа й admin-клієнта в застосунку не додаємо.
- **Вхід.** Дія входу після успіху читає роль; якщо явного `next` немає і роль `vendor` — веде на `/runs` (рішення до solomchaak/property-workflows-spec#44), інакше — як зараз.
- **Тести доступу (PGlite).** `asUser(vendorId, …)` напряму: `launch_run` відхилено й `runs` не додалось (AC-VENDOR-09); читання `templates`/`template_*` порожнє (AC-VENDOR-08); `run_tasks` — рівно власні задачі, `run_sections` — лише секції з власними задачами, `runs` порожня, `profiles` — лише власний рядок, `list_assignable_users` порожній (AC-VENDOR-02, 04); запуск без задач вендора — нічого не повертає, `list_vendor_runs(id)` порожній (AC-VENDOR-06); `mark_task_done` на чужу задачу — відмова й задача лишається «to_do» в обох випадках рішення #48 (AC-VENDOR-07); `update profiles set role` від вендора — `permission denied`. Кожен відмовний AC перевіряє і відмову, і те, що дані не змінились.

## Decisions

### D1. Рядки задач — під RLS для вендора, заголовок запуску — функцією (AC-VENDOR-03, 04, 06)
Вендор читає `run_tasks` і `run_sections` як звичайні таблиці, але політика обмежує його власними задачами; `runs` для нього закрита, а назву, статус і лічильники повертає `list_vendor_runs`. Так пряме читання повертає «рівно свої задачі» (#50), а службові колонки `runs` недосяжні.

### D2. Для вендора «немає» і «заборонено» не відрізняються (AC-VENDOR-06, 07)
Сторінка запуску без задач вендора, неіснуючий id і відмова `mark_task_done` у такому запуску дають одне й те саме «Run not found»; повідомлення AC-TASK-03 вендор бачить лише в запуску, де в нього є інші задачі (#48, варіант B), тож перебір ідентифікаторів нічого не розкриває.

### D3. Закрити все, що вендору не належить, **до** появи вендорів у базі (AC-VENDOR-08, 09, 02)
Міграції 1–3 звужують політики й функції для ролі `vendor`; користувачів із цією роллю (`npm run users:demo`) створюємо в групі 5, тобто після злиття 1–4. До того «вендор» існує лише в тестах PGlite.

### D4. Одна функція, обгортка + private (AC-VENDOR-01, 02, 03, 05, 09)
Нові й змінені функції — за наявним шаблоном: `security invoker` обгортка в `public`, реалізація в `private` (`security definer`, `set search_path = ''`), `revoke execute from public, anon`, `grant execute to authenticated`; перший рядок — перевірка ролі.

### D5. Робочі рішення до відкритих питань PM (AC-VENDOR-03, 04, 05, 07, 08, 09)
Усе, що в таблицях вище позначено «рішення до solomchaak/property-workflows-spec#N», — робоче припущення за рекомендованим варіантом питання (#41 A, #42 A, #43 B, #44 A, #46 A, #47 B, #48 B, #49 A, #50 A); тексти, яких PM не задав, у тестах не є критерієм AC. Питання #45 (зміна ролі) — не реалізуємо до відповіді PM, окрім необов'язкової охорони в задачі 8.

## Risks / Trade-offs

- [Нова роль у відкритих політиках: `can_see_run`, `templates`, `list_assignable_users` пускали б вендора] → звуження в міграціях 1–3 і порядок D3; тести бази кожного читання напряму; мутаційна перевірка (прибрати звуження → червоний тест).
- [Дві схеми читання (таблиці й `list_vendor_runs`) можуть розійтись] → один набір тестів бази перевіряє обидві для одного вендора; лічильники беруться з тих самих рядків `run_tasks`.
- [Відповідь PM змінить рішення (#41–#50)] → рішення ізольовані в позначених місцях; зміна — окрема `clarify-vendor-access` і нова задача.
- [`launch_run` і `mark_task_done` переписуємо повністю] → тіло береться з останньої версії, наявні тести зрізів 1–2 (`tests/db/*.test.ts`) мають лишитись зеленими без змін.
- [Часу обмаль: зріз із UAT на кожен AC (14–18 год)] → порядок за цінністю: 1–3 (правила бази й тести) → 4 → 5 → UAT; не доведене лишається «Не перевірено» з причиною.
- [Деструктивних операцій немає] → міграції лише `create or replace`, `drop policy`/`create policy` і заміна `check`; ризик (заміна політик) позначаємо в описі PR.

## Migration Plan

1. Нові файли міграцій лише через `npx supabase migration new <назва>`; мітка новіша за `origin/main` (`node scripts/check-migration-order.mjs`); застосовані файли не редагуємо; одна міграція на PR.
2. Типи БД — із Summary `db-check` (або `npm run db:types`).
3. Застосування в базу — лише CI `db-deploy` після merge; ніколи `supabase db push` з ноутбука. Відкат — новою міграцією-виправленням.
4. Після merge задач 1–4: `npm run users:demo` (група 5) створює вендорів на проді; перевірка прод-сторінок за ролями.
