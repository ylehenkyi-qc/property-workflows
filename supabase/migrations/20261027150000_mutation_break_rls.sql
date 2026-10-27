-- МУТАЦІЯ (тимчасова гілка, не зливати): навмисно ламає RLS, щоб показати червоні тести.
-- M1 (AC-EDITOR-02): менеджер читає робочу копію шаблону.
create policy mutation_manager_reads_working_copy
  on public.template_tasks for select to authenticated using (true);
-- M2 (AC-EDITOR-07): менеджер читає список версій.
create policy mutation_manager_reads_versions
  on public.template_versions for select to authenticated using (true);
-- M3 (AC-EDITOR-08): менеджер змінює шаблон напряму.
grant update on table public.templates to authenticated;
create policy mutation_manager_updates_template
  on public.templates for update to authenticated using (true) with check (true);
