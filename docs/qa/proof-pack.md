# QA proof pack: Property Workflows, зріз 2 (ролі, права, дизайн-система)

<!--
Шаблон з koldovsky/2026-quitcode-08-quality-hw/materials/templates/proof-pack.template.md.
Покладіть у docs/qa/proof-pack.md вашого репо й заповнюйте по кроках WS8 (A → B → C → D).
Посилання — на файли на коміті (…/blob/<sha>/…#L<N>), на PR (…/pull/N) і на прогони (…/actions/runs/N).
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
Цей файл — вхід для конвеєра WS9: на кожен AC видно, чим він доведений.
-->

- Прод-URL: https://pmwp-ylehenkyi.vercel.app
- Вимоги: https://github.com/solomchaak/property-workflows-spec · джерело: issues · знімок 2026-10-27
- `/api/health` на момент UAT: <!-- sha і db, напр. «sha 1a2b3c4, db ok, 01.11.2026» -->

## 3 AC

| AC | Вид | «Тоді» (дослівно з вимоги PM) |
|---|---|---|
| AC-DSYS-02 | відмова в браузері (заборонена роль) | B sees the message "Not enough rights" and the link "Back to templates" in the same page layout as the other pages, no content of the editor, and the template stays at version 1 with no unpublished changes. |
| AC-TASK-10 | відмова в браузері (чужі дані за прямим посиланням) | manager C sees the message "Run not found" and none of the tasks of the run. |
| AC-DSYS-04 | стан інтерфейсу (порожній стан) | B sees the message "No runs yet. Launch a template to start one." and the link "Launch a template", and no empty table. |

## A. Ворота

- PR воріт: <!-- …/pull/N -->  (task/quality-gates)
- Зелений `quality` на `main`: <!-- …/actions/runs/N -->
- Обов'язкові перевірки в `solo-main` з <!-- дата -->: <!-- назви jobs -->

Розбір першого повного прогону `fallow` (той самий — в описі PR воріт):

| Група знахідок | Скільки | Справжня / навмисна / хибна | Дія і причина |
|---|---|---|---|
| unused file `src/lib/supabase/client.ts` | 1 | навмисна | лишено без `ignore`: клієнт Supabase для браузера з шаблону (AGENTS.md, «Структура»); ворота `new-only`, успадковане не валить прогін |
| unused export `AC_ID_GLOBAL` у `scripts/lib/spec-lib.mjs` | 1 | навмисна | скрипт курсу, його не змінюємо (правки йдуть через «Оновлення шаблону»); лишено |
| дублі коду (4 clone groups, 130 рядків, 2.4 %) | 4 | справжня, низький ризик | `check-design-tokens.mjs` і `check-server-boundary.mjs` (обхід файлів), `edit/page.tsx` і `versions/page.tsx`, `runs/error.tsx` і `templates/error.tsx`; не ворота, рефакторинг не входить у цей PR |
| складність: 19 функцій вище порогу | 19 | справжня | сторінки Next.js (`TemplatePage`, `TemplatesPage`, `RunsPage` …), `TemplateEditor`, скрипти перевірок і `GET` у `/api/health`; ворота `new-only` не валять, нову складність PR вже рахує як знахідку; лишено |
| лінт: `vi.mock("@/lib/auth/require-role")` у `src/app/templates/actions.test.ts` | 1 | справжня | виправлено в цьому PR: мок власного `requireRole` замінено на мок клієнта Supabase (`@/lib/supabase/server`), роль читає справжній код |
| лінт: AC ID посеред назви тесту в `src/lib/runs/markTaskErrors.test.ts` | 1 | справжня | виправлено в цьому PR: назва починається з `AC-TASK-03:`, тест тепер рахує `ac:coverage` |

## B. Якість тестів

PR: <!-- …/pull/N -->  (task/test-quality). Тести для прогалин написано з тексту AC в тій самій сесії агента, що й код воріт, а не окремою (розробник один; чесне відхилення від поради гайду).

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-DSYS-02 | `src/lib/auth/require-role.ts` (роль з `profiles.role`) + гілка `forbidden` у `src/app/templates/[id]/edit/page.tsx`; запис додатково закриває база (AC-EDITOR-08) | unit (TS) + сторінка + e2e | відмова за роллю — чистий TS без SQL; сторінка рендериться на підробленому Supabase, дослівний текст і макет доводить UAT | `src/lib/auth/require-role.test.ts` (6 тестів AC-DSYS-02), `src/app/templates/templates-pages.test.tsx:97` |
| AC-TASK-10 | політики RLS `runs_select_visible`, `run_sections_select_visible`, `run_tasks_select_visible` і `private.can_see_run()` у `supabase/migrations/20261020091923_run_schema_and_seed.sql` | база (PGlite) + сторінка + e2e | правило живе в SQL; тест сторінки `src/app/runs/run-tracking-pages.test.tsx:88` лише підставляє «RLS нічого не віддав», тож саме правило він не доводить (це мок результату) | `tests/db/run-tracking.test.ts:130` (сторонній менеджер не читає ні запуску, ні секцій, ні задач) |
| AC-DSYS-04 | порожній стан у `src/app/runs/page.tsx` (`items.length === 0`) | сторінка (підроблений Supabase) + e2e | рядки сторінки, а не `src/lib`: Stryker їх не мутує, тому ручні мутанти E1–E4; дослівний текст доводить UAT | `src/app/runs/design-system.test.tsx:124` |

### Покриття

`npm run test:coverage` на гілці PR (229 тестів): разом 72,74 % рядків, 72,54 % гілок. Це не поріг: сторінки й дії доводять тести бази й UAT.

| Файл за AC | Рядки | Гілки | Чим доведено, якщо мало |
|---|---|---|---|
| `src/lib/auth/require-role.ts` | 100 % | 100 % | у `FLOORED`; до цього PR було 100 / 91 %, гілку «без профілю» не виконував жоден тест |
| `src/app/templates/[id]/edit/page.tsx` | 100 % | 59,09 % | гілки `notFound` і завантаження шаблону не стосуються AC-DSYS-02; відмову доводить `templates-pages.test.tsx:97` і UAT |
| `src/app/runs/page.tsx` | 77,77 % | 67,85 % | порожній стан AC-DSYS-04 виконується тестом `design-system.test.tsx:124`, мутанти E1–E4 убиті |
| `src/app/runs/[id]/page.tsx` | 95,83 % | 70,83 % | гілка «Run not found» виконується; правило видимості живе в SQL і доведене SQL-мутантами V1–V6 |
| політики RLS і `private.can_see_run()` | немає | немає | JS-покриття SQL не бачить: доведено SQL-мутантами |

### Доказ мутацією

Stryker `10.1.1`, `npm run mutation:ts -- --mutate src/lib/auth/require-role.ts`.

| Мутант (файл:рядок на `main`, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| `require-role.ts:29` `status: "ok"` → `status: ""` | AC-DSYS-02 | вижив | `require-role.test.ts`: «адміністратор проходить: статус ok, його id і роль admin» | убитий |
| `require-role.ts:24` `profile?.role` → `profile.role` | AC-DSYS-02 | вижив | «користувач без рядка профілю … відмова без ролі»: `{ status: "forbidden", role: null }` | убитий |
| `require-role.ts:23` `.select("role")` → `.select("")` | AC-DSYS-02 | вижив | «менеджер B отримує відмову з роллю manager, роль береться з рядка його профілю»: перевіряє запит `profiles` / `role` / `id` | убитий |
| `require-role.ts:19` `data?.claims?.sub` → `data?.claims.sub` | AC-EDITOR-09 (гість) | вижив | «відповідь getClaims без claims — це гість, а не збій сторінки» | убитий |
| `require-role.ts:26` `typeof allowed === "string"` → `false` / `""` | AC-DSYS-02 | вижив | — | еквівалентний (див. нижче) |

- Stryker `require-role.ts`: mutation score **88,89 % → 100 %** (до: 28 убито + 4 timeout, 4 вижили; після: 31 убито + 2 timeout, 0 вижили, 1 група — еквівалентні з `Stryker disable` і причиною в коді).
- Stryker `runList.ts` (рядки списку запусків під AC-DSYS-04): 89,47 %, 2 вижилі не на рядках цих AC: `templates = []` за замовчуванням (еквівалентний: у масиві-заглушці немає елемента з `id`) і текст запасного «—» для невідомого шаблону (поза трьома AC, вимога AC-TASK-14). Лишено.
- **Ручні TS-мутанти на порожній стан** (`npm run mutation:manual`, `scripts/mutants.mjs`): E1 `items.length === 0` → `< 0`, E2 посилання `/runs/new` → `/runs`, E3 текст без другого речення, E4 таблиця лишається поруч із повідомленням — **4 з 4 убито** тестом AC-DSYS-04.
- **SQL-мутації** (`npm run mutation:sql`), політики й `can_see_run` за AC-TASK-10, умову послаблено до `true`:

| Мутант | AC | Що зламано | Вердикт | Який тест упав |
|---|---|---|---|---|
| V1 | AC-TASK-10 | `can_see_run`: гілка адміністратора завжди `true` | KILLED | AC-TASK-10, AC-TASK-06, AC-TASK-17 |
| V2 | AC-TASK-10 | `can_see_run`: «менеджер запуску» — будь-який запуск з `manager_id` | KILLED | AC-TASK-10, AC-TASK-06, AC-TASK-17 |
| V3 | AC-TASK-10 | `can_see_run`: «виконавець» — будь-хто, якщо є призначена задача | KILLED | AC-TASK-10, AC-TASK-06, AC-TASK-17 |
| V4 | AC-TASK-10 | `runs_select_visible` без перевірки видимості | KILLED | AC-TASK-10, AC-TASK-06, AC-TASK-17 |
| V5 | AC-TASK-10 | `run_tasks_select_visible` без перевірки видимості | KILLED | AC-TASK-10 |
| V6 | AC-TASK-10 | `run_sections_select_visible` без перевірки видимості | KILLED | AC-TASK-10 |

  Усі 6 з 6 убито з першого разу (вижилих не було, тож «до/після» для SQL немає: тест `tests/db/run-tracking.test.ts:130` уже охороняв правило).
- Еквівалентні мутанти: `require-role.ts:26` (`roles` = рядок замість масиву): `role` тут завжди `"manager"` або `"admin"`, жодна назва не є підрядком іншої, тож `"admin".includes(role)` дає ту саму відповідь, що й `["admin"].includes(role)`. Прийнято з `// Stryker disable` і причиною в коді.
- Знахідка під час прогону покриття: чотири файли `tests/db` паралельно під інструментуванням v8 не вкладалися в 10 с хука і давали випадково червоний job «Покриття» (`Hook timed out in 10000ms`). Виправлено в `vitest.coverage.config.mts` (`hookTimeout` 60 с, `testTimeout` 30 с); `npm test` не змінено.

## C. UAT на проді

| AC | Специфікація | Тест (твердження) | Агент | Вердикт | Кадр |
|---|---|---|---|---|---|
| AC-…-NN | <!-- …/blob/<sha>/tests/e2e/….spec.ts --> | <!-- passed / failed --> | <!-- Haiku: PASS / FAIL / NEEDS-HUMAN (+ Sonnet, якщо була суперечка) --> | <!-- PASS / FAIL / NEEDS-HUMAN і правило (R1–R6) --> | <!-- …/blob/<sha>/docs/qa/uat/<дата>/frames/AC-…-then-1.png --> |

- Звіт: <!-- …/blob/<sha>/docs/qa/uat/<YYYY-MM-DD>/report.md -->
- Відео: <!-- вкладення в описі PR …/pull/N -->
- Рецензент: <!-- моделі зі звіту (claude-haiku-5-5; суперечки — claude-sonnet-5-5) і вартість прогону -->
- Негативний контроль: <!-- NC-… (npm run uat:nc): що навмисно хибне, вердикт (FAIL / NEEDS-HUMAN), …/pull/N -->
- Дані: <!-- «лише читання» або «@writes: uat-<запуск>@example.test, рядок «Прибирання» зі звіту» -->

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-…-NN | <!-- ✅ / ❌ / NEEDS-HUMAN → … --> | <!-- коментар-підпис або issue «Відхилення від вимог» --> |

## D. Eval рецензента

- PR з вадами (не злитий): <!-- …/pull/N -->
- Ключ і таблиця: <!-- …/pull/N#issuecomment-M -->

| # | Вада (ключ) | CodeRabbit | `/code-review high` |
|---|---|---|---|
| 1 | <!-- категорія і файл:рядок --> | <!-- знайшов / пропустив + цитата --> | <!-- знайшов / пропустив + цитата --> |
| 2 | … | … | … |
| 3 | … | … | … |
| П | приманка: <!-- що --> | <!-- хибна тривога? цитата --> | <!-- хибна тривога? цитата --> |

- Інші знахідки: <!-- слушна / шум, по рядку на кожну -->
- Правило, що закриває пропуск: <!-- рядок в AGENTS.md чи path instruction, …/commit/<sha> -->
- Повторний прогін: <!-- хто, результат, цитата, …/pull/N#issuecomment-M -->
