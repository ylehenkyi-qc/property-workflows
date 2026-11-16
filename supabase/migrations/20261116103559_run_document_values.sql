-- Підтверджені користувачем значення, запропоновані AI-розбором документа (зріз 4, AC-DOCAI-08; план — design.md зміни
-- impl-document-parsing, розділ «Дані й RLS»). Модель сама нічого не пише: запис — окрема дія людини (Server Action
-- confirmValues) під сесією користувача, тож права тримає RLS, а не лише код.
-- Хто пише й читає (робоче рішення до питання solomchaak/property-workflows-spec#53, варіант A): адміністратор і
-- менеджер ЦЬОГО запуску; інший менеджер (зокрема виконавець задачі), вендор і відвідувач без входу — ні.
-- Підтверджений запис не змінюється й не видаляється: для authenticated є лише select і insert.
-- Ризик: нова таблиця й дві нові функції; наявні таблиці, політики й дані не змінюються, деструктивних операцій немає.
-- AC: AC-DOCAI-08.

create table public.run_document_values (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references public.runs (id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles (id),
  kind       text not null,
  values     jsonb not null,
  created_at timestamptz not null default now(),
  constraint run_document_values_kind_check check (kind in ('request', 'estimate')),
  -- not null не відхиляє JSON-значення 'null'; повну форму полів перевіряє zod у confirmValues перед записом
  constraint run_document_values_values_check check (jsonb_typeof(values) = 'object')
);

create index run_document_values_run_id_idx on public.run_document_values (run_id);

-- ── Хто керує запуском: адміністратор або менеджер цього запуску (роль — з profiles.role) ───────────
create or replace function private.can_manage_run(p_run_id uuid)
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
      and exists (
        select 1 from public.runs as r
        where r.id = p_run_id and r.manager_id = (select auth.uid())
      )
    );
$$;

revoke execute on function private.can_manage_run(uuid) from public, anon;
grant execute on function private.can_manage_run(uuid) to authenticated;

-- Вузька обгортка для Server Action: перевірка доступу до запуску ДО виклику моделі (щоб чужий менеджер не витрачав ліміт ключа).
create or replace function public.can_manage_run(p_run_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.can_manage_run(p_run_id);
$$;

revoke execute on function public.can_manage_run(uuid) from public, anon;
grant execute on function public.can_manage_run(uuid) to authenticated;

-- ── RLS, права й політики ─────────────────────────────────────────────────────────────────
alter table public.run_document_values enable row level security;

revoke all on table public.run_document_values from anon, authenticated;
grant select, insert on table public.run_document_values to authenticated;
grant select, insert, update, delete on table public.run_document_values to service_role;

-- Умова не «auth.uid() is not null»: рядки обмежені керуванням батьківським запуском.
create policy run_document_values_select_managed
  on public.run_document_values for select to authenticated
  using (private.can_manage_run(run_id));

create policy run_document_values_insert_managed
  on public.run_document_values for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_manage_run(run_id));
