-- Читання вендором лише своїх запусків і задач; шаблони для вендора закриті (design.md зміни impl-vendor-access, задача 2).
-- Вендор не бачить рядків runs (там template_version, template_id, manager_id), чужих задач, секцій без своїх задач,
-- шаблонів, версій і чернеток; заголовок запуску (назва, статус, лічильники) віддає вузька функція list_vendor_runs.
-- Рядки run_tasks і run_sections вендор читає звичайними таблицями під RLS, звуженою до власних задач: пряме читання
-- повертає рівно його задачі, а не «нічого» (рішення до solomchaak/property-workflows-spec#50, варіант A).
-- Ризик: заміна політик select на run_sections, run_tasks, templates і двох функцій (create or replace); дані не
-- змінюються, деструктивних операцій немає; менеджер і адміністратор читають, як і раніше (тести бази зрізів 1–2).
-- Користувачів з роллю vendor у базі не створюємо, доки не злито міграції задач 1–3 і сторінки задачі 4.
-- AC: AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-06, AC-VENDOR-08, AC-VENDOR-10.

-- ── Видимість запуску: лише admin і manager (вендор читає запуски через list_vendor_runs) ───────────
-- Було: admin, менеджер запуску або виконавець хоча б однієї задачі — для вендора це дало б усі задачі й службові
-- колонки runs. Тепер виконавцем-вендором політики runs не користуються: can_see_run(vendor) = false.
create or replace function private.can_see_run(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(private.current_app_role(), '') = 'admin'
    or (
      coalesce(private.current_app_role(), '') = 'manager'
      and (
        exists (
          select 1 from public.runs as r
          where r.id = p_run_id and r.manager_id = (select auth.uid())
        )
        or exists (
          select 1 from public.run_tasks as t
          where t.run_id = p_run_id and t.assignee_id = (select auth.uid())
        )
      )
    );
$$;

-- ── Секція видна вендору, лише якщо в ній є його задача (назви секцій чужих задач не розкриваються) ──
create or replace function private.vendor_has_task_in_section(p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(private.current_app_role(), '') = 'vendor'
    and exists (
      select 1 from public.run_tasks as t
      where t.section_id = p_section_id and t.assignee_id = (select auth.uid())
    );
$$;

revoke execute on function private.vendor_has_task_in_section(uuid) from public, anon;
grant execute on function private.vendor_has_task_in_section(uuid) to authenticated;

-- ── Політики select на секції й задачі запусків: як раніше + власні задачі вендора ────────────────
-- Запису для authenticated, як і раніше, немає (лише select).
drop policy run_sections_select_visible on public.run_sections;
create policy run_sections_select_visible
  on public.run_sections for select to authenticated
  using (
    (select auth.uid()) is not null
    and (private.can_see_run(run_id) or private.vendor_has_task_in_section(id))
  );

drop policy run_tasks_select_visible on public.run_tasks;
create policy run_tasks_select_visible
  on public.run_tasks for select to authenticated
  using (
    (select auth.uid()) is not null
    and (
      private.can_see_run(run_id)
      or (assignee_id = (select auth.uid()) and (select private.current_app_role()) = 'vendor')
    )
  );

-- ── Шаблони: лише manager і admin (AC-VENDOR-08) ────────────────────────────────────────────────
drop policy templates_select_visible on public.templates;
create policy templates_select_visible
  on public.templates for select to authenticated
  using (
    (select auth.uid()) is not null
    and (select private.current_app_role()) in ('manager', 'admin')
    and ((select private.current_app_role()) = 'admin' or current_version is not null)
  );

-- Знімок версії: admin усі, manager лише поточну (як у 20261027130053_template_versions.sql); решта ролей, зокрема vendor, — нічого.
create or replace function private.can_read_template_version(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(private.current_app_role(), '') in ('manager', 'admin')
    and (
      private.current_app_role() = 'admin'
      or exists (
        select 1
        from public.template_versions as v
        join public.templates as t on t.id = v.template_id and t.current_version = v.version
        where v.id = p_version_id
      )
    );
$$;

-- ── Заголовок запуску для вендора (AC-VENDOR-03, 04, 06, 10) ──────────────────────────────────────
-- Лише запуски, де викликач-вендор має задачу; лічильники — тільки по його задачах («Your tasks: N of K done»);
-- p_run_id звужує до одного запуску (сторінка запуску). Для інших ролей — порожній результат: вони читають runs
-- напряму. Новіші запуски першими. Публічна обгортка — security invoker; реалізація — security definer у private.
create or replace function private.list_vendor_runs(p_run_id uuid default null)
returns table (id uuid, case_name text, status text, tasks_total bigint, tasks_done bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.case_name,
    r.status,
    count(t.id) as tasks_total,
    count(t.id) filter (where t.status = 'done') as tasks_done
  from public.runs as r
  join public.run_tasks as t on t.run_id = r.id and t.assignee_id = (select auth.uid())
  where coalesce(private.current_app_role(), '') = 'vendor'
    and (p_run_id is null or r.id = p_run_id)
  group by r.id, r.case_name, r.status, r.created_at
  order by r.created_at desc, r.id;
$$;

create or replace function public.list_vendor_runs(p_run_id uuid default null)
returns table (id uuid, case_name text, status text, tasks_total bigint, tasks_done bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select u.id, u.case_name, u.status, u.tasks_total, u.tasks_done
  from private.list_vendor_runs(p_run_id) with ordinality as u (id, case_name, status, tasks_total, tasks_done, ord)
  order by u.ord;
$$;

revoke execute on function private.list_vendor_runs(uuid) from public, anon;
grant execute on function private.list_vendor_runs(uuid) to authenticated;
revoke execute on function public.list_vendor_runs(uuid) from public, anon;
grant execute on function public.list_vendor_runs(uuid) to authenticated;
