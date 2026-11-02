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
| AC-EDITOR-07 | відмова в браузері (заборонена роль, прямий запит) | B sees the message "Not enough rights" and no versions. |
| AC-DSYS-04 | стан інтерфейсу (порожній стан) | B sees the message "No runs yet. Launch a template to start one." and the link "Launch a template", and no empty table. |

## A. Ворота

- PR воріт: https://github.com/ylehenkyi-qc/property-workflows/pull/32 (task/quality-gates), злитий
- Зелений `quality` на `main`: https://github.com/ylehenkyi-qc/property-workflows/actions/runs/41443935336 (коміт 94c0b94)
- Обов'язкові перевірки в `solo-main`: ще не додано (потрібна дія власника репо в Settings → Rules після зеленого `quality` на `main`); дата й назви jobs «Ворота: fallow audit», «Покриття: доменна підлога» — після додавання

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

PR: https://github.com/ylehenkyi-qc/property-workflows/pull/33 (task/test-quality). Тести для прогалин написано з тексту AC в тій самій сесії агента, що й код воріт, а не окремою (розробник один; чесне відхилення від поради гайду).

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-DSYS-02 | `src/lib/auth/require-role.ts` (роль з `profiles.role`) + гілка `forbidden` у `src/app/templates/[id]/edit/page.tsx`; запис додатково закриває база (AC-EDITOR-08) | unit (TS) + сторінка + e2e | відмова за роллю — чистий TS без SQL; дослівний текст доведено UAT (розділ C), а спільний макет (`<main>` з `PageShell` і `page-message`) перевіряє сторінковий тест; агент-рецензент макет на кадрі не оцінював | `src/lib/auth/require-role.test.ts` (6 тестів AC-DSYS-02), `src/app/templates/templates-pages.test.tsx:97` |
| AC-EDITOR-07 | політика RLS `template_versions_select_admin` і `grant select` на `template_versions` у `supabase/migrations/20261027130053_template_versions.sql`; гілка `forbidden` у `src/app/templates/[id]/versions/page.tsx` | база (PGlite) + сторінка + e2e | правило живе в SQL (менеджер не читає версій, гість не читає нічого), а сторінка лише віддає відмову; тест сторінки на підробленому Supabase доводить текст і те, що версії не запитуються, але саме правило в базі доводить тест бази; дослівний текст має довести UAT (розділ C) | `tests/db/template-versions.test.ts:200`, `src/app/templates/templates-pages.test.tsx:146` |
| AC-DSYS-04 | порожній стан у `src/app/runs/page.tsx` (`items.length === 0`) | сторінка (підроблений Supabase) + e2e | рядки сторінки, а не `src/lib`: Stryker їх не мутує, тому ручні мутанти E1–E4; дослівний текст доведено UAT (розділ C) | `src/app/runs/design-system.test.tsx:124` |

### Покриття

`npm run test:coverage` на гілці PR (229 тестів): разом 72,74 % рядків, 72,54 % гілок. Це не поріг: сторінки й дії доводять тести бази і UAT (розділ C).

| Файл за AC | Рядки | Гілки | Чим доведено, якщо мало |
|---|---|---|---|
| `src/lib/auth/require-role.ts` | 100 % | 100 % | у `FLOORED`; до цього PR було 100 / 91 %, гілку «без профілю» не виконував жоден тест |
| `src/app/templates/[id]/edit/page.tsx` | 100 % | 59,09 % | гілки `notFound` та завантаження шаблону не стосуються AC-DSYS-02; відмову й макет (`<main>`, `page-message`) доводить `templates-pages.test.tsx:97`; дослівний текст доведено UAT (розділ C) |
| `src/app/runs/page.tsx` | 77,77 % | 67,85 % | порожній стан AC-DSYS-04 виконується тестом `design-system.test.tsx:124`, мутанти E1–E4 убиті |
| `src/app/templates/[id]/versions/page.tsx` | 100 % | 65,38 % | гілка `forbidden` (AC-EDITOR-07) виконується тестом `templates-pages.test.tsx:146`; решта гілок (шаблон не знайдено, помилки читання) не стосується AC |
| політика `template_versions_select_admin` і grant на `template_versions` | немає | немає | JS-покриття SQL не бачить: доведено SQL-мутантами W1–W3 |

### Доказ мутацією

Stryker `10.1.1`, `npm run mutation:ts -- --mutate src/lib/auth/require-role.ts`.

