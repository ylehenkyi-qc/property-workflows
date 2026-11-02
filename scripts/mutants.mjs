// Мутанти для scripts/mutation-check.mjs (npm run mutation:sql). Мутант = одне правило з AC, навмисно зламане.
// Джерело формату — демо-репо курсу, scripts/mutants.mjs (тег ws8-02-tests); там 11 SQL- і 2 TS-мутанти.
// Поля:
//   id, kind ("sql" | "ts"), ac (який AC це правило доводить), what (що зламано — людською мовою);
//   file — що мутуємо; tests — файли тестів, які мають довести правило (саме їх і запускаємо);
//   find — рядок або RegExp, що трапляється у файлі РІВНО один раз (надійніше за номери рядків, які зсуваються);
//   replace — заміна (вставляється буквально: «$$» у plpgsql лишається «$$»);
//   expect: "survive" + reason — лише для еквівалентного мутанта (поведінка не змінюється) з посиланням на те,
//   що робить його еквівалентним (рядок міграції, інший тест). Без reason скрипт мутант не приймає.
// Новий AC з відмовою, правило якого живе в SQL (політика, grant, функція, тригер), — новий мутант тут.
//
// Мутанти на правила SQL за AC-TASK-10 (чужий запуск за прямим посиланням: «Run not found», жодної задачі). Правило —
// політики RLS runs / run_sections / run_tasks і private.can_see_run(). Умову послаблено до true, а не видалено політику.
const RUN_SCHEMA = "supabase/migrations/20261020091923_run_schema_and_seed.sql";
const RUN_DB = "tests/db/run-tracking.test.ts";
const RUNS_PAGE = "src/app/runs/page.tsx";
const RUNS_PAGE_TEST = "src/app/runs/design-system.test.tsx";

export const mutants = [
  {
    id: "V1", kind: "sql", ac: "AC-TASK-10", file: RUN_SCHEMA, tests: [RUN_DB],
    what: "can_see_run: гілка адміністратора завжди true — будь-який менеджер бачить будь-який запуск",
    find: "coalesce(private.current_app_role(), '') = 'admin'",
    replace: "true",
  },
  {
    id: "V2", kind: "sql", ac: "AC-TASK-10", file: RUN_SCHEMA, tests: [RUN_DB],
    what: "can_see_run: «менеджер запуску» — будь-який запуск, де manager_id не порожній",
    find: "r.manager_id = (select auth.uid())",
    replace: "r.manager_id is not null",
  },
  {
    id: "V3", kind: "sql", ac: "AC-TASK-10", file: RUN_SCHEMA, tests: [RUN_DB],
    what: "can_see_run: «виконавець» — будь-хто, якщо в запуску є призначена задача",
    find: "t.assignee_id = (select auth.uid())",
    replace: "t.assignee_id is not null",
  },
  {
    id: "V4", kind: "sql", ac: "AC-TASK-10", file: RUN_SCHEMA, tests: [RUN_DB],
    what: "runs_select_visible: перевірка видимості прибрана з політики запусків",
    find: "private.can_see_run(id)",
    replace: "true",
  },
  {
    id: "V5", kind: "sql", ac: "AC-TASK-10", file: RUN_SCHEMA, tests: [RUN_DB],
    what: "run_tasks_select_visible: сторонній менеджер читає задачі чужого запуску",
    find: "using ((select auth.uid()) is not null and private.can_see_run(run_id));\n\n-- ── Сид",
    replace: "using ((select auth.uid()) is not null);\n\n-- ── Сид",
  },
  {
    id: "V6", kind: "sql", ac: "AC-TASK-10", file: RUN_SCHEMA, tests: [RUN_DB],
    what: "run_sections_select_visible: сторонній менеджер читає секції чужого запуску",
    find: "using ((select auth.uid()) is not null and private.can_see_run(run_id));\n\ncreate policy run_tasks_select_visible",
    replace: "using ((select auth.uid()) is not null);\n\ncreate policy run_tasks_select_visible",
  },

  // Ручні TS-мутанти на порожній стан AC-DSYS-04 (рядки в src/app/runs/page.tsx: Stryker мутує лише src/lib).
  {
    id: "E1", kind: "ts", ac: "AC-DSYS-04", file: RUNS_PAGE, tests: [RUNS_PAGE_TEST],
    what: "порожній стан ніколи не показується (умова items.length === 0 → items.length < 0)",
    find: "{items.length === 0 ? (",
    replace: "{items.length < 0 ? (",
  },
  {
    id: "E2", kind: "ts", ac: "AC-DSYS-04", file: RUNS_PAGE, tests: [RUNS_PAGE_TEST],
    what: "посилання «Launch a template» веде не на форму запуску",
    find: 'link={{ href: "/runs/new", label: "Launch a template" }}',
    replace: 'link={{ href: "/runs", label: "Launch a template" }}',
  },
  {
    id: "E3", kind: "ts", ac: "AC-DSYS-04", file: RUNS_PAGE, tests: [RUNS_PAGE_TEST],
    what: "текст порожнього стану змінено («No runs yet.» без другого речення)",
    find: 'title="No runs yet. Launch a template to start one."',
    replace: 'title="No runs yet."',
  },
  {
    id: "E4", kind: "ts", ac: "AC-DSYS-04", file: RUNS_PAGE, tests: [RUNS_PAGE_TEST],
    what: "у порожньому списку лишається заголовок таблиці (пуста таблиця поруч із повідомленням)",
    find: ") : (\n        <Table>",
    replace: ") : null}\n      {true && (\n        <Table>",
  },
];

// Приклади з демо (інша схема — у вашому репо цих файлів немає, тож не розкоментовуйте як є):
//
// SQL, межа з AC — діапазон напіввідкритий, останній день заявки не рахується:
//   { id: "L2", kind: "sql", ac: "AC-LEAVE-11", file: RULES, tests: [LEAVE_DB],
//     what: "перетин: діапазон НОВОЇ заявки напіввідкритий [початок, кінець)",
//     find: "pg_catalog.daterange(p_start_date, p_end_date, '[]')",
//     replace: "pg_catalog.daterange(p_start_date, p_end_date, '[)')" },
//
// SQL, політика послаблена до true (а не видалена: без політики RLS забороняє все, і тест відмови лишився б зеленим):
//   { id: "L5", kind: "sql", ac: "передумова AC-LEAVE-04/10", file: LEAVE, tests: [LEAVE_DB],
//     what: "blocked_days: insert дозволено будь-кому з входом, а не лише адміністратору",
//     find: "on public.blocked_days for insert to authenticated\n  with check ((select private.current_app_role()) = 'admin');",
//     replace: "on public.blocked_days for insert to authenticated\n  with check (true);" },
//
// Еквівалентний мутант — лише з reason, що посилається на рядок, який робить його зайвим:
//   { id: "L6", kind: "sql", ac: "AC-LEAVE-06/07", file: RECORDS, tests: [LEAVE_DB],
//     what: "політика рішень: прибрано role = 'manager'", expect: "survive",
//     reason: "еквівалентний: з 20261018000000_manager_helpers_require_role.sql private.is_division_manager() сама " +
//       "перевіряє current_app_role() = 'manager'", find: "…", replace: "…" },
//
// TS, точковий мутант на межі з AC (повний перебір TS — npm run mutation:ts, Stryker):
//   { id: "T1", kind: "ts", ac: "AC-LEAVE-11", file: "src/lib/leave/calendar.ts", tests: ["tests/leave/calendar.test.ts"],
//     what: "rangesOverlap: <= → <", find: "b.startDate <= a.endDate", replace: "b.startDate < a.endDate" },
