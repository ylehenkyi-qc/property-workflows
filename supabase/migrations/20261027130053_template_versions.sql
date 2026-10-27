-- Версії шаблонів (design.md зміни impl-templates-editor, «Дані й RLS»).
-- Робоча копія (непубліковані зміни) лишається в template_sections / template_tasks і оновлюється автозбереженням
-- (save_template_draft); знімок у template_version_* створює лише збереження версії (publish_template) і він
-- незмінний. Менеджери й launch_run працюють лише зі знімком поточної версії.
-- Відхилення від design.md: прапорець «є непубліковані зміни» живе в окремій таблиці template_drafts (читає лише
-- admin), а не в templates, бо templates читає менеджер, і сам факт наявності чернетки йому бачити не можна.
-- AC: AC-EDITOR-01…09, AC-RUN-12, AC-DSYS-02, AC-DSYS-03.
-- Публічні обгортки — security invoker; реалізація — security definer у private з set search_path = ''; revoke execute
-- from public, anon; grant execute to authenticated на обгортку й реалізацію. Першим рядком кожної функції запису —
-- перевірка ролі admin.
-- Ризик (деструктивних операцій немає): бекфіл версії 1 для наявних шаблонів і запусків; заміна політик select на
-- template_sections / template_tasks (менеджер більше не читає робочу копію).

-- ── Таблиці ─────────────────────────────────────────────────────────────────────────────
create table public.template_versions (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  version     integer not null check (version > 0),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (template_id, version),
  unique (id, template_id),
  unique (id, template_id, version)
);

create table public.template_version_sections (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null,
  -- template_id і version дублюють шаблон і номер версії: менеджер читає лише поточну версію й знаходить її секції за
  -- (шаблон, поточна версія), не читаючи template_versions; складений ключ нижче не дає їм розійтись із version_id
  template_id uuid not null,
  version     integer not null,
  name        text not null,
  position    integer not null,
  unique (version_id, position),
  -- задача версії й її секція належать одній версії
  unique (id, version_id),
  foreign key (version_id, template_id, version)
    references public.template_versions (id, template_id, version) on delete cascade
);

create table public.template_version_tasks (
  id         uuid primary key default gen_random_uuid(),
  version_id uuid not null,
  section_id uuid not null,
  name       text not null,
  required   boolean not null,
  position   integer not null,
  unique (section_id, position),
  foreign key (section_id, version_id)
    references public.template_version_sections (id, version_id) on delete cascade
);

-- Чи є в шаблону непубліковані зміни: лише admin (менеджер не бачить навіть факту чернетки).
create table public.template_drafts (
  template_id             uuid primary key references public.templates (id) on delete cascade,
  has_unpublished_changes boolean not null default true,
  updated_at              timestamptz not null default now()
);

alter table public.templates add column current_version integer;
alter table public.runs add column template_version integer;

create index template_version_sections_version_id_idx on public.template_version_sections (version_id);
create index template_version_tasks_version_id_idx on public.template_version_tasks (version_id);

-- ── Бекфіл: версія 1 для кожного наявного шаблону (знімок його робочої копії) ───────────────
insert into public.template_versions (template_id, version)
select t.id, 1 from public.templates as t;

-- секції знімка беруть позицію робочої копії; відповідність секцій — за (шаблон, позиція)
insert into public.template_version_sections (version_id, template_id, version, name, position)
select v.id, v.template_id, v.version, s.name, s.position
from public.template_sections as s
join public.template_versions as v on v.template_id = s.template_id and v.version = 1;

insert into public.template_version_tasks (version_id, section_id, name, required, position)
select vs.version_id, vs.id, t.name, t.required, t.position
from public.template_tasks as t
join public.template_sections as s on s.id = t.section_id
join public.template_versions as v on v.template_id = s.template_id and v.version = 1
join public.template_version_sections as vs on vs.version_id = v.id and vs.position = s.position;

update public.templates set current_version = 1;
update public.runs set template_version = 1 where template_id is not null;
insert into public.template_drafts (template_id, has_unpublished_changes)
select t.id, false from public.templates as t;

-- Складені зовнішні ключі: current_version і runs.template_version не можуть вказувати на відсутню чи чужу версію
-- (при null у template_id / current_version перевірки немає).
alter table public.templates
  add constraint templates_current_version_fk
  foreign key (id, current_version) references public.template_versions (template_id, version);

alter table public.runs
  add constraint runs_template_version_fk
  foreign key (template_id, template_version) references public.template_versions (template_id, version);

-- ── RLS і права ─────────────────────────────────────────────────────────────────────────
alter table public.template_versions enable row level security;
alter table public.template_version_sections enable row level security;
alter table public.template_version_tasks enable row level security;
alter table public.template_drafts enable row level security;

revoke all on table public.template_versions from anon, authenticated;
revoke all on table public.template_version_sections from anon, authenticated;
revoke all on table public.template_version_tasks from anon, authenticated;
revoke all on table public.template_drafts from anon, authenticated;

