-- Позначення задачі виконаною для вендора (design.md зміни impl-vendor-access, задача 3).
-- Вендор позначає свої задачі як виконавець (наявні рядки це вже дозволяють); нове — відмова для чужого, яка нічого
-- не розкриває: запуск без задач вендора й неіснуюча задача для нього однаково «Run not found» (P0002), а в запуску,
-- де в нього є інші задачі, — дослівне повідомлення AC-TASK-03 (42501). Задача при відмові не змінюється.
-- Робочі рішення до питань PM: solomchaak/property-workflows-spec#48 (варіант B) і #46 (варіант A: статус запуску не
-- перевіряємо, вендор позначає власну необов'язкову задачу й у завершеному запуску).
-- Ризик: create or replace функції mark_task_done (тіло з 20261020142036_mark_task_done.sql); дані й політики не
-- змінюються, обгортка й права на виконання без змін.
-- AC: AC-VENDOR-05, AC-VENDOR-07.

create or replace function private.mark_task_done(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_role    text := private.current_app_role();
  v_run_id  uuid;
  v_manager uuid;
  v_assignee uuid;
  v_status  text;
begin
  if v_uid is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select t.run_id into v_run_id from public.run_tasks as t where t.id = p_task_id;
  if not found then
    -- AC-VENDOR-07: вендор не відрізняє «такої задачі немає» від «запуск не мій».
    if v_role = 'vendor' then
      raise exception 'Run not found' using errcode = 'P0002';
    end if;
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  -- AC-VENDOR-07: запуск без жодної задачі вендора для нього не існує.
  if v_role = 'vendor' and not exists (
    select 1 from public.run_tasks as t where t.run_id = v_run_id and t.assignee_id = v_uid
  ) then
    raise exception 'Run not found' using errcode = 'P0002';
  end if;

  -- Спершу блокуємо запуск (одним порядком для всіх викликів), потім задачу: паралельні позначки в одному запуску
  -- виконуються по черзі й кожна бачить уже зафіксовані позначки попередніх.
  select r.manager_id into v_manager from public.runs as r where r.id = v_run_id for update;

  select t.assignee_id, t.status into v_assignee, v_status
  from public.run_tasks as t where t.id = p_task_id for update;

  -- AC-TASK-01, AC-TASK-02, AC-TASK-07, AC-VENDOR-05: виконавець задачі (зокрема вендор), менеджер запуску або admin.
  -- AC-TASK-03, AC-VENDOR-07: інакше відмова з дослівним повідомленням, задача лишається як була.
  -- Видимість запуску не вимагаємо: співвиконавець бачить усі задачі запуску й може натиснути кнопку на чужій.
  if v_uid is distinct from v_assignee
     and v_uid is distinct from v_manager
     and coalesce(v_role, '') <> 'admin' then
    raise exception 'Only the task''s assignee, the run manager, or an administrator can mark a task as done'
      using errcode = '42501';
  end if;

  -- Повторна позначка нічого не змінює.
  if v_status = 'done' then
    return;
  end if;

  update public.run_tasks set status = 'done' where id = p_task_id;

  -- AC-TASK-04: запуск «completed», коли всі обов'язкові задачі «done»; необов'язкові статус запуску не змінюють.
  if not exists (
    select 1 from public.run_tasks as t
    where t.run_id = v_run_id and t.required and t.status <> 'done'
  ) then
    update public.runs set status = 'completed' where id = v_run_id and status <> 'completed';
  end if;
end;
$$;
