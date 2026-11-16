import type { LanguageModel } from "ai";
import type { RoleCheck } from "@/lib/auth/require-role";
import type { Json } from "@/lib/supabase/database.types";
import { parseConfirmed } from "./confirm";
import { proposeValues, type Proposal } from "./parse";

// Логіка двох дій AI-розбору документа (AC-DOCAI-01…12). Сесію (RoleCheck) і модель дає викликач: так її тестують без
// моків власних модулів, а «use server»-файл лишається тонкою обгорткою. Права тримає база; тут — відмова заради
// зрозумілого результату й «нічого не пишемо без людини» (AC-DOCAI-08).

export type ProposeResult = { status: "ok"; proposal: Proposal } | { status: "unauthenticated" } | { status: "forbidden" };

export type ConfirmResult =
  | { status: "saved" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "invalid" }
  | { status: "error" };

async function canManageRun(supabase: Extract<RoleCheck, { status: "ok" }>["supabase"], runId: string): Promise<boolean> {
  const { data } = await supabase.rpc("can_manage_run", { p_run_id: String(runId) });
  return data === true;
}

// Лише ПРОПОНУЄ: нічого не пише в базу (AC-DOCAI-08). Спершу роль, потім — що користувач керує саме цим запуском, і
// лише тоді викликаємо модель: чужий менеджер не витрачає ліміт ключа. Немає ключа (model = null) — стан «недоступний»
// (AC-DOCAI-09).
export async function runPropose(auth: RoleCheck, runId: string, text: string, model: LanguageModel | null): Promise<ProposeResult> {
  if (auth.status === "unauthenticated") return { status: "unauthenticated" };
  if (auth.status === "forbidden") return { status: "forbidden" };

  if (!(await canManageRun(auth.supabase, runId))) return { status: "forbidden" };

  return { status: "ok", proposal: await proposeValues(String(text ?? ""), model) };
}

// Пише ПІСЛЯ дії людини: повторна валідація значень, запис під сесією користувача. author_id база бере з auth.uid(), а право
// писати в цей запуск перевіряє політика RLS (AC-DOCAI-08).
export async function runConfirm(auth: RoleCheck, runId: string, kind: string, values: unknown): Promise<ConfirmResult> {
  if (auth.status === "unauthenticated") return { status: "unauthenticated" };
  if (auth.status === "forbidden") return { status: "forbidden" };

  // AC-DOCAI-16: не менеджер цього запуску (і не адміністратор) дістає «Not enough rights» ще до перевірки значень; RLS таблиці
  // лишається останнім бар'єром, якщо цю перевірку обійдено.
  if (!(await canManageRun(auth.supabase, runId))) return { status: "forbidden" };

  const confirmed = parseConfirmed(kind, values);
  if (!confirmed.ok) return { status: "invalid" };

  const { error } = await auth.supabase
    .from("run_document_values")
    .insert({ run_id: String(runId), kind: confirmed.kind, values: confirmed.values as Json });
  return error ? { status: "error" } : { status: "saved" };
}
