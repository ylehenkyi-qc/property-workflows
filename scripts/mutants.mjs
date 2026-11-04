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
// Мутанти на правила за AC-EDITOR-07 (менеджер за прямим посиланням на список версій бачить «Not enough rights» і
// жодної версії; гість не читає нічого). Правило живе в базі: політика template_versions_select_admin і grant на
// template_versions, а на сторінці — перевірка ролі admin. Умову послаблено, а не видалено політику: без політики RLS
// забороняє все, і тест відмови лишився б зеленим з неправильної причини.
const TEMPLATE_VERSIONS_SQL = "supabase/migrations/20261027130053_template_versions.sql";
const TEMPLATE_VERSIONS_DB = "tests/db/template-versions.test.ts";
const VERSIONS_PAGE = "src/app/templates/[id]/versions/page.tsx";
const TEMPLATES_PAGES_TEST = "src/app/templates/templates-pages.test.tsx";
const RUNS_PAGE = "src/app/runs/page.tsx";
const RUNS_PAGE_TEST = "src/app/runs/design-system.test.tsx";

export const mutants = [
  {
    id: "W1", kind: "sql", ac: "AC-EDITOR-07", file: TEMPLATE_VERSIONS_SQL, tests: [TEMPLATE_VERSIONS_DB],
    what: "template_versions_select_admin: умову ролі прибрано, список версій читає будь-хто з входом",
    find: "on public.template_versions for select to authenticated\n  using ((select auth.uid()) is not null and (select private.current_app_role()) = 'admin');",
    replace: "on public.template_versions for select to authenticated\n  using ((select auth.uid()) is not null);",
  },
  {
    id: "W2", kind: "sql", ac: "AC-EDITOR-07", file: TEMPLATE_VERSIONS_SQL, tests: [TEMPLATE_VERSIONS_DB],
    what: "template_versions_select_admin: замість admin дозволено менеджера",
    find: "on public.template_versions for select to authenticated\n  using ((select auth.uid()) is not null and (select private.current_app_role()) = 'admin');",
    replace: "on public.template_versions for select to authenticated\n  using ((select auth.uid()) is not null and (select private.current_app_role()) = 'manager');",
  },
  {
    id: "W3", kind: "sql", ac: "AC-EDITOR-07", file: TEMPLATE_VERSIONS_SQL, tests: [TEMPLATE_VERSIONS_DB],
    what: "grant select на template_versions видано й гостю (anon)",
    find: "grant select on table public.template_versions to authenticated;",
    replace: "grant select on table public.template_versions to authenticated, anon;",
  },
  {
    id: "W4", kind: "ts", ac: "AC-EDITOR-07", file: VERSIONS_PAGE, tests: [TEMPLATES_PAGES_TEST],
    what: "сторінка списку версій пускає й менеджера (requireRole(\"admin\") → requireRole([\"manager\", \"admin\"]))",
    find: "const auth = await requireRole(\"admin\");",
    replace: "const auth = await requireRole([\"manager\", \"admin\"]);",
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

// Мутанти групи 1 зрізу 3 (impl-vendor-access): роль vendor і призначення вендора під час запуску. Правила живуть у
// міграції vendor_role: launch_run (хто запускає, кого можна призначити) і list_assignable_users (хто що бачить).
const VENDOR_ROLE_SQL = "supabase/migrations/20261104140910_vendor_role.sql";
const VENDOR_ACCESS_DB = "tests/db/vendor-access.test.ts";

mutants.push(
  {
    id: "V1", kind: "sql", ac: "AC-VENDOR-09", file: VENDOR_ROLE_SQL, tests: [VENDOR_ACCESS_DB],
    what: "launch_run: перевірку ролі послаблено до «роль не порожня», вендор запускає шаблон",
    find: "if v_uid is null or coalesce(private.current_app_role(), '') not in ('manager', 'admin') then",
    replace: "if v_uid is null or private.current_app_role() is null then",
  },
  {
    id: "V2", kind: "sql", ac: "AC-VENDOR-01", file: VENDOR_ROLE_SQL, tests: [VENDOR_ACCESS_DB],
    what: "launch_run: вендора прибрано з дозволених виконавців",
    find: "where p.id = v_assignee and p.role in ('manager', 'admin', 'vendor')",
    replace: "where p.id = v_assignee and p.role in ('manager', 'admin')",
  },
  {
    id: "V3", kind: "sql", ac: "AC-VENDOR-02", file: VENDOR_ROLE_SQL, tests: [VENDOR_ACCESS_DB],
    what: "list_assignable_users: вендора прибрано зі списку виконавців (менеджер не бачить email вендора)",
    find: "where p.role in ('manager', 'admin', 'vendor')\n    and coalesce(",
    replace: "where p.role in ('manager', 'admin')\n    and coalesce(",
  },
  {
    id: "V4", kind: "sql", ac: "матриця прав: вендор не бачить email інших (поруч з AC-VENDOR-02)", file: VENDOR_ROLE_SQL, tests: [VENDOR_ACCESS_DB],
    what: "list_assignable_users: обмеження викликача manager/admin прибрано, вендор отримує email усіх",
    find: "\n    and coalesce(private.current_app_role(), '') in ('manager', 'admin')",
    replace: "",
  },
);

// Мутанти групи 2 зрізу 3: читання вендором (міграція vendor_reads). Умови послаблено, а не видалено політику: без політики
// RLS забороняє все, і тест відмови лишився б зеленим з неправильної причини.
const VENDOR_READS_SQL = "supabase/migrations/20261104142000_vendor_reads.sql";

mutants.push(
  {
    id: "V5", kind: "sql", ac: "AC-VENDOR-04", file: VENDOR_READS_SQL, tests: [VENDOR_ACCESS_DB],
    what: "can_see_run: вендор проходить як менеджер (бачить усі задачі запуску й рядок runs)",
    find: "coalesce(private.current_app_role(), '') = 'manager'\n      and (",
    replace: "coalesce(private.current_app_role(), '') in ('manager', 'vendor')\n      and (",
  },
  {
    id: "V6", kind: "sql", ac: "AC-VENDOR-04", file: VENDOR_READS_SQL, tests: [VENDOR_ACCESS_DB],
    what: "run_tasks: умову assignee_id прибрано, вендор читає задачі всіх запусків",
    find: "or (assignee_id = (select auth.uid()) and (select private.current_app_role()) = 'vendor')",
    replace: "or ((select private.current_app_role()) = 'vendor')",
  },
  {
    id: "V7", kind: "sql", ac: "AC-VENDOR-04", file: VENDOR_READS_SQL, tests: [VENDOR_ACCESS_DB],
    what: "run_sections: вендор бачить усі секції, а не лише ті, де є його задача",
    find: "or private.vendor_has_task_in_section(id)",
    replace: "or (select private.current_app_role()) = 'vendor'",
  },
  {
    id: "V8", kind: "sql", ac: "AC-VENDOR-03", file: VENDOR_READS_SQL, tests: [VENDOR_ACCESS_DB],
    what: "list_vendor_runs: фільтр за виконавцем прибрано, вендор бачить усі запуски",
    find: "join public.run_tasks as t on t.run_id = r.id and t.assignee_id = (select auth.uid())",
    replace: "join public.run_tasks as t on t.run_id = r.id",
  },
  {
    id: "V9", kind: "sql", ac: "AC-VENDOR-10", file: VENDOR_READS_SQL, tests: [VENDOR_ACCESS_DB],
    what: "list_vendor_runs: join замінено на left join, вендор без задач бачить усі запуски з нульовими лічильниками",
    find: "join public.run_tasks as t on t.run_id = r.id and t.assignee_id = (select auth.uid())",
    replace: "left join public.run_tasks as t on t.run_id = r.id and t.assignee_id = (select auth.uid())",
  },
  {
    id: "V10", kind: "sql", ac: "AC-VENDOR-08", file: VENDOR_READS_SQL, tests: [VENDOR_ACCESS_DB],
    what: "templates: перевірку ролі послаблено до «роль не порожня», вендор читає шаблони",
    find: "and (select private.current_app_role()) in ('manager', 'admin')\n    and ((select",
    replace: "and (select private.current_app_role()) is not null\n    and ((select",
  },
  {
    id: "V11", kind: "sql", ac: "AC-VENDOR-08", file: VENDOR_READS_SQL, tests: [VENDOR_ACCESS_DB],
    what: "can_read_template_version: вендор читає знімок поточної версії",
    find: "coalesce(private.current_app_role(), '') in ('manager', 'admin')\n    and (",
    replace: "private.current_app_role() is not null\n    and (",
  },
);

// TS-мутанти сторінок вендора (група 2): що показує сторінка з даних, які віддала база.
const VENDOR_PAGES_TEST = "src/app/runs/vendor-pages.test.tsx";

mutants.push(
  {
    id: "V12", kind: "ts", ac: "AC-VENDOR-10", file: "src/app/runs/vendor-runs.tsx", tests: [VENDOR_PAGES_TEST],
    what: "порожній список вендора показує порожню таблицю замість повідомлення",
    find: "{runs.length === 0 ? (",
    replace: "{runs.length < 0 ? (",
  },
  {
    id: "V13", kind: "ts", ac: "AC-VENDOR-06", file: "src/app/runs/[id]/page.tsx", tests: [VENDOR_PAGES_TEST],
    what: "запуск без задач вендора не дає «Run not found»: перевірку наявності запуску прибрано",
    find: "if (!vendorRun) notFound();",
    replace: "",
  },
  {
    id: "V14", kind: "ts", ac: "AC-VENDOR-03", file: "src/app/runs/vendor-runs.tsx", tests: [VENDOR_PAGES_TEST],
    what: "«Your tasks: N of K done» показує K замість N (виконані рахуються як усі)",
    find: "formatVendorProgress(run.tasks_done, run.tasks_total)",
    replace: "formatVendorProgress(run.tasks_total, run.tasks_total)",
  },
  {
    id: "V15", kind: "ts", ac: "AC-VENDOR-04", file: "src/app/runs/[id]/vendor-run.tsx", tests: [VENDOR_PAGES_TEST],
    what: "позначка «required»/«optional» завжди «required»",
    find: '{task.required ? "required" : "optional"}',
    replace: '{"required"}',
  },
);

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
