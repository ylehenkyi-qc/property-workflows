// Тексти редактора шаблонів. Дослівні з вимог PM: «A template needs at least one required task», «Not enough rights»,
// «Back to templates», «Unpublished changes», «Your last change was not kept. Try again.» (AC-EDITOR-25), «All changes kept».
// Решта — формулювання розробника (вимогами не задані).
export const NEEDS_REQUIRED_TASK = "A template needs at least one required task";
export const NOT_ENOUGH_RIGHTS = "Not enough rights";
export const EVERY_SECTION_NEEDS_TASK = "Every section needs at least one task";
export const EVERY_NAME_NEEDED = "Every section and task needs a name";
export const ENTER_TEMPLATE_NAME = "Enter a template name";
export const TEMPLATE_NAME_TAKEN = "A template with this name already exists";
export const DRAFT_NOT_SAVED = "Your last change was not kept. Try again.";
export const ALL_CHANGES_KEPT = "All changes kept";
export const VERSION_NOT_SAVED = "Could not save the version";

// Відмови правил збереження версії (AC-EDITOR-04, 15, 20): база кидає виняток із дослівним текстом PM.
const PUBLISH_RULE_MESSAGES: readonly string[] = [NEEDS_REQUIRED_TASK, EVERY_SECTION_NEEDS_TASK, EVERY_NAME_NEEDED];

// Текст помилки rpc publish_template для користувача: відмова за правилом — дослівно, відмова за правами —
// «Not enough rights» (42501), решта — загальна.
export function publishErrorMessage(error: { code?: string; message?: string }): string {
  if (error.message && PUBLISH_RULE_MESSAGES.includes(error.message)) return error.message;
  if (error.code === "42501") return NOT_ENOUGH_RIGHTS;
  return VERSION_NOT_SAVED;
}
