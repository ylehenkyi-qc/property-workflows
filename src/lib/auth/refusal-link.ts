import type { AppRole } from "./require-role";

// Посилання у відмові «Not enough rights»: вендор не відкриває шаблони, тож його не відсилаємо на сторінку, що знову
// його відмовить, — веде на список запусків (робоче рішення до solomchaak/property-workflows-spec#47 і #49). Решті ролей —
// головна, як і раніше.
export function refusalLink(role: AppRole | null): { href: string; label: string } {
  return role === "vendor" ? { href: "/runs", label: "Back to runs" } : { href: "/", label: "Back to home" };
}
