# Матриця відповідності (AC → код → тест → статус)

<!--
Ваша матриця: один рядок на кожен AC з openspec/specs/** — вашої специфікації, у яку ви перекладаєте вимоги PM
(їхній знімок у requirements/ приносить команда агента /requirements-sync).
Рядок «Вимоги» під цим коментарем заповнює лише /requirements-sync: адреса репо вимог PM, звідки взято вимоги (issues
або файли docs/), і дата знімка, через « · ». Руками його не змінюйте: з нього /requirements-sync знає, звідки брати
вимоги наступного разу, а скіли spec-clarify, spec-review і /conformance — куди ставити питання й яку версію вимог ви
реалізуєте. Рядків таблиці /requirements-sync не додає.
Рядки змінюєте ви:
  PR «Специфікація» — після archive зміни: рядок кожного нового AC зі статусом «відкладено (чекає реалізації)»; рядки AC,
                      прибраних зі специфікації (REMOVED), — видалити;
  PR «Реалізація»   — рядок AC задачі в тому самому PR, що й код і тест.
Перебудувати автоматично: /conformance (Claude Code, Cursor).
Перевірка в CI: npm run ac:coverage — падає, якщо
  NO-ROW     AC є в специфікації, а рядка немає (типово — PR «Специфікація» без нових рядків або рядок видалено);
  MISSING    статус «реалізовано», а непропущеного тесту, назва якого починається з цього AC ID, у файлах
             *.test.ts / *.test.tsx немає (*.spec.ts і допоміжні файли Vitest не запускає — вони не рахуються);
  ORPHAN     тест посилається на AC, якого немає в специфікації (AC прибрано або вимогу PM ще не перекладено);
  BAD-STATUS статус не «реалізовано» і не «відкладено (причина)»;
  WRONG-REF  шляху `src/…`/`tests/…`/`supabase/…` з колонок «Код»/«Тест» немає або тест із цим AC в іншому файлі;
і попереджає, не падаючи: AC з вимог PM (requirements/), якого ще немає в openspec/specs/, — «вимогу PM ще не перекладено
в специфікацію».

Приклад рядків (усередині коментаря — скрипт їх не читає):
| AC-LEAVE-02 | заявка на дві посади дає два записи main і additional | `src/app/requests/actions.ts` (createRequest) | `tests/requests.test.ts` | реалізовано |
| AC-LEAVE-04 | заблоковані дні не рахуються | — | — | відкладено (чекаю відповідь PM на Q2, <pm>/<team-slug>-spec#5) |
| AC-LEAVE-07 | менеджер бачить лише свій відділ | — | — | відкладено (рішення PM: поза зрізом 1, <pm>/<team-slug>-spec#8) |
| AC-LEAVE-10 | діапазон лише із заблокованих днів | — | — | відкладено (чекає реалізації) |
-->

Вимоги: https://github.com/solomchaak/property-workflows-spec · джерело: issues · знімок 2026-10-26

| AC | Що перевіряє | Код | Тест | Статус |
|---|---|---|---|---|
| AC-RUN-01 | запуск шаблону створює один запуск «in progress» з усіма 5 задачами «to do» | `supabase/migrations/20261020091927_launch_run_functions.sql` (launch_run), `supabase/migrations/20261020091923_run_schema_and_seed.sql`, `src/app/runs/new/page.tsx` (форма) | — | відкладено (DB-тести не запускаються в CI) |
| AC-RUN-02 | зміна шаблону не змінює вже створений запуск | `supabase/migrations/20261020091927_launch_run_functions.sql` (launch_run), `supabase/migrations/20261020091923_run_schema_and_seed.sql` | — | відкладено (DB-тести не запускаються в CI) |
| AC-RUN-03 | порожня назва випадку або лише пробіли відхиляється з повідомленням «Enter a case name» | `src/lib/runs/validateCaseName.ts`, `src/app/runs/new/actions.ts` (launchRun), `supabase/migrations/20261020091927_launch_run_functions.sql` (launch_run) | `src/lib/runs/validateCaseName.test.ts`, `src/app/runs/new/actions.test.ts` | реалізовано |
| AC-RUN-04 | менеджер призначає іншого виконавцем двох задач, решта — запускач | `supabase/migrations/20261020091927_launch_run_functions.sql` (launch_run), `src/app/runs/new/page.tsx` (форма) | — | відкладено (DB-тести не запускаються в CI) |
| AC-RUN-05 | адміністратор запускає шаблон і стає менеджером запуску | `supabase/migrations/20261020091927_launch_run_functions.sql` (launch_run) | — | відкладено (DB-тести не запускаються в CI) |
| AC-RUN-06 | менеджер, що запустив шаблон, стає менеджером запуску | `supabase/migrations/20261020091927_launch_run_functions.sql` (launch_run) | — | відкладено (DB-тести не запускаються в CI) |
| AC-RUN-07 | назва випадку у 101 символ відхиляється з повідомленням «Case name must be at most 100 characters» | `src/lib/runs/validateCaseName.ts`, `src/app/runs/new/actions.ts` (launchRun), `supabase/migrations/20261020091927_launch_run_functions.sql` (launch_run) | `src/lib/runs/validateCaseName.test.ts`, `src/app/runs/new/actions.test.ts` | реалізовано |
| AC-RUN-08 | без призначення виконавців менеджер — виконавець усіх 5 задач | `supabase/migrations/20261020091927_launch_run_functions.sql` (launch_run) | — | відкладено (DB-тести не запускаються в CI) |
| AC-RUN-09 | без призначення виконавців адміністратор — виконавець усіх 5 задач | `supabase/migrations/20261020091927_launch_run_functions.sql` (launch_run) | — | відкладено (DB-тести не запускаються в CI) |
| AC-TASK-01 | виконавець позначає свою задачу «done» | `supabase/migrations/20261020142036_mark_task_done.sql` (mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone) | — | відкладено (DB-тести не запускаються в CI) |
| AC-TASK-02 | менеджер запуску позначає задачу виконавця «done» | `supabase/migrations/20261020142036_mark_task_done.sql` (mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone) | — | відкладено (DB-тести не запускаються в CI) |
| AC-TASK-03 | сторонній менеджер не може позначити задачу, бачить повідомлення з відмовою | `supabase/migrations/20261020142036_mark_task_done.sql` (mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone) | — | відкладено (DB-тести не запускаються в CI) |
| AC-TASK-04 | виконання третьої обов'язкової задачі дає запуску статус «completed» | `supabase/migrations/20261020142036_mark_task_done.sql` (mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone) | — | відкладено (DB-тести не запускаються в CI) |
| AC-TASK-05 | сторінка запуску показує прогрес «2 of 5 done» | `src/lib/runs/progress.ts`, `src/app/runs/[id]/page.tsx` | `src/lib/runs/progress.test.ts` | реалізовано |
| AC-TASK-06 | менеджер бачить у списку лише запуски, де він менеджер запуску або виконавець | `supabase/migrations/20261020091923_run_schema_and_seed.sql`, `src/app/runs/page.tsx` | — | відкладено (DB-тести не запускаються в CI) |
| AC-TASK-07 | адміністратор позначає задачу чужого запуску «done» | `supabase/migrations/20261020142036_mark_task_done.sql` (mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone) | — | відкладено (DB-тести не запускаються в CI) |
| AC-TASK-08 | сторінка запуску показує статус кожної з 5 задач | `src/lib/runs/groupTasksBySection.ts`, `src/lib/runs/labels.ts`, `src/app/runs/[id]/page.tsx` | `src/lib/runs/groupTasksBySection.test.ts` | реалізовано |
| AC-TASK-09 | список запусків показує прогрес «2 of 5 done» | `src/lib/runs/runList.ts`, `src/app/runs/page.tsx` | `src/lib/runs/runList.test.ts` | реалізовано |
