// Синтетичні дані UAT зрізу 3 (AC-VENDOR-01…10): користувачі з роллю manager / admin / vendor, запуски «Apartment 12,
// move-in» і «Apartment 14, repair», прямі запити вендора від імені його сесії й читання стану задач.
// Усе, що створює цей файл, прибирає deleteUatUsers() з ./admin (користувачів, їхні запуски й призначення).
// Запуски створюють справжні функції бази: менеджер входить паролем і викликає launch_run — так само, як форма «New run».
// Секретний ключ (admin) — лише щоб створити користувача й прочитати стан поза RLS; паролі не друкуємо.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient, randomPassword, uatEmail } from "./admin";
import { tenantMoveInTemplate, type UatUser } from "./data";

export type UatRole = "manager" | "admin" | "vendor";

/** Синтетичний користувач із потрібною роллю: роль у profiles ставить лише service_role (так само, як users:demo). */
export async function createUatUser(suffix: string, role: UatRole): Promise<UatUser> {
  const supabase = adminClient();
  const email = uatEmail(suffix);
  const password = randomPassword();
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Не вдалося створити ${email}: ${error?.message ?? "порожня відповідь"}`);
  const { error: roleError } = await supabase
    .from("profiles")
    .upsert({ id: data.user.id, email, role }, { onConflict: "id" });
  if (roleError) throw new Error(`${email}: не вдалося поставити роль ${role}: ${roleError.message}`);
  const { data: profile, error: readError } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (readError) throw readError;
  if (profile?.role !== role) throw new Error(`${email}: очікували роль ${role}, а не ${profile?.role}`);
  return { id: data.user.id, email, password };
}

/** Клієнт, що діє від імені користувача (його токен, публічний ключ): так робить прямий запит у Data API. */
export async function userClient(user: UatUser): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishable) {
    throw new Error("Для прямих запитів UAT потрібні NEXT_PUBLIC_SUPABASE_URL і NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local)");
  }
  const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`Не вдалося увійти як ${user.email}: ${error.message}`);
  return client;
}

export type TemplateTask = { id: string; name: string; required: boolean; section: string };

/** Задачі знімка поточної версії «Tenant move-in» у порядку «секція за позицією, задача за позицією»: задачі 1…5 з AC. */
export async function templateTasks(): Promise<{ templateId: string; tasks: TemplateTask[] }> {
  const supabase = adminClient();
  const template = await tenantMoveInTemplate();
  const { data: version, error } = await supabase
    .from("templates")
    .select("current_version")
    .eq("id", template.id)
    .single();
  if (error) throw error;
  const { data: versionRow, error: versionError } = await supabase
    .from("template_versions")
    .select("id")
    .eq("template_id", template.id)
    .eq("version", version.current_version)
    .single();
  if (versionError) throw versionError;
  const { data: sections, error: sectionsError } = await supabase
    .from("template_version_sections")
    .select("id, name, position")
    .eq("version_id", versionRow.id)
    .order("position");
  if (sectionsError) throw sectionsError;
  const { data: tasks, error: tasksError } = await supabase
    .from("template_version_tasks")
    .select("id, name, required, position, section_id")
    .eq("version_id", versionRow.id);
  if (tasksError) throw tasksError;
  const ordered = (sections ?? []).flatMap((section) =>
    (tasks ?? [])
      .filter((task) => task.section_id === section.id)
      .sort((a, b) => a.position - b.position)
      .map((task) => ({ id: task.id, name: task.name, required: task.required, section: section.name })),
  );
  if (ordered.length !== 5) throw new Error(`«Tenant move-in» має ${ordered.length} задач замість 5 з AC`);
  return { templateId: template.id, tasks: ordered };
}

/** Менеджер входить паролем і запускає шаблон справжньою функцією бази; задачі `vendorTasks` (номери з 1) — вендору. */
export async function launchUatRun(
  manager: UatUser,
  caseName: string,
  assign?: { vendor: UatUser; taskNumbers: number[] },
): Promise<string> {
  const { templateId, tasks } = await templateTasks();
  const assignments = (assign?.taskNumbers ?? []).map((n) => ({
    template_task_id: tasks[n - 1].id,
    assignee_id: assign!.vendor.id,
  }));
  const client = await userClient(manager);
  const { data, error } = await client.rpc("launch_run", {
    p_template_id: templateId,
    p_case_name: caseName,
    p_assignments: assignments,
  });
  if (error || !data) throw new Error(`Не вдалося запустити «${caseName}»: ${error?.message ?? "порожня відповідь"}`);
  return data as string;
}

export type RunTaskState = { name: string; status: string; assigneeId: string };

/** Задачі запуску в порядку 1…5 (за секцією й позицією) зі статусом і виконавцем — читає секретний ключ, поза RLS. */
export async function runTasks(runId: string): Promise<RunTaskState[]> {
  const supabase = adminClient();
  const { data: sections, error } = await supabase.from("run_sections").select("id, position").eq("run_id", runId);
  if (error) throw error;
  const { data: tasks, error: tasksError } = await supabase
    .from("run_tasks")
    .select("id, name, status, assignee_id, position, section_id")
    .eq("run_id", runId);
  if (tasksError) throw tasksError;
  const sectionPosition = new Map((sections ?? []).map((s) => [s.id, s.position as number]));
  return (tasks ?? [])
    .sort(
      (a, b) =>
        (sectionPosition.get(a.section_id) ?? 0) - (sectionPosition.get(b.section_id) ?? 0) || a.position - b.position,
    )
    .map((t) => ({ name: t.name as string, status: t.status as string, assigneeId: t.assignee_id as string }));
}

/** Id задачі запуску за її номером (1…5). */
export async function runTaskId(runId: string, taskNumber: number): Promise<string> {
  const supabase = adminClient();
  const { data: sections, error } = await supabase.from("run_sections").select("id, position").eq("run_id", runId);
  if (error) throw error;
  const { data: tasks, error: tasksError } = await supabase
    .from("run_tasks")
    .select("id, position, section_id")
    .eq("run_id", runId);
  if (tasksError) throw tasksError;
  const sectionPosition = new Map((sections ?? []).map((s) => [s.id, s.position as number]));
  const ordered = (tasks ?? []).sort(
    (a, b) => (sectionPosition.get(a.section_id) ?? 0) - (sectionPosition.get(b.section_id) ?? 0) || a.position - b.position,
  );
  return ordered[taskNumber - 1].id as string;
}

/** Скільки запусків має користувач як менеджер запуску. */
export async function runsManagedBy(userId: string): Promise<number> {
  const { count, error } = await adminClient()
    .from("runs")
    .select("*", { count: "exact", head: true })
    .eq("manager_id", userId);
  if (error) throw error;
  return count ?? 0;
}

/** Запуски синтетичної пари «менеджер A + вендор V»: у першому V має задачі 3 і 4, у другому — жодної. */
export type VendorScenario = {
  managerA: UatUser;
  vendorV: UatUser;
  moveInRunId: string;
  repairRunId: string;
};

export async function createVendorScenario(label: string): Promise<VendorScenario> {
  const managerA = await createUatUser(`${label}-a`, "manager");
  const vendorV = await createUatUser(`${label}-v`, "vendor");
  const moveInRunId = await launchUatRun(managerA, "Apartment 12, move-in", { vendor: vendorV, taskNumbers: [3, 4] });
  const repairRunId = await launchUatRun(managerA, "Apartment 14, repair");
  return { managerA, vendorV, moveInRunId, repairRunId };
}
