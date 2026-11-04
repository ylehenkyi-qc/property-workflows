import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { createClient } from "@/lib/supabase/server";
import { isMarkTaskErrorCode, MARK_TASK_ERRORS } from "@/lib/runs/markTaskErrors";
import { canVendorMarkDone } from "@/lib/runs/permissions";
import { formatVendorProgress } from "@/lib/runs/progress";
import type { VendorRun } from "../vendor-runs";
import { loadSectionsAndTasks } from "./load-run";
import { MarkDoneButton } from "./mark-done-button";
import { TaskSections } from "./task-sections";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type VendorTask = {
  id: string;
  name: string;
  position: number;
  required: boolean;
  status: string;
  assignee_id: string;
  section_id: string;
};

// Сторінка запуску для вендора (AC-VENDOR-04, 05, 06): заголовок запуску віддає list_vendor_runs, рядки задач і секцій —
// RLS (лише його задачі й секції з ними). Запуск без його задач і неіснуючий id — однаково «Run not found», і жодна задача
// не читається. Помилку бази не маскуємо: error.tsx покаже «Something went wrong». error — код відмови останньої дії
// «Mark as done» з адреси сторінки.
export async function renderVendorRun(supabase: Supabase, id: string, userId: string, error: unknown) {
  const { data: runs, error: runError } = await supabase.rpc("list_vendor_runs", { p_run_id: id });
  if (runError) throw new Error("Failed to load the run");
  const run = runs?.[0];
  if (!run) notFound();

  const { sections, tasks } = await loadSectionsAndTasks(supabase, run.id);

  return (
    <VendorRunView
      run={run}
      sections={sections}
      tasks={tasks}
      userId={userId}
      errorMessage={isMarkTaskErrorCode(error) ? MARK_TASK_ERRORS[error] : undefined}
    />
  );
}

// Назва випадку, «Your tasks: N of K done» і лише його задачі, згруповані за секціями, — назва, «required»/«optional» і
// статус. Без статусу запуску, назви шаблону, версії, прогресу запуску й email виконавців (робоче рішення до
// solomchaak/property-workflows-spec#41, варіант A).
export function VendorRunView({
  run,
  sections,
  tasks,
  userId,
  errorMessage,
}: {
  run: VendorRun;
  sections: readonly { id: string; name: string; position: number }[];
  tasks: readonly VendorTask[];
  userId: string;
  errorMessage?: string;
}) {
  return (
    <PageShell>
      <Link href="/runs" className="text-sm text-muted-foreground underline">
        Runs
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold" data-testid="run-case-name">
          {run.case_name}
        </h1>
        <p data-testid="run-progress" className="text-sm tabular-nums text-muted-foreground">
          {formatVendorProgress(run.tasks_done, run.tasks_total)}
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
            {canVendorMarkDone(task, userId) ? (
              // Підтвердження «This cannot be undone» на кожній задачі вендора, а не лише на останній обов'язковій:
              // так діалог не розкриває стану чужих задач (робоче рішення до solomchaak/property-workflows-spec#43, варіант B).
              <MarkDoneButton taskId={task.id} runId={run.id} taskName={task.name} needsConfirmation />
            ) : null}
          </>
        )}
      />
    </PageShell>
  );
}
