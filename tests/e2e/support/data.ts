// Синтетичні дані для UAT наших AC (AC-DSYS-02, AC-EDITOR-07, AC-DSYS-04): менеджери uat-<запуск>-<мітка>@example.test
// і читання стану шаблону. Усе, що створює цей файл, прибирає deleteUatUsers() з ./admin (користувача, а за потреби
// його рядки в OWNED_ROWS). Секретний ключ і паролі не друкуємо: лише адреси синтетичних користувачів.
import { adminClient, randomPassword, uatEmail } from "./admin";

export type UatUser = { id: string; email: string; password: string };

/** Новий менеджер без жодного запуску: роль manager — це default колонки profiles.role (міграція roles_manager_admin). */
export async function createUatManager(suffix: string): Promise<UatUser> {
  const supabase = adminClient();
  const email = uatEmail(suffix);
  const password = randomPassword();
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Не вдалося створити ${email}: ${error?.message ?? "порожня відповідь"}`);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== "manager") throw new Error(`${email}: очікували роль manager, а не ${profile?.role}`);
  return { id: data.user.id, email, password };
}

/** Шаблон «Tenant move-in» із поточною збереженою версією (запуск іде лише з такого). */
export async function tenantMoveInTemplate(): Promise<{ id: string; name: string }> {
  const { data, error } = await adminClient()
    .from("templates")
    .select("id, name, current_version")
    .eq("name", "Tenant move-in")
    .not("current_version", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("На проді немає шаблону «Tenant move-in» зі збереженою версією");
  return { id: data.id, name: data.name };
}

/** Версія шаблону й прапорець «є непублікована робоча копія»: так видно, що відвідування редактора їх не змінило. */
export async function templateState(templateId: string): Promise<{ currentVersion: number | null; unpublished: boolean }> {
  const supabase = adminClient();
  const { data: template, error } = await supabase
    .from("templates")
    .select("current_version")
    .eq("id", templateId)
    .maybeSingle();
  if (error) throw error;
  const { data: draft, error: draftError } = await supabase
    .from("template_drafts")
    .select("has_unpublished_changes")
    .eq("template_id", templateId)
    .maybeSingle();
  if (draftError) throw draftError;
  return { currentVersion: template?.current_version ?? null, unpublished: draft?.has_unpublished_changes ?? false };
}

/** Скільки збережених версій має шаблон у базі (читає секретний ключ, обходить RLS): щоб було що не показувати менеджеру. */
export async function templateVersionCount(templateId: string): Promise<number> {
  const { count, error } = await adminClient()
    .from("template_versions")
    .select("*", { count: "exact", head: true })
    .eq("template_id", templateId);
  if (error) throw error;
  return count ?? 0;
}
