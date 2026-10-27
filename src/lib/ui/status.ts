import { runStatusLabel, taskStatusLabel } from "@/lib/runs/labels";

// Єдина мапа «статус → слово й токен» (DESIGN.md, розділ 2; AC-DSYS-01). Той самий статус має те саме слово й той
// самий колір у списку, на сторінці запуску й будь-де ще. Колір ніколи не стоїть без слова.
export type StatusTone = "todo" | "progress" | "done" | "unpublished";

const TONE_CLASSES: Record<StatusTone, string> = {
  todo: "bg-status-todo text-status-todo-foreground",
  progress: "bg-status-progress text-status-progress-foreground",
  done: "bg-status-done text-status-done-foreground",
  unpublished: "bg-status-unpublished text-status-unpublished-foreground",
};

export type StatusInfo = { label: string; tone: StatusTone; className: string };

// Ключі — значення з бази: запуск (in_progress, completed), задача (to_do, done) і позначка шаблону (unpublished).
export function statusInfo(status: string): StatusInfo {
  const tone = toneOf(status);
  return { label: labelOf(status), tone, className: TONE_CLASSES[tone] };
}

function toneOf(status: string): StatusTone {
  switch (status) {
    case "in_progress":
      return "progress";
    case "completed":
    case "done":
      return "done";
    case "unpublished":
      return "unpublished";
    default:
      return "todo";
  }
}

function labelOf(status: string): string {
  switch (status) {
    case "in_progress":
    case "completed":
      return runStatusLabel(status);
    case "to_do":
    case "done":
      return taskStatusLabel(status);
    case "unpublished":
      return "Unpublished changes";
    default:
      return status;
  }
}
