// Значення «Me» у виборі виконавця під час запуску (AC-RUN-04, AC-RUN-08, AC-RUN-09): виконавець — менеджер запуску,
// призначення не створюється. Випадний список не вміє порожнє значення, тож «Me» передається цією міткою.
export const ASSIGNEE_ME = "me";

// Порожнє значення лишається «я» для сумісності зі старими формами.
export function isSelfAssignee(value: string): boolean {
  return value === "" || value === ASSIGNEE_ME;
}
