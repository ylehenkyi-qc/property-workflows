import { notFound } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Секції й задачі запуску (спільні для менеджерської й вендорської сторінок): що саме повертається, вирішує RLS — менеджеру й
// адміністратору всі задачі запуску, вендору лише його (AC-VENDOR-04).
export async function loadSectionsAndTasks(supabase: Supabase, runId: string) {
  const [sections, tasks] = await Promise.all([
    supabase.from("run_sections").select("id, name, position").eq("run_id", runId),
    supabase
      .from("run_tasks")
      .select("id, name, position, required, status, assignee_id, section_id")
      .eq("run_id", runId),
  ]);
  if (sections.error) throw new Error("Failed to load run sections");
  if (tasks.error) throw new Error("Failed to load run tasks");
  return { sections: sections.data, tasks: tasks.data };
}

// Дані сторінки запуску для менеджера й адміністратора (AC-TASK-05, 08, 10, 11): рядок запуску, секції, задачі й email
// виконавців із вузької функції (ролі й решти профілю менеджер не бачить). Чужий запуск RLS не повертає — «Run not found»
// (AC-TASK-10). Помилку бази не маскуємо порожнім станом: error.tsx покаже «Something went wrong».
export async function loadRunDetails(supabase: Supabase, id: string) {
  const { data: run, error: runError } = await supabase
    .from("runs")
    .select("id, case_name, status, template_version, manager_id")
    .eq("id", id)
    .maybeSingle();
  if (runError) {
    throw new Error("Failed to load the run");
  }
  if (!run) {
    notFound();
  }

  // Незалежні запити — паралельно: секції й задачі запуску та email виконавців.
  const [body, usersResult] = await Promise.all([loadSectionsAndTasks(supabase, run.id), supabase.rpc("list_assignable_users")]);
  if (usersResult.error) throw new Error("Failed to load assignees");

  return { run, sections: body.sections, tasks: body.tasks, users: usersResult.data };
}
