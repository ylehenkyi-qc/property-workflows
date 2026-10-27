-- Валідація шаблонів за відповідями PM 2026-10-27 (solomchaak/property-workflows-spec#24, #28, #30) і виправлення початкових
-- даних «Tenant move-in» до прикладів PM.
-- AC: AC-EDITOR-15 (секція без задач), AC-EDITOR-19 (шаблон без назви), AC-EDITOR-20 (секція чи задача без назви),
--     AC-EDITOR-23 (унікальність назви шаблону без урахування регістру й пробілів при створенні).
-- Функції замінюємо `create or replace` із тією самою сигнатурою; права (revoke/grant) не змінюються.
-- Кожна відмова — виняток до будь-яких змін, тож версія, робоча копія й прапорець лишаються як були.
--
-- РИЗИК (позначка для опису PR): блок 3 змінює наявні початкові дані — переносить одну необов'язкову задачу «Send welcome
-- information» із секції «Before move-in» до «Move-in day» у робочій копії й у знімку версії 1, щоб секції мали 2 і 3 задачі,
-- як у прикладах PM (AC-RUN-12, AC-TASK-12, AC-EDITOR-28). Запуски, створені раніше, не змінюються (вони мають власні копії).
-- Блок спрацьовує лише для незмінених початкових даних (за фіксованими id і назвами), деструктивних операцій немає.

-- ── 1. Унікальність назви шаблону: без урахування регістру й пробілів по краях (AC-EDITOR-23) ───────
-- Індекс не створився б, якби в базі вже були назви-дублікати (їх міг створити адміністратор до цієї валідації): спершу
-- дублікатам, крім найстарішого шаблону, додаємо суфікс « (N)». Без дублікатів (звичайний випадок) нічого не змінюється.
with ranked as (
  select t.id, row_number() over (partition by lower(btrim(t.name)) order by t.created_at, t.id) as rn
  from public.templates as t
)
update public.templates as t
set name = btrim(t.name) || ' (' || ranked.rn || ')'
from ranked
where ranked.id = t.id and ranked.rn > 1;

create unique index templates_name_unique_idx on public.templates (lower(btrim(name)));

-- ── 2. create_template: назва обов'язкова й унікальна ─────────────────────────────────────────
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

  -- AC-EDITOR-19: порожня назва (чи лише з пробілів) — відмова.
  if v_name = '' then
    raise exception 'Enter a template name' using errcode = '22023';
  end if;

  -- AC-EDITOR-23: така назва вже є (без урахування регістру й пробілів по краях) — відмова.
  if exists (select 1 from public.templates as t where lower(btrim(t.name)) = lower(v_name)) then
    raise exception 'A template with this name already exists' using errcode = '23505';
  end if;

  insert into public.templates (name) values (v_name) returning id into v_id;
  insert into public.template_drafts (template_id, has_unpublished_changes) values (v_id, true);
  return v_id;
end;
$$;

-- ── 3. publish_template: назви, секції без задач, обов'язкова задача ─────────────────────────────
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

  -- AC-EDITOR-12: без змін нової версії немає.
  if not v_dirty and v_current is not null then
    return v_current;
  end if;

  -- AC-EDITOR-20: секція й задача мають назву (лише пробіли — порожня).
  if exists (select 1 from public.template_sections as s where s.template_id = p_template_id and btrim(s.name) = '')
     or exists (select 1 from public.template_tasks as t where t.template_id = p_template_id and btrim(t.name) = '') then
    raise exception 'Every section and task needs a name' using errcode = '22023';
  end if;

  -- AC-EDITOR-15: кожна секція має хоча б одну задачу.
  if exists (
    select 1 from public.template_sections as s
    where s.template_id = p_template_id
      and not exists (select 1 from public.template_tasks as t where t.section_id = s.id)
  ) then
    raise exception 'Every section needs at least one task' using errcode = '22023';
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

-- ── 4. Початкові дані: «Tenant move-in» — секції з 2 і 3 задачами, як у прикладах PM ───────────────
-- Робоча копія: «Send welcome information» → кінець секції «Move-in day» (позиція 3). Лише якщо задача ще така, якою її
-- створив сид (та сама секція, назва, позиція 3, необов'язкова), а позиція 3 у «Move-in day» вільна (інакше порушився б
-- унікальний ключ (section_id, position)).
update public.template_tasks as t
set section_id = 'a0000000-0000-4000-8000-000000000012', position = 3
where t.id = 'a0000000-0000-4000-8000-000000000103'
  and t.section_id = 'a0000000-0000-4000-8000-000000000011'
  and t.name = 'Send welcome information'
  and t.position = 3
  and not t.required
  and not exists (
    select 1 from public.template_tasks as other
    where other.section_id = 'a0000000-0000-4000-8000-000000000012' and other.position = 3
  );

-- Знімок версії 1: те саме для задачі з цією назвою в секції «Before move-in» версії 1 шаблону. Ідентифікатори знімка
-- бекфіл не фіксував, тому ключ — назва, секція, позиція 3 і «необов'язкова» (початковий стан); позиція 3 у цільовій секції вільна.
update public.template_version_tasks as vt
set section_id = target.id, position = 3
from public.template_version_sections as source, public.template_version_sections as target
where vt.name = 'Send welcome information'
  and vt.position = 3
  and not vt.required
  and vt.section_id = source.id
  and source.template_id = 'a0000000-0000-4000-8000-000000000001'
  and source.version = 1
  and source.name = 'Before move-in'
  and target.version_id = source.version_id
  and target.name = 'Move-in day'
  and not exists (
    select 1 from public.template_version_tasks as other where other.section_id = target.id and other.position = 3
  );
