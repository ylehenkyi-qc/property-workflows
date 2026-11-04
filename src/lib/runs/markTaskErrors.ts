// Повідомлення про помилку позначення задачі. Між запитами передаємо код, а не текст:
// так у сторінку не потрапляє довільний текст з адреси.
export const MARK_TASK_FORBIDDEN_MESSAGE =
  "Only the task's assignee, the run manager, or an administrator can mark a task as done";

export const MARK_TASK_RUN_NOT_FOUND_MESSAGE = "Run not found";

export const MARK_TASK_ERRORS = {
  forbidden: MARK_TASK_FORBIDDEN_MESSAGE, // AC-TASK-03
  run_not_found: MARK_TASK_RUN_NOT_FOUND_MESSAGE, // AC-VENDOR-07: запуск без задач вендора для нього не існує
  // Технічна відмова (текст вимогами не визначено).
  failed: "Could not mark the task as done",
} as const;

export type MarkTaskErrorCode = keyof typeof MARK_TASK_ERRORS;

// Відмову за правами mark_task_done розпізнаємо за кодом 42501 і дослівним текстом винятку:
// інша 42501 (наприклад, «Not authorized» чи відсутній execute) — технічна відмова, а не AC-TASK-03.
export function markTaskErrorCode(error: { code?: string; message?: string }): MarkTaskErrorCode {
  if (error.code === "42501" && error.message === MARK_TASK_FORBIDDEN_MESSAGE) {
    return "forbidden";
  }
  // Вендор не відрізняє «задачі немає» від «запуск не мій» (P0002 «Run not found», рішення до solomchaak/property-workflows-spec#48).
  if (error.code === "P0002" && error.message === MARK_TASK_RUN_NOT_FOUND_MESSAGE) {
    return "run_not_found";
  }
  return "failed";
}

export function isMarkTaskErrorCode(value: unknown): value is MarkTaskErrorCode {
  return typeof value === "string" && Object.hasOwn(MARK_TASK_ERRORS, value);
}
