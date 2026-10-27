"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { loginPath } from "@/lib/auth/safe-next";
import type { DraftContent } from "@/lib/templates/draft";
import {
  DRAFT_NOT_SAVED,
  NOT_ENOUGH_RIGHTS,
  publishErrorMessage,
  SIGN_IN_TO_CONTINUE,
} from "@/lib/templates/messages";

export type SaveResult = { ok: true } | { ok: false; error: string };
export type PublishResult = { ok: true; version: number } | { ok: false; error: string };

// Кожна дія починається з requireRole("admin"): без входу чи без ролі до rpc справа не доходить. Саме право на запис
// гарантує база (функції create_template, save_template_draft, publish_template перевіряють роль першим рядком;
// AC-EDITOR-08), тут — зрозуміла відмова й ранній вихід.

// Новий шаблон: лише ім'я, далі — у редактор.
export async function createTemplate(formData: FormData) {
  const auth = await requireRole("admin");
  if (auth.status === "unauthenticated") redirect(loginPath("/templates"));
  if (auth.status === "forbidden") redirect("/templates?error=forbidden");

  const { data: id, error } = await auth.supabase.rpc("create_template", {
    p_name: String(formData.get("name") ?? ""),
  });
  if (error || !id) redirect("/templates?error=create_failed");

  revalidatePath("/templates");
  redirect(`/templates/${id}/edit`);
}

// Автозбереження (AC-EDITOR-01): замінює робочу копію повним вмістом, версію не створює.
export async function saveTemplateDraft(templateId: string, content: DraftContent): Promise<SaveResult> {
  const auth = await requireRole("admin");
  if (auth.status === "unauthenticated") return { ok: false, error: SIGN_IN_TO_CONTINUE };
  if (auth.status === "forbidden") return { ok: false, error: NOT_ENOUGH_RIGHTS };

  const { error } = await auth.supabase.rpc("save_template_draft", {
    p_template_id: templateId,
    p_content: content,
  });
  if (error) return { ok: false, error: error.code === "42501" ? NOT_ENOUGH_RIGHTS : DRAFT_NOT_SAVED };
  return { ok: true };
}

// Збереження версії (AC-EDITOR-03, AC-EDITOR-04): правило «є обов'язкова задача» перевіряє publish_template.
export async function publishTemplate(templateId: string): Promise<PublishResult> {
  const auth = await requireRole("admin");
  if (auth.status === "unauthenticated") return { ok: false, error: SIGN_IN_TO_CONTINUE };
  if (auth.status === "forbidden") return { ok: false, error: NOT_ENOUGH_RIGHTS };

  const { data: version, error } = await auth.supabase.rpc("publish_template", { p_template_id: templateId });
  if (error || version == null) return { ok: false, error: publishErrorMessage(error ?? {}) };

  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}`, "layout");
  return { ok: true, version };
}