| Мутант (файл:рядок на `main`, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| `require-role.ts:29` `status: "ok"` → `status: ""` | AC-DSYS-02 | вижив | `require-role.test.ts`: «адміністратор проходить: статус ok, його id і роль admin» | убитий |
| `require-role.ts:24` `profile?.role` → `profile.role` | AC-DSYS-02 | вижив | «користувач без рядка профілю … відмова без ролі»: `{ status: "forbidden", role: null }` | убитий |
| `require-role.ts:23` `.select("role")` → `.select("")` | AC-DSYS-02 | вижив | «менеджер B отримує відмову з роллю manager, роль береться з рядка його профілю»: перевіряє запит `profiles` / `role` / `id` | убитий |
| `require-role.ts:19` `data?.claims?.sub` → `data?.claims.sub` | AC-EDITOR-09 (гість) | вижив | «відповідь getClaims без claims — це гість, а не збій сторінки» | убитий |
| `require-role.ts:26` `typeof allowed === "string"` → `false` | AC-DSYS-02 | вижив | — | вижив: еквівалентний (див. нижче) |

- Stryker `require-role.ts`: mutation score **88,89 % → 97,14 %** (до: 28 убито + 4 timeout, 4 вижили; після: 27 убито + 7 timeout, 1 вижив — еквівалентний, див. нижче; ще 1 мутант `StringLiteral` на рядку 27 вимкнено `Stryker disable` з причиною в коді).
- Stryker `runList.ts` (рядки списку запусків під AC-DSYS-04): 89,47 %, 2 вижилі не на рядках цих AC: `templates = []` за замовчуванням (еквівалентний: у масиві-заглушці немає елемента з `id`) і текст запасного «—» для невідомого шаблону (поза трьома AC, вимога AC-TASK-14). Лишено.
- **Ручні TS-мутанти** (`npm run mutation:manual`, `scripts/mutants.mjs`): на порожній стан AC-DSYS-04 (рядки в `src/app/runs/page.tsx`: Stryker мутує лише `src/lib`) — E1 `items.length === 0` → `< 0`, E2 посилання `/runs/new` → `/runs`, E3 текст без другого речення, E4 таблиця лишається поруч із повідомленням; на сторінку версій AC-EDITOR-07 — W4 `requireRole("admin")` → `requireRole(["manager", "admin"])`. **5 з 5 убито** тестами AC-DSYS-04 і AC-EDITOR-07.
- **SQL-мутації** (`npm run mutation:sql`), політика й grant `template_versions` за AC-EDITOR-07; умову послаблено, а не видалено політику (без політики RLS забороняє все, і тест відмови лишився б зеленим з неправильної причини):

| Мутант | AC | Що зламано | Вердикт | Який тест упав |
|---|---|---|---|---|
| W1 | AC-EDITOR-07 | `template_versions_select_admin`: умову ролі прибрано, версії читає будь-хто з входом | KILLED | AC-EDITOR-02, AC-EDITOR-07 |
| W2 | AC-EDITOR-07 | `template_versions_select_admin`: замість admin дозволено менеджера | KILLED | AC-EDITOR-02, AC-EDITOR-05, AC-EDITOR-07 |
| W3 | AC-EDITOR-07 | `grant select` на `template_versions` видано й гостю (`anon`) | KILLED | AC-EDITOR-07 |

  Усі 3 з 3 убито з першого разу (вижилих не було, тож «до/після» для SQL немає: тест `tests/db/template-versions.test.ts:200` уже охороняв правило).
- Еквівалентні мутанти: `require-role.ts:26` (на `main`; зараз рядок 27) — `roles` = рядок замість масиву, коли умова `typeof allowed === "string"` завжди `false`: `role` тут завжди `"manager"` або `"admin"`, жодна назва не є підрядком іншої, тож `"admin".includes(role)` дає ту саму відповідь, що й `["admin"].includes(role)`. Вижилий мутант `ConditionalExpression → false` лишено видимим у звіті; `// Stryker disable` стоїть лише на `StringLiteral` (`typeof allowed === ""`). Мутант `ConditionalExpression → true` НЕ еквівалентний: його вбиває тест «сторінка для кількох ролей пускає менеджера й адміністратора» (виправлено за зауваженням CodeRabbit до PR #33, раніше директива ховала обидва).
- Знахідка під час прогону покриття: чотири файли `tests/db` паралельно під інструментуванням v8 не вкладалися в 10 с хука і давали випадково червоний job «Покриття» (`Hook timed out in 10000ms`). Виправлено в `vitest.coverage.config.mts` (`hookTimeout` 60 с, `testTimeout` 30 с); `npm test` не змінено.

## C. UAT на проді

Прогін: 02.11.2026, 17:41 (Київ), проти https://pmwp-ylehenkyi.vercel.app, коміт проду `2ad9cf2` (= `main` на той момент), код тестів `0908641`. Playwright 37,6 с.

| AC | Специфікація | Тест (твердження) | Агент | Вердикт | Кадр |
|---|---|---|---|---|---|
| AC-DSYS-02 | [`tests/e2e/access-and-states.spec.ts`](https://github.com/ylehenkyi-qc/property-workflows/blob/a4d0783/tests/e2e/access-and-states.spec.ts#L27) | passed | Haiku: PASS | PASS (R6) | [кадр](https://github.com/ylehenkyi-qc/property-workflows/blob/a4d0783/docs/qa/uat/2026-11-02/frames/AC-DSYS-02-then-1.png) |
| AC-EDITOR-07 | [`tests/e2e/access-and-states.spec.ts`](https://github.com/ylehenkyi-qc/property-workflows/blob/a4d0783/tests/e2e/access-and-states.spec.ts#L69) | passed | Haiku: PASS | PASS (R6) | [кадр](https://github.com/ylehenkyi-qc/property-workflows/blob/a4d0783/docs/qa/uat/2026-11-02/frames/AC-EDITOR-07-then-1.png) |
| AC-DSYS-04 | [`tests/e2e/access-and-states.spec.ts`](https://github.com/ylehenkyi-qc/property-workflows/blob/a4d0783/tests/e2e/access-and-states.spec.ts#L102) | passed | Haiku: PASS | PASS (R6) | [кадр](https://github.com/ylehenkyi-qc/property-workflows/blob/a4d0783/docs/qa/uat/2026-11-02/frames/AC-DSYS-04-then-1.png) |

- Звіт: [`docs/qa/uat/2026-11-02/report.md`](https://github.com/ylehenkyi-qc/property-workflows/blob/a4d0783/docs/qa/uat/2026-11-02/report.md)
- Відео: три `.webm` (по одному на AC) у вкладеннях опису PR (PR https://github.com/ylehenkyi-qc/property-workflows/pull/41)
- Рецензент: `claude-haiku-5-5` на всі 3 AC (суперечок немає, Sonnet не викликався), вартість розбору $0,0066 за цінами API.
- Негативний контроль (`npm run uat:nc`, `tests/e2e/negative-controls.spec.ts`; звіт у `test-results/uat-report-nc/`, не в git; прогін 02.11 для AC-DSYS-04, який не змінювався):
  - NC-1 (у тесті навмисно інший очікуваний текст): твердження впало, Haiku сказав PASS, підсумок **FAIL** (R1: агент не перекриває впале твердження).
  - NC-2 (у `ac-text` текст «Тоді» «уточнено», тест і застосунок не змінено): твердження зелені, Haiku і Sonnet сказали FAIL, підсумок **NEEDS-HUMAN** (R3: розбіжність іде до людини).
- Дані: усі три AC мають тег `@writes`: кожен тест створює синтетичного менеджера `uat-<запуск>-<мітка>@example.test`. Запуски й шаблони тести не створюють і не змінюють. Прибирання зі звіту: видалено 3 користувачі, лишилось 0, рядків `runs` лишилось 0. Паролі випадкові на кожен прогін і ніде не записуються.
- Попередня умова AC-EDITOR-07 виконана частково: AC каже «версії 1 і 2», а в шаблону «Tenant move-in» на проді збережена лише версія 1 (крок «Дано» у звіті: «1 in the database»). Створювати версії в спільному шаблоні на проді я не став: тест перевіряє, що менеджер за прямим посиланням не бачить жодної наявної версії (рядків і таблиці немає), хоча база їх має.
- Заміна AC: початково третім AC був AC-TASK-10 («Run not found»), але він належить зрізу 1, а гайд вимагає AC зрізу 2. До відкриття приймання PM його замінено на AC-EDITOR-07 (відмова за роллю, правило в SQL). Що було зроблено для AC-TASK-10 (SQL-мутанти на RLS запусків, UAT 15:42) лишилось в історії PR #33 і #34 і до цих трьох AC не входить.
- Нестабільність під час налагодження (на початку кроку C): два перші прогони дали FAIL через таймаут хука `afterEach`, хоча кадр «Тоді» був правильний, а рецензент не запускався на Windows (`spawn("claude")` не бачить `claude.cmd`). Виправлено двома локальними правками допоміжного коду (`scripts/uat/review.mjs`: запуск `claude.exe`; `attachRuntimeErrors`: запити в польоті не чекаємо довше 3 с). Промпт і схему рецензента не змінено. Причину зависання запиту не з'ясовано: після виправлення воно не відтворилося.

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-DSYS-02 | очікує приймання | <!-- коментар-підпис або issue «Відхилення від вимог» --> |
| AC-EDITOR-07 | очікує приймання | <!-- … --> |
| AC-DSYS-04 | очікує приймання | <!-- … --> |

## D. Eval рецензента

Статус: **ще не виконано** (крок D домашки WS8 попереду). Поля нижче — шаблон.

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
