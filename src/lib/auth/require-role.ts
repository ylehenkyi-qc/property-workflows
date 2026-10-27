import { createClient } from "@/lib/supabase/server";

export type AppRole = "manager" | "admin";

export type RoleCheck =
  | { status: "ok"; supabase: Awaited<ReturnType<typeof createClient>>; userId: string; role: AppRole }
  | { status: "unauthenticated" }
  | { status: "forbidden"; role: AppRole | null };

const isAppRole = (value: unknown): value is AppRole => value === "manager" || value === "admin";

// Перший рядок кожної сторінки й Server Action: хто користувач і чи має він потрібну роль. Сесію перевіряє getClaims()
// (JWT), getSession() для авторизації на сервері не використовуємо; роль — з profiles.role, ніколи з user_metadata.
// Це перевірка заради зрозумілої відмови: право на запис гарантує база (функції створення й збереження шаблону).
export async function requireRole(allowed: AppRole | readonly AppRole[]): Promise<RoleCheck> {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { status: "unauthenticated" };

  // RLS: користувач бачить лише власний профіль.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const role = isAppRole(profile?.role) ? profile.role : null;

  const roles: readonly AppRole[] = typeof allowed === "string" ? [allowed] : allowed;
  if (!role || !roles.includes(role)) return { status: "forbidden", role };

  return { status: "ok", supabase, userId, role };
}
