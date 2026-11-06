import type { AppRole } from "./require-role";

export type RefusalLink = { href: string; label: string };

const BACK_TO_HOME: RefusalLink = { href: "/", label: "Back to home" };

// Посилання у відмові «Not enough rights»: вендор не відкриває шаблони, тож його не відсилаємо на сторінку, що знову
// його відмовить, — веде на список запусків (робоче рішення до solomchaak/property-workflows-spec#47 і #49). Решті ролей —
// посилання сторінки (fallback), як і раніше: головна або «Back to templates» (AC-DSYS-02).
export function refusalLink(role: AppRole | null, fallback: RefusalLink = BACK_TO_HOME): RefusalLink {
  return role === "vendor" ? { href: "/runs", label: "Back to runs" } : fallback;
}
