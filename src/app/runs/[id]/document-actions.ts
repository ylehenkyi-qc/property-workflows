"use server";

import { runConfirm, runPropose, type ConfirmResult, type ProposeResult } from "@/lib/ai/document-flow";
import { productModel } from "@/lib/ai/openrouter";
import { requireRole } from "@/lib/auth/require-role";

// AI-розбір документа в запуску (AC-DOCAI-01…12): тонкі обгортки над src/lib/ai/document-flow.ts.
//  - proposeDocumentValues лише ПРОПОНУЄ: нічого не пише в базу (AC-DOCAI-08);
//  - confirmDocumentValues пише ПІСЛЯ дії людини: повторна валідація, запис під сесією користувача (RLS).
// Обидві дії починаються з requireRole: getClaims() перевіряє JWT (getSession() не використовуємо), роль — з profiles.role;
// лише manager і admin (робоче рішення до solomchaak/property-workflows-spec#53, варіант A).

export async function proposeDocumentValues(runId: string, text: string): Promise<ProposeResult> {
  const auth = await requireRole(["manager", "admin"]);
  // productModel() лише збирає об'єкт моделі (без мережі); немає ключа — null, і користувач бачить «недоступний».
  return runPropose(auth, runId, text, auth.status === "ok" ? productModel() : null);
}

export async function confirmDocumentValues(runId: string, kind: string, values: unknown): Promise<ConfirmResult> {
  return runConfirm(await requireRole(["manager", "admin"]), runId, kind, values);
}
