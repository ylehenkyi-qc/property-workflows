-- Нотатки до запусків: короткі текстові записи автора до запуску (підготовка схеми, екранів поки немає).
-- Таблиця в public: RLS увімкнено, anon доступу не має, права видано явно (автогрантів немає).

create table public.run_notes (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references public.runs (id) on delete cascade,
  author_id  uuid not null references public.profiles (id),
  body       text not null,
  created_at timestamptz not null default now(),
  constraint run_notes_body_check check (char_length(body) between 1 and 500)
);

create index run_notes_run_id_idx on public.run_notes (run_id);

alter table public.run_notes enable row level security;

revoke all on table public.run_notes from anon, authenticated;
grant select, insert on table public.run_notes to authenticated;

create policy run_notes_select_authenticated
  on public.run_notes for select to authenticated
  using ((select auth.uid()) is not null);

create policy run_notes_insert_own
  on public.run_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_see_run(run_id));
