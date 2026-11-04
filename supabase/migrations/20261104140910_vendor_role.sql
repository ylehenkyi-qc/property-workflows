-- Роль vendor і призначення вендора виконавцем під час запуску (design.md зміни impl-vendor-access, задача 1).
-- Порядок зміни набору ролей — із заголовка 20261012000000_profiles_and_roles.sql: зняти старий profiles_role_check →
-- дані (ніхто не стає вендором міграцією, оновлювати нічого) → default колонки role (лишається 'manager': тригер
-- on_auth_user_created і npm run users:demo вставляють профіль із default, роль vendor ставить лише service_role після
-- створення) → новий profiles_role_check.
-- Ризик: заміна check на profiles і двох функцій (create or replace); дані й політики не змінюються, деструктивних
-- операцій немає. Колонковий grant update (full_name) лишається: вендор не змінить собі роль.
-- Користувачів з роллю vendor у базі не створюємо, доки не злито міграції читання (vendor_reads) і позначення.
-- AC: AC-VENDOR-01, AC-VENDOR-02, AC-VENDOR-09.

alter table public.profiles drop constraint profiles_role_check;

alter table public.profiles alter column role set default 'manager';

alter table public.profiles
  add constraint profiles_role_check check (role in ('manager', 'admin', 'vendor'));

-- ── Вибір виконавця: id і email manager/admin/vendor — лише для викликача manager/admin ───────────
-- AC-VENDOR-02: менеджер бачить email менеджерів, адміністраторів і вендорів, без ролі й іншого профілю.
-- Вендор не бачить email нікого (матриця прав): для нього результат порожній.
create or replace function private.list_assignable_users()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email
  from public.profiles as p
  where p.role in ('manager', 'admin', 'vendor')
    and coalesce(private.current_app_role(), '') in ('manager', 'admin')
  order by p.email;
$$;

-- ── Запуск зі знімка поточної версії ────────────────────────────────────────────────────────
-- Сигнатура й публічна обгортка без змін; тіло — з 20261027130053_template_versions.sql. Дві зміни:
-- AC-VENDOR-09: запуск створює лише manager або admin, вендор — ні (виняток до будь-якого запису);
-- AC-VENDOR-01: виконавцем призначення може бути й vendor.
create or replace function private.launch_run(
  p_template_id uuid,
  p_case_name text,
  p_assignments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := (select auth.uid());
  v_name        text;
  v_assignments jsonb := coalesce(p_assignments, '[]'::jsonb);
  v_assign      jsonb := '{}'::jsonb;  -- id задачі знімка → assignee_id
  v_elem        jsonb;
  v_tt_id       uuid;
  v_assignee    uuid;
  v_run_id      uuid;
  v_version     integer;
  v_version_id  uuid;
  v_section     record;
  v_task        record;
  v_new_section uuid;
begin
  -- AC-VENDOR-09: лише manager і admin запускають шаблони; роль — з profiles.role.
  if v_uid is null or coalesce(private.current_app_role(), '') not in ('manager', 'admin') then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- AC-RUN-03, AC-RUN-07, AC-RUN-11: назва обрізається, порожня й задовга відхиляються.
  v_name := btrim(coalesce(p_case_name, ''));
  if v_name = '' then
    raise exception 'Enter a case name' using errcode = '22023';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'Case name must be at most 100 characters' using errcode = '22023';
  end if;

  select t.current_version into v_version from public.templates as t where t.id = p_template_id;
  if not found then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;
  if v_version is null then
    raise exception 'Template has no saved version' using errcode = 'P0002';
  end if;
  select v.id into v_version_id
  from public.template_versions as v where v.template_id = p_template_id and v.version = v_version;

  if jsonb_typeof(v_assignments) <> 'array' then
    raise exception 'Invalid assignments' using errcode = '22023';
  end if;

  for v_elem in select e.value from jsonb_array_elements(v_assignments) as e loop
    v_tt_id := (v_elem ->> 'template_task_id')::uuid;
    v_assignee := (v_elem ->> 'assignee_id')::uuid;

    if v_tt_id is null or v_assignee is null then
      raise exception 'Invalid assignment' using errcode = '22023';
    end if;
    if (v_assign ->> (v_tt_id::text)) is not null then
      raise exception 'Duplicate template_task_id in assignments' using errcode = '22023';
    end if;
    -- задача належить знімку поточної версії цього шаблону
    if not exists (
      select 1 from public.template_version_tasks as tt
      where tt.id = v_tt_id and tt.version_id = v_version_id
    ) then
      raise exception 'Task does not belong to the template' using errcode = '22023';
    end if;
    -- AC-VENDOR-01: виконавець — manager, admin або vendor
    if not exists (
      select 1 from public.profiles as p
      where p.id = v_assignee and p.role in ('manager', 'admin', 'vendor')
    ) then
      raise exception 'Assignee must be a manager, an administrator or a vendor' using errcode = '22023';
    end if;

    v_assign := v_assign || jsonb_build_object(v_tt_id::text, v_assignee::text);
  end loop;

  -- AC-RUN-01, AC-RUN-05, AC-RUN-06, AC-EDITOR-06: запуск «in progress» з версією шаблону.
  insert into public.runs (template_id, template_version, case_name, manager_id)
  values (p_template_id, v_version, v_name, v_uid)
  returning id into v_run_id;

  -- AC-RUN-01, AC-RUN-02, AC-RUN-12: копія секцій і задач знімка; усі задачі «to_do».
  -- AC-VENDOR-01, AC-RUN-04, AC-RUN-08, AC-RUN-09: виконавець — з призначення, інакше менеджер запуску.
  for v_section in
    select s.id, s.name, s.position
    from public.template_version_sections as s
    where s.version_id = v_version_id
    order by s.position
  loop
    insert into public.run_sections (run_id, name, position)
    values (v_run_id, v_section.name, v_section.position)
    returning id into v_new_section;

    for v_task in
      select t.id, t.name, t.required, t.position
      from public.template_version_tasks as t
      where t.section_id = v_section.id
      order by t.position
    loop
      insert into public.run_tasks (run_id, section_id, name, required, position, assignee_id)
      values (
        v_run_id, v_new_section, v_task.name, v_task.required, v_task.position,
        coalesce((v_assign ->> (v_task.id::text))::uuid, v_uid)
      );
    end loop;
  end loop;

  return v_run_id;
end;
$$;