-- authenticated лише читає (під політиками); запису напряму немає — лише функції нижче.
grant select on table public.template_versions to authenticated;
grant select on table public.template_version_sections to authenticated;
grant select on table public.template_version_tasks to authenticated;
grant select on table public.template_drafts to authenticated;

grant select, insert, update, delete on table public.template_versions to service_role;
grant select, insert, update, delete on table public.template_version_sections to service_role;
grant select, insert, update, delete on table public.template_version_tasks to service_role;
grant select, insert, update, delete on table public.template_drafts to service_role;

-- Хелпер: знімок читає admin або будь-хто, якщо це ПОТОЧНА версія свого шаблону (AC-EDITOR-02).
-- security definer читає templates і template_versions в обхід RLS: політики не посилаються одна на одну (42P17).
create or replace function private.can_read_template_version(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.current_app_role() is not null
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

revoke execute on function private.can_read_template_version(uuid) from public, anon;
grant execute on function private.can_read_template_version(uuid) to authenticated;

-- templates: менеджер бачить лише шаблони зі збереженою версією; admin — усі.
drop policy templates_select_authenticated on public.templates;
create policy templates_select_visible
  on public.templates for select to authenticated
  using (
    (select auth.uid()) is not null
    and (select private.current_app_role()) is not null
    and ((select private.current_app_role()) = 'admin' or current_version is not null)
  );

-- Робоча копія (непубліковані зміни) — лише admin.
drop policy template_sections_select_authenticated on public.template_sections;
create policy template_sections_select_admin
  on public.template_sections for select to authenticated
  using ((select auth.uid()) is not null and (select private.current_app_role()) = 'admin');

drop policy template_tasks_select_authenticated on public.template_tasks;
create policy template_tasks_select_admin
  on public.template_tasks for select to authenticated
  using ((select auth.uid()) is not null and (select private.current_app_role()) = 'admin');

-- Версії й чернетки — лише admin (менеджер не бачить список версій, AC-EDITOR-07).
create policy template_versions_select_admin
  on public.template_versions for select to authenticated
  using ((select auth.uid()) is not null and (select private.current_app_role()) = 'admin');

create policy template_drafts_select_admin
  on public.template_drafts for select to authenticated
  using ((select auth.uid()) is not null and (select private.current_app_role()) = 'admin');

-- Знімок: admin усі версії, решта — лише поточну.
create policy template_version_sections_select_readable
  on public.template_version_sections for select to authenticated
  using ((select auth.uid()) is not null and private.can_read_template_version(version_id));

create policy template_version_tasks_select_readable
  on public.template_version_tasks for select to authenticated
  using ((select auth.uid()) is not null and private.can_read_template_version(version_id));

-- ── Створення шаблону (AC-EDITOR-08: лише admin) ───────────────────────────────────────────
create or replace function private.create_template(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if (select auth.uid()) is null or private.current_app_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.templates (name) values (v_name) returning id into v_id;
  insert into public.template_drafts (template_id, has_unpublished_changes) values (v_id, true);
  return v_id;
end;
$$;

create or replace function public.create_template(p_name text)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_template(p_name);
$$;

-- ── Автозбереження робочої копії (AC-EDITOR-01, AC-EDITOR-08) ───────────────────────────────
-- p_content: [{"name": "…", "tasks": [{"name": "…", "required": true}, …]}, …]; порядок масивів = порядок секцій і задач.
-- Замінює робочу копію цілком в одній транзакції, версію не створює, ставить «є непубліковані зміни».
create or replace function private.save_template_draft(p_template_id uuid, p_content jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sec    record;
  v_task   record;
  v_sec_id uuid;
begin
  if (select auth.uid()) is null or private.current_app_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  perform 1 from public.templates as t where t.id = p_template_id for update;
  if not found then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'array' then
    raise exception 'Invalid content' using errcode = '22023';
  end if;

  -- template_tasks видаляються каскадом разом із секціями.
  delete from public.template_sections as s where s.template_id = p_template_id;

  for v_sec in
    select e.value as value, e.ordinality as ord
    from jsonb_array_elements(p_content) with ordinality as e(value, ordinality)
  loop
    insert into public.template_sections (template_id, name, position)
    values (p_template_id, coalesce(v_sec.value ->> 'name', ''), v_sec.ord)
    returning id into v_sec_id;

    for v_task in
      select e.value as value, e.ordinality as ord
      from jsonb_array_elements(coalesce(v_sec.value -> 'tasks', '[]'::jsonb)) with ordinality as e(value, ordinality)
    loop
      insert into public.template_tasks (template_id, section_id, name, required, position)
      values (
        p_template_id, v_sec_id,
        coalesce(v_task.value ->> 'name', ''),
        coalesce((v_task.value ->> 'required')::boolean, false),
        v_task.ord
      );
    end loop;
  end loop;

  insert into public.template_drafts (template_id, has_unpublished_changes, updated_at)
  values (p_template_id, true, now())
  on conflict (template_id) do update set has_unpublished_changes = true, updated_at = now();
end;
$$;

create or replace function public.save_template_draft(p_template_id uuid, p_content jsonb)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.save_template_draft(p_template_id, p_content);
$$;

-- ── Збереження версії (AC-EDITOR-03, AC-EDITOR-04, AC-EDITOR-08) ────────────────────────────
-- Без обов'язкової задачі — виняток із дослівним текстом, нічого не змінюється. Без непублікованих змін — нічого не
-- створює й повертає поточний номер. Секції знімка відповідають секціям робочої копії за позицією; section_id задач
-- знімка — НОВІ id секцій версії, а не id робочої копії.
create or replace function private.publish_template(p_template_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current integer;
  v_dirty   boolean;
  v_new     integer;
  v_version uuid;
begin
  if (select auth.uid()) is null or private.current_app_role() is distinct from 'admin' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select t.current_version into v_current from public.templates as t where t.id = p_template_id for update;
  if not found then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;

  select coalesce(d.has_unpublished_changes, true) into v_dirty
  from (select 1) as one
  left join public.template_drafts as d on d.template_id = p_template_id;

  -- AC-EDITOR-03 (рішення до solomchaak/property-workflows-spec#22): без змін нової версії немає.
  if not v_dirty and v_current is not null then
    return v_current;
  end if;

  -- AC-EDITOR-04: потрібна хоча б одна обов'язкова задача; інакше нічого не змінюємо.
  if not exists (
    select 1 from public.template_tasks as t where t.template_id = p_template_id and t.required
  ) then
    raise exception 'A template needs at least one required task' using errcode = '22023';
  end if;

  select coalesce(max(v.version), 0) + 1 into v_new
  from public.template_versions as v where v.template_id = p_template_id;

  insert into public.template_versions (template_id, version, created_by)
  values (p_template_id, v_new, (select auth.uid()))
  returning id into v_version;

  insert into public.template_version_sections (version_id, template_id, version, name, position)
  select v_version, p_template_id, v_new, s.name, s.position
  from public.template_sections as s where s.template_id = p_template_id;

  insert into public.template_version_tasks (version_id, section_id, name, required, position)
  select v_version, vs.id, t.name, t.required, t.position
  from public.template_tasks as t
  join public.template_sections as s on s.id = t.section_id
  join public.template_version_sections as vs on vs.version_id = v_version and vs.position = s.position
  where t.template_id = p_template_id;

  update public.templates set current_version = v_new where id = p_template_id;
  insert into public.template_drafts (template_id, has_unpublished_changes, updated_at)
  values (p_template_id, false, now())
  on conflict (template_id) do update set has_unpublished_changes = false, updated_at = now();

  return v_new;
end;
$$;

create or replace function public.publish_template(p_template_id uuid)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.publish_template(p_template_id);
$$;

revoke execute on function private.create_template(text) from public, anon;
grant execute on function private.create_template(text) to authenticated;
revoke execute on function public.create_template(text) from public, anon;
grant execute on function public.create_template(text) to authenticated;

revoke execute on function private.save_template_draft(uuid, jsonb) from public, anon;
grant execute on function private.save_template_draft(uuid, jsonb) to authenticated;
revoke execute on function public.save_template_draft(uuid, jsonb) from public, anon;
grant execute on function public.save_template_draft(uuid, jsonb) to authenticated;

revoke execute on function private.publish_template(uuid) from public, anon;
grant execute on function private.publish_template(uuid) to authenticated;
revoke execute on function public.publish_template(uuid) from public, anon;
grant execute on function public.publish_template(uuid) to authenticated;

-- ── Запуск зі знімка поточної версії (AC-EDITOR-06, AC-RUN-12; сигнатура без змін) ─────────────
-- p_assignments[].template_task_id тепер — id задачі ЗНІМКА поточної версії (template_version_tasks.id): форма запуску
-- читає знімок. Запуск ніколи не йде з непублікованих змін і з шаблону без збереженої версії (для всіх ролей).
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
  if v_uid is null or private.current_app_role() is null then
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
    if not exists (
      select 1 from public.profiles as p
      where p.id = v_assignee and p.role in ('manager', 'admin')
    ) then
      raise exception 'Assignee must be a manager or an administrator' using errcode = '22023';
    end if;

    v_assign := v_assign || jsonb_build_object(v_tt_id::text, v_assignee::text);
  end loop;

  -- AC-RUN-01, AC-RUN-05, AC-RUN-06, AC-EDITOR-06: запуск «in progress» з версією шаблону.
  insert into public.runs (template_id, template_version, case_name, manager_id)
  values (p_template_id, v_version, v_name, v_uid)
  returning id into v_run_id;

  -- AC-RUN-01, AC-RUN-02, AC-RUN-12: копія секцій і задач знімка; усі задачі «to_do».
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
