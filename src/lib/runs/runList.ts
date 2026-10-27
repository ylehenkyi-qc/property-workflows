import { runStatusLabel } from "./labels";
import { formatRunProgress } from "./progress";

export type RunRow = { id: string; case_name: string; status: string; created_at: string; template_id?: string | null };
export type RunTaskRow = { run_id: string; status: string };
export type TemplateRow = { id: string; name: string };

export type RunListItem = {
  id: string;
  caseName: string;
  templateName: string;
  status: string;
  statusLabel: string;
  progress: string;
};

// Рядки списку запусків (AC-TASK-09, AC-TASK-13, AC-TASK-14, AC-TASK-17): новіші першими, назва випадку й шаблону,
// статус і прогрес «N of M done» — і для завершених, і для поточних запусків.
// Які запуски бачить користувач, вирішує RLS; тут лише перетворення вже отриманих даних.
export function buildRunList(
  runs: readonly RunRow[],
  tasks: readonly RunTaskRow[],
  templates: readonly TemplateRow[] = [],
): RunListItem[] {
  return [...runs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((run) => ({
      id: run.id,
      caseName: run.case_name,
      templateName: templates.find((template) => template.id === run.template_id)?.name ?? "—",
      status: run.status,
      statusLabel: runStatusLabel(run.status),
      progress: formatRunProgress(tasks.filter((task) => task.run_id === run.id)),
    }));
}
