import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { groupTasksBySection } from "@/lib/runs/groupTasksBySection";
import { canVendorMarkDone } from "@/lib/runs/permissions";
import { formatVendorProgress } from "@/lib/runs/progress";
import type { VendorRun } from "../vendor-runs";
import { MarkDoneButton } from "./mark-done-button";

type VendorTask = {
  id: string;
  name: string;
  position: number;
  required: boolean;
  status: string;
  assignee_id: string;
  section_id: string;
};

// Сторінка запуску для вендора (AC-VENDOR-04): назва випадку, «Your tasks: N of K done» і лише його задачі, згруповані
// за секціями, — назва, «required»/«optional» і статус. Без статусу запуску, назви шаблону, версії, прогресу запуску й
// email виконавців (робоче рішення до solomchaak/property-workflows-spec#41, варіант A). Що саме віддає база — вирішує RLS
// (власні задачі й секції з ними) і list_vendor_runs; сторінка не читає runs, шаблонів і списку виконавців.
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
  const groups = groupTasksBySection(sections, tasks);

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
                    {canVendorMarkDone(task, userId) ? (
                      // Підтвердження «This cannot be undone» на кожній задачі вендора, а не лише на останній обов'язковій:
                      // так діалог не розкриває стану чужих задач (робоче рішення до solomchaak/property-workflows-spec#43, варіант B).
                      <MarkDoneButton taskId={task.id} runId={run.id} taskName={task.name} needsConfirmation />
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
