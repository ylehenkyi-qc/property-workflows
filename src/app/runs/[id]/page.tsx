import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/require-role";
import { loginPath } from "@/lib/auth/safe-next";
import { groupTasksBySection } from "@/lib/runs/groupTasksBySection";
import { assigneeLabel } from "@/lib/runs/labels";
import { isMarkTaskErrorCode, MARK_TASK_ERRORS } from "@/lib/runs/markTaskErrors";
import { canMarkDone, isLastRequiredTask } from "@/lib/runs/permissions";
import { formatRunProgress } from "@/lib/runs/progress";
import { MarkDoneButton } from "./mark-done-button";

// Сторінка запуску (AC-TASK-05, AC-TASK-08, AC-DSYS-01, AC-EDITOR-06): прогрес, статус, версія шаблону, задачі за секціями
// зі статусом, обов'язковістю й виконавцем. Чужий запуск RLS не повертає — сторінка «Run not found» (AC-TASK-10).
// Кнопка «Mark as done» (AC-TASK-01, 02, 07, 18) — лише на задачі «to do», яку користувач може позначити; для останньої
// обов'язкової задачі спершу підтвердження (AC-TASK-04, 16). Право позначати перевіряє база.
export default async function RunPage({ params, searchParams }: PageProps<"/runs/[id]">) {
  const { id } = await params;

  // requireRole: getClaims() перевіряє JWT (getSession() не використовуємо), роль — з profiles.role.
  const auth = await requireRole(["manager", "admin"]);
  if (auth.status === "unauthenticated") redirect(loginPath(`/runs/${id}`));
  // Користувач без ролі нічого не бачить: те саме «Run not found», що й для чужого запуску.
  if (auth.status === "forbidden") notFound();
  const { supabase, userId, role } = auth;

  const { error } = await searchParams;
  const errorMessage = isMarkTaskErrorCode(error) ? MARK_TASK_ERRORS[error] : undefined;
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
          {run.template_version != null ? (
            <span data-testid="run-template-version">Template version {run.template_version}</span>
          ) : null}
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
                    {canMarkDone(task, run, { userId, role }) ? (
                      <MarkDoneButton
                        taskId={task.id}
                        runId={run.id}
                        taskName={task.name}
                        needsConfirmation={isLastRequiredTask(allTasks, task.id)}
                      />
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
