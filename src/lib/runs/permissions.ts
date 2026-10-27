// Хто може позначити задачу виконаною й коли потрібне підтвердження (AC-TASK-18, AC-TASK-04, AC-TASK-16).
// Це лише підказка інтерфейсу (які кнопки показати): право гарантує mark_task_done у базі.
export type Viewer = { userId: string; role: "manager" | "admin" };

// Кнопка «Mark as done» — лише на задачі «to do» і лише виконавцю цієї задачі, менеджеру запуску й адміністратору.
export function canMarkDone(
  task: { assignee_id: string; status: string },
  run: { manager_id: string },
  viewer: Viewer,
): boolean {
  if (task.status !== "to_do") return false;
  return viewer.role === "admin" || viewer.role === "manager";
}

// Остання обов'язкова задача: вона обов'язкова, ще «to do», а всі інші обов'язкові задачі запуску вже «done».
// Її виконання завершує запуск, тому спершу підтвердження («This cannot be undone»).
export function isLastRequiredTask(
  tasks: readonly { id: string; required: boolean; status: string }[],
  taskId: string,
): boolean {
  const task = tasks.find((item) => item.id === taskId);
  if (!task || !task.required || task.status === "done") return false;
  return true;
}
