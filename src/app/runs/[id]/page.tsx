import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { groupTasksBySection } from "@/lib/runs/groupTasksBySection";
import { assigneeLabel } from "@/lib/runs/labels";
import { isMarkTaskErrorCode, MARK_TASK_ERRORS } from "@/lib/runs/markTaskErrors";
import { formatRunProgress } from "@/lib/runs/progress";
import { markTaskDone } from "./actions";

// Сторінка запуску (AC-TASK-05, AC-TASK-08, AC-DSYS-01): прогрес, статус, задачі за секціями зі статусом, обов'язковістю й
// виконавцем. Чужий запуск RLS не повертає — сторінка «Run not found». Кнопка «Mark as done» (AC-TASK-01, 02, 03, 07) стоїть
// на кожній задачі «to do» для всіх, хто бачить запуск; право позначати перевіряє база.
export default async function RunPage({ params, searchParams }: PageProps<"/runs/[id]">) {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const { id } = await params;
  const { error } = await searchParams;
  const errorMessage = isMarkTaskErrorCode(error) ? MARK_TASK_ERRORS[error] : undefined;
  const { data: run, error: runError } = await supabase
    .from("runs")
    .select("id, case_name, status")
    .eq("id", id)
    .maybeSingle();
  if (runError) {
    throw new Error("Failed to load the run");
  }
  if (!run) {
    notFound();
  }

  // Незалежні запити — паралельно. Виконавців підписуємо email із вузької функції:
  // ролі й решти профілю менеджер не бачить.
  const [sectionsResult, tasksResult, usersResult] = await Promise.all([
    supabase.from("run_sections").select("id, name, position").eq("run_id", run.id),
    supabase
      .from("run_tasks")
      .select("id, name, position, required, status, assignee_id, section_id")
      .eq("run_id", run.id),
    supabase.rpc("list_assignable_users"),
  ]);
  if (sectionsResult.error) throw new Error("Failed to load run sections");
  if (tasksResult.error) throw new Error("Failed to load run tasks");
  if (usersResult.error) throw new Error("Failed to load assignees");

  const sections = sectionsResult.data;
  const tasks = tasksResult.data;
  const users = usersResult.data;

  const allTasks = tasks;
  const groups = groupTasksBySection(sections, allTasks);

  return (
    <PageShell>
      <Link href="/runs" className="text-sm text-muted-foreground underline">
        Runs
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold" data-testid="run-case-name">
          {run.case_name}
        </h1>
        <p className="flex items-center gap-3 text-sm text-muted-foreground">
          <span data-testid="run-status">
            <StatusBadge status={run.status} />
          </span>
          <span data-testid="run-progress" className="tabular-nums">
            {formatRunProgress(allTasks)}
          </span>
        </p>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {groups.map(({ section, tasks: sectionTasks }) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{section.name}</h2>
          <ul className="flex flex-col gap-2">
            {sectionTasks.map((task) => (
              <li key={task.id} data-testid="run-task">
                <Card className="flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex flex-wrap items-center gap-2">
                    {task.name}
                    <Badge variant="outline">{task.required ? "required" : "optional"}</Badge>
                  </span>
                  <span className="flex flex-wrap items-center gap-3 text-muted-foreground">
                    <StatusBadge status={task.status} />
                    <span>{assigneeLabel(task.assignee_id, users)}</span>
                    {task.status === "to_do" ? (
                      <form action={markTaskDone.bind(null, task.id, run.id)}>
                        <Button type="submit" variant="outline" size="sm">
                          Mark as done
                        </Button>
                      </form>
                    ) : null}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageShell>
  );
}
