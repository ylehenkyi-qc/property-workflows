// Синтетичні дані для UAT наших AC (AC-DSYS-02, AC-TASK-10, AC-DSYS-04): менеджери uat-<запуск>-<мітка>@example.test,
// запуск, створений синтетичним менеджером, і читання стану шаблону. Усе, що створює цей файл, прибирає
// deleteUatUsers() з ./admin (runs за manager_id, потім користувача; run_sections і run_tasks йдуть каскадом).
// Секретний ключ і паролі не друкуємо: лише адреси синтетичних користувачів.
import { createClient } from "@supabase/supabase-js";
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

/** Менеджер запускає шаблон від свого імені (RPC launch_run, як форма «New run»): запуск належить йому. */
export async function launchRunAs(user: UatUser, templateId: string, caseName: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Потрібні NEXT_PUBLIC_SUPABASE_URL і NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local)");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (signedIn.error) throw new Error(`Вхід ${user.email}: ${signedIn.error.message}`);
  const { data, error } = await client.rpc("launch_run", {
    p_template_id: templateId,
    p_case_name: caseName,
    p_assignments: [],
  });
  if (error || !data) throw new Error(`launch_run: ${error?.message ?? "порожня відповідь"}`);
  return data as string;
}

/** Назви задач запуску (читає секретний ключ, обходить RLS): щоб перевірити, що чужий їх не бачить. */
export async function runTaskNames(runId: string): Promise<string[]> {
  const { data, error } = await adminClient().from("run_tasks").select("name").eq("run_id", runId);
  if (error) throw error;
  return (data ?? []).map((t) => t.name as string);
}
