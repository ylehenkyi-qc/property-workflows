"use server";

import { revalidatePath } from "next/cache";
import { runConfirm, runPropose, type ConfirmResult, type ProposeResult } from "@/lib/ai/document-flow";
import { productModel } from "@/lib/ai/openrouter";
import { requireRole } from "@/lib/auth/require-role";

// AI-розбір документа в запуску (AC-DOCAI-01…16): тонкі обгортки над src/lib/ai/document-flow.ts.
//  - proposeDocumentValues лише ПРОПОНУЄ: нічого не пише в базу (AC-DOCAI-01);
//  - confirmDocumentValues пише ПІСЛЯ дії людини: повторна валідація, запис під сесією користувача (RLS), потім сторінка запуску
//    оновлюється й показує збережений запис (AC-DOCAI-04).
// Обидві дії починаються з requireRole: getClaims() перевіряє JWT (getSession() не використовуємо), роль — з profiles.role;
// лише manager і admin, а право на конкретний запуск перевіряє база: вендор чи не-менеджер запуску дістає відмову (AC-DOCAI-16).

export async function proposeDocumentValues(runId: string, text: string): Promise<ProposeResult> {
  const auth = await requireRole(["manager", "admin"]);
  // productModel() лише збирає об'єкт моделі (без мережі); немає ключа — null, і користувач бачить «недоступний».
  return runPropose(auth, runId, text, auth.status === "ok" ? productModel() : null);
}

export async function confirmDocumentValues(runId: string, kind: string, values: unknown): Promise<ConfirmResult> {
  const result = await runConfirm(await requireRole(["manager", "admin"]), runId, kind, values);
  if (result.status === "saved") revalidatePath(`/runs/${runId}`);
  return result;
}
