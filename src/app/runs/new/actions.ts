"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSelfAssignee } from "@/lib/runs/assignees";
import { launchErrorCode, type LaunchErrorCode } from "@/lib/runs/launchErrors";
import { validateCaseName } from "@/lib/runs/validateCaseName";

const ASSIGNEE_FIELD = /^assignee_([0-9a-f-]{36})$/i;

function backToForm(templateId: string, error: LaunchErrorCode): never {
  const query = new URLSearchParams({ template: templateId, error });
  redirect(`/runs/new?${query.toString()}`);
}

// Запуск шаблону для випадку (AC-RUN-01…09). Правила гарантує launch_run у базі; тут — авторизація,
// перевірка назви для зручності форми й збирання призначень (виконавець за замовчуванням — «me», тобто без запису).
export async function launchRun(formData: FormData) {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect("/login");
  }

  const templateId = String(formData.get("template_id") ?? "");
  const checked = validateCaseName(String(formData.get("case_name") ?? ""));
  if (!checked.ok) {
    backToForm(templateId, launchErrorCode(checked.error));
  }

  const assignments: { template_task_id: string; assignee_id: string }[] = [];
  for (const [field, value] of formData.entries()) {
    const match = ASSIGNEE_FIELD.exec(field);
    if (match && typeof value === "string" && !isSelfAssignee(value)) {
      assignments.push({ template_task_id: match[1], assignee_id: value });
    }
  }

  const { data: runId, error } = await supabase.rpc("launch_run", {
    p_template_id: templateId,
    p_case_name: checked.value,
    p_assignments: assignments,
  });

  if (error || !runId) {
    backToForm(templateId, launchErrorCode(error?.message ?? ""));
  }

  redirect(`/runs/${runId}`);
}
