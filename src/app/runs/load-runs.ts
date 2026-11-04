import type { createClient } from "@/lib/supabase/server";
import { buildRunList } from "@/lib/runs/runList";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Список запусків для менеджера й адміністратора (AC-TASK-06, 09, 13, 14, 17): які запуски користувач бачить, вирішує RLS.
// Помилку не маскуємо порожнім списком: error.tsx покаже «Something went wrong».
export async function loadRunList(supabase: Supabase) {
  const { data: runs, error: runsError } = await supabase
    .from("runs")
    .select("id, case_name, status, created_at, template_id")
    .order("created_at", { ascending: false });
  if (runsError) {
    throw new Error("Failed to load runs");
  }

  // Задачі беремо окремим запитом: run_tasks пов'язана з run_sections, а не напряму з runs.
  const runIds = (runs ?? []).map((run) => run.id);
  const { data: tasks, error: tasksError } = runIds.length
    ? await supabase.from("run_tasks").select("run_id, status").in("run_id", runIds)
    : { data: [], error: null };
  if (tasksError) {
    throw new Error("Failed to load run tasks");
  }

  // Назви шаблонів — окремим запитом (як задачі): менеджер читає шаблони зі збереженою версією, а запуск іде лише з такого.
  const templateIds = [...new Set((runs ?? []).flatMap((run) => (run.template_id ? [run.template_id] : [])))];
  const { data: templates, error: templatesError } = templateIds.length
    ? await supabase.from("templates").select("id, name").in("id", templateIds)
    : { data: [], error: null };
  if (templatesError) {
    throw new Error("Failed to load templates");
  }

  return buildRunList(runs ?? [], tasks ?? [], templates ?? []);
}
