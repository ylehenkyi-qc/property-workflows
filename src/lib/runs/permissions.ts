// Хто може позначити задачу виконаною й коли потрібне підтвердження (AC-TASK-18, AC-TASK-04, AC-TASK-16).
// Це лише підказка інтерфейсу (які кнопки показати): право гарантує mark_task_done у базі.
import type { AppRole } from "@/lib/auth/require-role";

export type Viewer = { userId: string; role: AppRole };

// Кнопка «Mark as done» — лише на задачі «to do» і лише виконавцю цієї задачі, менеджеру запуску й адміністратору.
export function canMarkDone(
  task: { assignee_id: string; status: string },
  run: { manager_id: string },
  viewer: Viewer,
): boolean {
  if (task.status !== "to_do") return false;
  return viewer.role === "admin" || viewer.userId === run.manager_id || viewer.userId === task.assignee_id;
}

// Остання обов'язкова задача: вона обов'язкова, ще «to do», а всі інші обов'язкові задачі запуску вже «done».
// Її виконання завершує запуск, тому спершу підтвердження («This cannot be undone»).
export function isLastRequiredTask(
  tasks: readonly { id: string; required: boolean; status: string }[],
  taskId: string,
): boolean {
  const task = tasks.find((item) => item.id === taskId);
  if (!task || !task.required || task.status === "done") return false;
  return tasks.every((item) => item.id === taskId || !item.required || item.status === "done");
}

// Кнопка «Mark as done» для вендора (AC-VENDOR-05): лише на його власній задачі «to do». Це підказка інтерфейсу: право
// гарантує mark_task_done у базі (AC-VENDOR-07), а вендор бачить лише свої задачі й так.
export function canVendorMarkDone(task: { assignee_id: string; status: string }, userId: string): boolean {
  return task.status === "to_do" && task.assignee_id === userId;
}
