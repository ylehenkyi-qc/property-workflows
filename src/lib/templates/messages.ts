// Тексти редактора шаблонів. Дослівні з вимог PM: «A template needs at least one required task», «Not enough rights»,
// «Back to templates», «Unpublished changes», «Your last change was not kept. Try again.» (AC-EDITOR-25), «All changes kept».
// Решта — формулювання розробника (вимогами не задані).
export const NEEDS_REQUIRED_TASK = "A template needs at least one required task";
export const NOT_ENOUGH_RIGHTS = "Not enough rights";
export const DRAFT_NOT_SAVED = "Your last change was not kept. Try again.";
export const ALL_CHANGES_KEPT = "All changes kept";
export const VERSION_NOT_SAVED = "Could not save the version";

// Текст помилки rpc publish_template для користувача: відмова з правила AC-EDITOR-04 — дослівно, відмова за правами —
// «Not enough rights» (42501), решта — загальна.
export function publishErrorMessage(error: { code?: string; message?: string }): string {
  if (error.message === NEEDS_REQUIRED_TASK) return NEEDS_REQUIRED_TASK;
  if (error.code === "42501") return NOT_ENOUGH_RIGHTS;
  return VERSION_NOT_SAVED;
}
