import { runStatusLabel } from "./labels";
import { formatRunProgress } from "./progress";

export type RunRow = { id: string; case_name: string; status: string; created_at: string };
export type RunTaskRow = { run_id: string; status: string };

export type RunListItem = {
  id: string;
  caseName: string;
  status: string;
  statusLabel: string;
  progress: string;
};

// Рядки списку запусків (AC-TASK-09): новіші першими, статус і прогрес «N of M done».
// Які запуски бачить користувач, вирішує RLS; тут лише перетворення вже отриманих даних.
export function buildRunList(
  runs: readonly RunRow[],
  tasks: readonly RunTaskRow[],
): RunListItem[] {
  return [...runs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((run) => ({
      id: run.id,
      caseName: run.case_name,
      status: run.status,
      statusLabel: runStatusLabel(run.status),
      progress: formatRunProgress(tasks.filter((task) => task.run_id === run.id)),
    }));
}
