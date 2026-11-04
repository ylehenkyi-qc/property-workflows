import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireRole } from "@/lib/auth/require-role";
import { loginPath } from "@/lib/auth/safe-next";
import { assigneeLabel } from "@/lib/runs/labels";
import { isMarkTaskErrorCode, MARK_TASK_ERRORS } from "@/lib/runs/markTaskErrors";
import { canMarkDone, isLastRequiredTask } from "@/lib/runs/permissions";
import { formatRunProgress } from "@/lib/runs/progress";
import { loadRunDetails } from "./load-run";
import { MarkDoneButton } from "./mark-done-button";
import { TaskSections } from "./task-sections";
import { renderVendorRun } from "./vendor-run";

// Сторінка запуску (AC-TASK-05, AC-TASK-08, AC-DSYS-01, AC-EDITOR-06): прогрес, статус, версія шаблону, задачі за секціями
// зі статусом, обов'язковістю й виконавцем. Чужий запуск RLS не повертає — сторінка «Run not found» (AC-TASK-10).
// Кнопка «Mark as done» (AC-TASK-01, 02, 07, 18) — лише на задачі «to do», яку користувач може позначити; для останньої
// обов'язкової задачі спершу підтвердження (AC-TASK-04, 16). Право позначати перевіряє база.
// Вендор (AC-VENDOR-04, 06) має власну сторінку: див. renderVendorRun.
export default async function RunPage({ params, searchParams }: PageProps<"/runs/[id]">) {
  const { id } = await params;

  // requireRole: getClaims() перевіряє JWT (getSession() не використовуємо), роль — з profiles.role.
  const auth = await requireRole(["manager", "admin", "vendor"]);
  if (auth.status === "unauthenticated") redirect(loginPath(`/runs/${id}`));
  // Користувач без ролі нічого не бачить: те саме «Run not found», що й для чужого запуску.
  if (auth.status === "forbidden") notFound();
  const { supabase, userId, role } = auth;
  const { error } = await searchParams;
  if (role === "vendor") return renderVendorRun(supabase, id, userId, error);

  const errorMessage = isMarkTaskErrorCode(error) ? MARK_TASK_ERRORS[error] : undefined;
  const { run, sections, tasks, users } = await loadRunDetails(supabase, id);

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
            {formatRunProgress(tasks)}
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

      <TaskSections
        sections={sections}
        tasks={tasks}
        actions={(task) => (
          <>
            <StatusBadge status={task.status} />
            <span>{assigneeLabel(task.assignee_id, users)}</span>
            {canMarkDone(task, run, { userId, role }) ? (
              <MarkDoneButton
                taskId={task.id}
                runId={run.id}
                taskName={task.name}
                needsConfirmation={isLastRequiredTask(tasks, task.id)}
              />
            ) : null}
          </>
        )}
      />
    </PageShell>
  );
}
