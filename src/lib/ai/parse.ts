import { APICallError, NoObjectGeneratedError, Output, RetryError, generateText, type LanguageModel } from "ai";
import { PARSE_INSTRUCTIONS, wrapDocument } from "./prompts/parse";
import { ParseSchema, type Category, type ParseOutput, type Urgency } from "./schema";

// Чиста функція: модель передають параметром (застосунок — src/lib/ai/openrouter.ts, тести — MockLanguageModelV4).
// Тут немає `import "server-only"` і process.env, тож Vitest може імпортувати файл. Модель лише пропонує: нічого не пишемо
// в базу (AC-DOCAI-08); тексти відмови, приміток і попереджень та сума кошторису — у коді, а не в промпті.

// Тексти — дослівно з golden cases PM (solomchaak/property-workflows-spec#40) і робочі рішення Q26/Q28 (варіант A).
export const REFUSED_MESSAGE = "This document is not a maintenance request or an estimate.";
export const UNAVAILABLE_MESSAGE = "The assistant is not available now. Fill in the values yourself.";
export const INJECTION_NOTE = "the text contains instructions to the AI that were ignored";
export const TWO_PROBLEMS_NOTE = "the email has two problems";
export const EMPTY_MESSAGE = "Paste the text of a document"; // AC-DOCAI-11

export type UnavailableReason = "no_key" | "rate_limited" | "timeout" | "invalid_output" | "provider_error";
export type RequestField = "phone" | "description" | "category" | "urgency";

export type RequestValues = {
  phone: string | null;
  description: string | null;
  category: Category | null;
  urgency: Urgency | null;
};
export type EstimateItem = { name: string; quantity: number; unitPrice: number };

export type Proposal =
  | { state: "ok"; kind: "request"; request: RequestValues; notFound: RequestField[]; notes: string[]; warnings: string[] }
  | { state: "ok"; kind: "estimate"; items: EstimateItem[]; total: number | null; notes: string[]; warnings: string[] }
  | { state: "refused"; message: string; notes: string[] }
  | { state: "empty"; message: string }
  | { state: "unavailable"; reason: UnavailableReason; message: string };

// onResult — лише для живого eval: яка модель з ланцюжка відповіла й що вона повернула (для звіту й запису в recorded.json).
export type ParseOptions = {
  maxRetries?: number;
  timeoutMs?: number;
  onResult?: (info: { modelId: string; output: ParseOutput }) => void;
  // Лише для eval: що саме пішло не так (відповідь не за схемою тощо), бо користувач бачить лише UNAVAILABLE_MESSAGE.
  onFailure?: (error: unknown) => void;
};

const unavailable = (reason: UnavailableReason): Proposal => ({ state: "unavailable", reason, message: UNAVAILABLE_MESSAGE });

const cents = (n: number) => Math.round(n * 100);

// AC-DOCAI-05: суму рядків рахує код, а не модель; цифри документа не виправляємо, лише попереджаємо про різницю.
export function totalWarning(items: EstimateItem[], total: number | null): string | null {
  if (total === null) return null;
  const sum = items.reduce((acc, i) => acc + cents(i.quantity * i.unitPrice), 0);
  if (sum === cents(total)) return null;
  return `items add up to ${(sum / 100).toFixed(2)}, the stated total is ${total.toFixed(2)}`;
}

const REQUEST_FIELDS: RequestField[] = ["phone", "description", "category", "urgency"];

function interpretRequest(out: ParseOutput, notes: string[]): Proposal | null {
  if (out.documentType !== "request" || !out.request) return null;
  const request: RequestValues = {
    phone: out.request.phone?.trim() || null,
    description: out.request.description?.trim() || null,
    category: out.request.category,
    urgency: out.request.urgency,
  };
  // AC-DOCAI-03: порожнє поле позначаємо «not found», значення не вигадуємо.
  const notFound = REQUEST_FIELDS.filter((f) => request[f] === null);
  if (out.twoProblems) notes.push(TWO_PROBLEMS_NOTE); // AC-DOCAI-11
  if (out.safetyNote?.trim()) notes.push(out.safetyNote.trim()); // AC-DOCAI-12
  return { state: "ok", kind: "request", request, notFound, notes, warnings: [] };
}

function interpretEstimate(out: ParseOutput, notes: string[]): Proposal | null {
  if (out.documentType !== "estimate" || !out.estimate || out.estimate.items.length === 0) return null;
  const { items, total } = out.estimate;
  const warning = totalWarning(items, total);
  return { state: "ok", kind: "estimate", items, total, notes, warnings: warning ? [warning] : [] };
}

// Перетворює відповідь моделі, вже перевірену за схемою, на пропозицію для людини. Невідповідність типу документа
// і його даних — відповідь не за очікуваною формою (invalid_output): «майже пропозицію» не показуємо (AC-DOCAI-09).
export function interpret(out: ParseOutput): Proposal {
  const notes: string[] = [];
  if (out.injectionDetected) notes.push(INJECTION_NOTE); // AC-DOCAI-07
  // AC-DOCAI-06: відмова — жодних значень, лише повідомлення.
  if (out.status === "refused") return { state: "refused", message: REFUSED_MESSAGE, notes };
  return interpretRequest(out, notes) ?? interpretEstimate(out, notes) ?? unavailable("invalid_output");
}

// Будь-який збій виклику моделі — стан unavailable, а не виняток (AC-DOCAI-09): ручна форма працює далі.
export async function proposeValues(text: string, model: LanguageModel | null, opts: ParseOptions = {}): Promise<Proposal> {
  // AC-DOCAI-11: порожній текст чи самі пробіли — повідомлення без звернення до моделі й без значень.
  if (!text.trim()) return { state: "empty", message: EMPTY_MESSAGE };
  if (!model) return unavailable("no_key");

  try {
    const result = await generateText({
      model,
      instructions: PARSE_INSTRUCTIONS,
      messages: [{ role: "user", content: [{ type: "text", text: wrapDocument(text) }] }],
      output: Output.object({ name: "document_values", schema: ParseSchema }),
      temperature: 0,
      // На безкоштовному тарифі повтор витрачає той самий денний ліміт: 0–1, не типові 2.
      maxRetries: opts.maxRetries ?? 1,
      timeout: opts.timeoutMs ?? 45_000,
    });
    opts.onResult?.({ modelId: result.response.modelId, output: result.output });
    return interpret(result.output);
  } catch (error) {
    opts.onFailure?.(error);
    return unavailable(classifyFailure(error));
  }
}

// OpenRouter може відповісти HTTP 200 з тілом помилки: тоді код ліміту лежить у data.code.
function isRateLimit(cause: unknown): boolean {
  if (!APICallError.isInstance(cause)) return false;
  const code = cause.statusCode === 200 ? (cause.data as { code?: unknown } | undefined)?.code : cause.statusCode;
  return code === 429 || code === "429";
}

const isTimeout = (cause: unknown) => cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError");

// Причина лише для журналу й тестів; користувач у будь-якому разі бачить UNAVAILABLE_MESSAGE.
export function classifyFailure(error: unknown): UnavailableReason {
  // Після повторів AI SDK загортає останню помилку в RetryError — спершу розгортаємо.
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (NoObjectGeneratedError.isInstance(cause)) return "invalid_output";
  if (isRateLimit(cause)) return "rate_limited";
  return isTimeout(cause) ? "timeout" : "provider_error";
}
