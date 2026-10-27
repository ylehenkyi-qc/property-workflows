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

Вимоги: https://github.com/solomchaak/property-workflows-spec · джерело: issues · знімок 2026-10-27

| AC | Що перевіряє | Код | Тест | Статус |
|---|---|---|---|---|
| AC-RUN-01 | запуск шаблону створює один запуск «in progress» з усіма 5 задачами «to do» | `supabase/migrations/20261027130053_template_versions.sql` (launch_run), `supabase/migrations/20261020091923_run_schema_and_seed.sql`, `src/app/runs/new/page.tsx` (форма) | `tests/db/template-versions.test.ts` | реалізовано |
| AC-RUN-02 | зміна шаблону не змінює вже створений запуск | `supabase/migrations/20261027130053_template_versions.sql` (launch_run), `supabase/migrations/20261020091923_run_schema_and_seed.sql` | `tests/db/template-versions.test.ts` | реалізовано |
| AC-RUN-03 | порожня назва випадку або лише пробіли відхиляється з повідомленням «Enter a case name» | `src/lib/runs/validateCaseName.ts`, `src/app/runs/new/actions.ts` (launchRun), `supabase/migrations/20261020091927_launch_run_functions.sql` (launch_run) | `src/lib/runs/validateCaseName.test.ts`, `src/app/runs/new/actions.test.ts` | реалізовано |
| AC-RUN-04 | менеджер призначає іншого виконавцем двох задач, решта — запускач | `supabase/migrations/20261027130053_template_versions.sql` (launch_run), `src/app/runs/new/actions.ts` (launchRun) | `tests/db/template-versions.test.ts`, `src/app/runs/new/actions.test.ts` | реалізовано |
| AC-RUN-05 | адміністратор запускає шаблон і стає менеджером запуску | `supabase/migrations/20261027130053_template_versions.sql` (launch_run) | `tests/db/template-versions.test.ts` | реалізовано |
| AC-RUN-06 | менеджер, що запустив шаблон, стає менеджером запуску | `supabase/migrations/20261027130053_template_versions.sql` (launch_run) | `tests/db/template-versions.test.ts` | реалізовано |
| AC-RUN-07 | назва випадку у 101 символ відхиляється з повідомленням «Case name must be at most 100 characters» | `src/lib/runs/validateCaseName.ts`, `src/app/runs/new/actions.ts` (launchRun), `supabase/migrations/20261020091927_launch_run_functions.sql` (launch_run) | `src/lib/runs/validateCaseName.test.ts`, `src/app/runs/new/actions.test.ts` | реалізовано |
| AC-RUN-08 | без призначення виконавців менеджер — виконавець усіх 5 задач | `supabase/migrations/20261027130053_template_versions.sql` (launch_run), `src/app/runs/new/actions.ts` (launchRun) | `tests/db/template-versions.test.ts`, `src/app/runs/new/actions.test.ts` | реалізовано |
| AC-RUN-09 | без призначення виконавців адміністратор — виконавець усіх 5 задач | `supabase/migrations/20261027130053_template_versions.sql` (launch_run) | `tests/db/template-versions.test.ts` | реалізовано |
| AC-RUN-10 | у виборі виконавця менеджер бачить лише email інших користувачів, без імен і ролей | `supabase/migrations/20261020091927_launch_run_functions.sql` (list_assignable_users), `src/app/runs/new/page.tsx` | `tests/db/run-tracking.test.ts` | реалізовано |
| AC-RUN-11 | назва випадку зі 100 символів і пробілом на початку зберігається обрізаною | `supabase/migrations/20261027130053_template_versions.sql` (launch_run) | `tests/db/template-versions.test.ts` | реалізовано |
| AC-RUN-12 | зміна секцій шаблону не змінює секції створеного запуску | `supabase/migrations/20261027130053_template_versions.sql` (launch_run, template_version_*) | `tests/db/template-versions.test.ts` | реалізовано |
| AC-TASK-01 | виконавець позначає свою задачу «done» | `supabase/migrations/20261020142036_mark_task_done.sql` (mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone), `src/app/runs/[id]/mark-done-button.tsx`, `src/lib/runs/permissions.ts` | `tests/db/run-tracking.test.ts`, `src/app/runs/run-tracking-pages.test.tsx`, `src/lib/runs/permissions.test.ts` | реалізовано |
| AC-TASK-02 | менеджер запуску позначає задачу виконавця «done» | `supabase/migrations/20261020142036_mark_task_done.sql` (mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone), `src/lib/runs/permissions.ts` | `tests/db/run-tracking.test.ts`, `src/app/runs/run-tracking-pages.test.tsx` | реалізовано |
| AC-TASK-03 | сторонній менеджер не може позначити задачу, бачить повідомлення з відмовою | `supabase/migrations/20261020142036_mark_task_done.sql` (mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone) | `tests/db/run-tracking.test.ts`, `src/app/runs/[id]/actions.test.ts` | реалізовано |
| AC-TASK-04 | виконання третьої обов'язкової задачі дає запуску статус «completed» | `supabase/migrations/20261020142036_mark_task_done.sql` (mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone), `src/app/runs/[id]/mark-done-button.tsx`, `src/components/confirm-dialog.tsx`, `src/lib/runs/permissions.ts` | `tests/db/run-tracking.test.ts`, `src/app/runs/run-tracking-pages.test.tsx`, `src/lib/runs/permissions.test.ts` | реалізовано |
| AC-TASK-05 | сторінка запуску показує прогрес «2 of 5 done» | `src/lib/runs/progress.ts`, `src/app/runs/[id]/page.tsx` | `src/lib/runs/progress.test.ts` | реалізовано |
| AC-TASK-06 | менеджер бачить у списку лише запуски, де він менеджер запуску або виконавець | `supabase/migrations/20261020091923_run_schema_and_seed.sql` (RLS runs_select_visible), `src/app/runs/page.tsx` | `tests/db/run-tracking.test.ts` | реалізовано |
| AC-TASK-07 | адміністратор позначає задачу чужого запуску «done» | `supabase/migrations/20261020142036_mark_task_done.sql` (mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone), `src/lib/runs/permissions.ts` | `tests/db/run-tracking.test.ts`, `src/app/runs/run-tracking-pages.test.tsx` | реалізовано |
| AC-TASK-08 | сторінка запуску показує статус кожної з 5 задач | `src/lib/runs/groupTasksBySection.ts`, `src/lib/runs/labels.ts`, `src/app/runs/[id]/page.tsx` | `src/lib/runs/groupTasksBySection.test.ts` | реалізовано |
| AC-TASK-09 | список запусків показує прогрес «2 of 5 done» | `src/lib/runs/runList.ts`, `src/app/runs/page.tsx` | `src/lib/runs/runList.test.ts` | реалізовано |
| AC-TASK-10 | чужий запуск за прямим посиланням дає «Run not found» без задач | `src/app/runs/[id]/page.tsx`, `src/app/runs/[id]/not-found.tsx`, `supabase/migrations/20261020091923_run_schema_and_seed.sql` (RLS runs_select_visible) | `tests/db/run-tracking.test.ts`, `src/app/runs/run-tracking-pages.test.tsx` | реалізовано |
| AC-TASK-11 | біля кожної задачі показано email виконавця, без імен і ролей | `src/app/runs/[id]/page.tsx`, `src/lib/runs/labels.ts` | `src/app/runs/run-tracking-pages.test.tsx` | реалізовано |
| AC-TASK-12 | задачі запуску згруповано за секціями в порядку шаблону | `src/app/runs/[id]/page.tsx`, `src/lib/runs/groupTasksBySection.ts` | `src/app/runs/run-tracking-pages.test.tsx` | реалізовано |
| AC-TASK-13 | у списку є завершений («4 of 5 done») і поточний запуски зі статусом і прогресом | `src/app/runs/page.tsx`, `src/lib/runs/runList.ts` | `src/app/runs/run-tracking-pages.test.tsx` | реалізовано |
| AC-TASK-14 | список запусків від новіших, у рядку назва випадку й шаблону | `src/app/runs/page.tsx`, `src/lib/runs/runList.ts` | `src/app/runs/run-tracking-pages.test.tsx` | реалізовано |
| AC-TASK-15 | кожна задача позначена «required» або «optional» поруч зі статусом | `src/app/runs/[id]/page.tsx` | `src/app/runs/run-tracking-pages.test.tsx` | реалізовано |
| AC-TASK-16 | скасування підтвердження останньої обов'язкової задачі лишає задачу «to do» і запуск «in progress» | `src/app/runs/[id]/page.tsx`, `src/app/runs/[id]/mark-done-button.tsx`, `src/lib/runs/permissions.ts` | `src/app/runs/run-tracking-pages.test.tsx`, `src/lib/runs/permissions.test.ts` | реалізовано |
| AC-TASK-17 | виконавець бачить у списку запусків прогрес «2 of 5 done» чужого запуску | `supabase/migrations/20261020091923_run_schema_and_seed.sql` (RLS run_tasks_select_visible), `src/app/runs/page.tsx` | `tests/db/run-tracking.test.ts`, `src/app/runs/run-tracking-pages.test.tsx` | реалізовано |
| AC-TASK-18 | «позначити виконаною» пропонується лише на задачі, яку користувач може позначити | `src/app/runs/[id]/page.tsx`, `src/lib/runs/permissions.ts` | `src/lib/runs/permissions.test.ts`, `src/app/runs/run-tracking-pages.test.tsx` | реалізовано |
| AC-DSYS-01 | статуси «in progress» і «completed» однакові словом і кольором у списку й на сторінках запусків | `src/lib/ui/status.ts`, `src/components/status-badge.tsx`, `src/app/runs/page.tsx`, `src/app/runs/[id]/page.tsx`, `src/app/globals.css` | `src/app/runs/design-system.test.tsx` | реалізовано |
| AC-DSYS-02 | менеджер на редакторі за прямим посиланням бачить «Not enough rights» і «Back to templates» у загальному макеті | `src/app/templates/[id]/edit/page.tsx`, `src/lib/auth/require-role.ts`, `src/components/page-message.tsx` | `src/app/templates/templates-pages.test.tsx` | реалізовано |
| AC-DSYS-03 | відвідувач без входу на сторінці запуску бачить вхід у загальному макеті без даних | `src/app/runs/[id]/page.tsx`, `src/lib/auth/safe-next.ts`, `src/app/login/page.tsx` | `src/app/templates/templates-pages.test.tsx` | реалізовано |
| AC-DSYS-04 | порожній список запусків: «No runs yet. Launch a template to start one.» і посилання, без таблиці | `src/components/page-message.tsx`, `src/app/runs/page.tsx` | `src/app/runs/design-system.test.tsx` | реалізовано |
| AC-DSYS-05 | тема за замовчуванням «System» слідує за виглядом пристрою | — | — | відкладено (чекає реалізації) |
| AC-DSYS-06 | вибір «Light» чи «Dark» запам'ятовується на пристрої, зокрема на сторінці входу | — | — | відкладено (чекає реалізації) |
| AC-DSYS-07 | статуси в темній темі: ті самі слова й колір, контраст тексту до тла не менший за 4.5:1 | — | — | відкладено (чекає реалізації) |
| AC-DSYS-08 | після входу з прямого посилання користувач потрапляє на запитану сторінку | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-01 | зміни без збереження версії не втрачаються, на шаблоні «Unpublished changes» | `supabase/migrations/20261027130053_template_versions.sql` (save_template_draft, template_drafts), `src/app/templates/actions.ts`, `src/app/templates/[id]/edit/template-editor.tsx`, `src/app/templates/[id]/edit/page.tsx`, `src/lib/templates/draft.ts` | `tests/db/template-versions.test.ts`, `src/app/templates/actions.test.ts`, `src/app/templates/templates-pages.test.tsx`, `src/lib/templates/templates.test.ts` | реалізовано |
| AC-EDITOR-02 | менеджер бачить лише поточну збережену версію без непублікованих змін | `supabase/migrations/20261027130053_template_versions.sql` (RLS template_*, can_read_template_version) | `tests/db/template-versions.test.ts` | відкладено (змінено PM 2026-10-27, solomchaak/property-workflows-spec#25: перевірити тестом позначки «required»/«optional» біля задач на сторінці шаблону) |
| AC-EDITOR-03 | збереження шаблону створює версію 2, «Unpublished changes» зникає | `supabase/migrations/20261027130053_template_versions.sql` (publish_template) | `tests/db/template-versions.test.ts` | відкладено (змінено PM 2026-10-27, solomchaak/property-workflows-spec#38: повідомлення «Version N saved» на сторінці шаблону ще не покрите тестом) |
| AC-EDITOR-04 | шаблон без обов'язкової задачі не зберігається, повідомлення «A template needs at least one required task» | `supabase/migrations/20261027130053_template_versions.sql` (publish_template), `src/app/templates/actions.ts`, `src/lib/templates/messages.ts`, `src/app/templates/[id]/edit/template-editor.tsx` | `tests/db/template-versions.test.ts`, `src/app/templates/actions.test.ts`, `src/lib/templates/templates.test.ts` | реалізовано |
| AC-EDITOR-05 | список версій: новіші першими, дата й email автора | `supabase/migrations/20261027130053_template_versions.sql` (template_versions, created_by), `src/app/templates/[id]/versions/page.tsx`, `src/lib/templates/versions.ts`, `src/lib/templates/format-date.ts` | `src/lib/templates/templates.test.ts`, `src/app/templates/templates-pages.test.tsx` | реалізовано |
| AC-EDITOR-06 | запуск показує «Template version 1» і задачі версії, з якої створений | `supabase/migrations/20261027130053_template_versions.sql` (launch_run, runs.template_version), `src/app/runs/[id]/page.tsx` | `tests/db/template-versions.test.ts`, `src/app/templates/templates-pages.test.tsx` | реалізовано |
| AC-EDITOR-07 | менеджер на списку версій за прямим посиланням бачить «Not enough rights» без версій | `supabase/migrations/20261027130053_template_versions.sql` (RLS template_versions), `src/app/templates/[id]/versions/page.tsx` | `tests/db/template-versions.test.ts`, `src/app/templates/templates-pages.test.tsx` | реалізовано |
| AC-EDITOR-08 | менеджер не може змінити шаблон чи зберегти версію напряму | `supabase/migrations/20261027130053_template_versions.sql` (RLS, grants, функції з перевіркою ролі admin), `src/app/templates/actions.ts` (requireRole першим) | `tests/db/template-versions.test.ts`, `src/app/templates/actions.test.ts` | реалізовано |
| AC-EDITOR-09 | відвідувач без входу на редакторі бачить сторінку входу без вмісту шаблону | `src/app/templates/[id]/edit/page.tsx`, `src/lib/auth/require-role.ts`, `src/lib/auth/safe-next.ts`, `src/app/login/actions.ts` | `src/app/templates/templates-pages.test.tsx`, `tests/auth/safe-next.test.ts` | реалізовано |
| AC-EDITOR-10 | шаблон без збереженої версії недоступний у формі запуску з приміткою «Save the template to launch it» | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-11 | запуск шаблону без збереженої версії напряму не створює запуск | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-12 | збереження без непублікованих змін (в редакторі чи напряму) не створює версію | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-13 | скасування підтвердження видалення секції лишає секцію й її задачі | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-14 | підтверджене видалення секції прибирає її лише з непублікованих змін, поточна версія без змін | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-15 | секція без задач: «Every section needs at least one task», версії немає | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-16 | менеджер на сторінці ніколи не збереженого шаблону бачить «Template not found» | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-17 | порожній список шаблонів менеджера: «No templates yet. An administrator creates them.» | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-18 | порожній список версій: «No versions yet. Save the template to create version 1.» | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-19 | шаблон без назви не створюється: «Enter a template name» | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-20 | секція чи задача без назви: «Every section and task needs a name», версії немає | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-21 | перейменування шаблону зберігається з наступною версією, менеджер бачить нову назву | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-22 | запуск показує назву шаблону своєї версії, незалежно від пізніших перейменувань | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-23 | унікальність назви без урахування регістру й пробілів при створенні: «A template with this name already exists» | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-24 | те саме правило при збереженні перейменованого шаблону, версії немає | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-25 | зміну не збережено: «Your last change was not kept. Try again.» кольором помилки, зміна лишається на екрані | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-26 | гість напряму: запит відхилено, перенаправлення на вхід, шаблон без змін | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-27 | запуски до появи версій показують «Template version 1» | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-28 | задача, перенесена в іншу секцію, зберігається в новій версії в новій секції | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-29 | менеджер напряму не отримує старих версій, списку версій і непублікованих змін | — | — | відкладено (чекає реалізації) |
