import { isFallback, logLlmCall } from "./llm-log";
import type { Proposal } from "./parse";
import { PARSE_PROMPT_VERSION } from "./prompts/parse";

// Журнал llm.call для розбору документа (WS11, трек B): один рядок JSON на виклик моделі. У журнал іде лише те, що
// дозволяє схема з llm-log.ts: модель, затримка, токени, стан, fallback, версія промпту, id запиту, КОД причини.
// Тексту документа, промпту й відповіді моделі тут немає навіть у вигляді аргументів.

/** Куди писати llm.call. Немає — журналу немає (так працюють golden-тести й eval). */
export type ParseLog = { requestId: string; route: string; primaryModel: string };

type Answer = { modelId: string; inputTokens?: number; outputTokens?: number; cost?: unknown };

type Generated = {
  response: { modelId: string };
  usage: { inputTokens?: number; outputTokens?: number };
  providerMetadata?: Record<string, unknown>;
};

/** Що журналу треба з відповіді generateText: модель, токени й вартість від постачальника (для :free — 0). */
export function answerFrom(result: Generated): Answer {
  const cost = (result.providerMetadata?.openrouter as { usage?: { cost?: unknown } } | undefined)?.usage?.cost;
  return { modelId: result.response.modelId, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cost };
}

// Збій без відповіді моделі: журнал пише модель, що стояла першою в ланцюжку.
const NO_ANSWER: Answer = { modelId: "" };

export function logParseCall(log: ParseLog | undefined, started: number, proposal: Proposal, answer: Answer = NO_ANSWER): void {
  if (!log) return;
  const state = proposal.state === "ok" || proposal.state === "refused" ? proposal.state : "unavailable";
  const modelId = answer.modelId || log.primaryModel;
  logLlmCall({
    requestId: log.requestId,
    route: log.route,
    model: modelId,
    fallbackUsed: isFallback(modelId, log.primaryModel),
    state,
    latencyMs: performance.now() - started,
    inputTokens: answer.inputTokens,
    outputTokens: answer.outputTokens,
    costUsd: typeof answer.cost === "number" ? answer.cost : undefined,
    promptVersion: PARSE_PROMPT_VERSION,
    errorKind: proposal.state === "unavailable" ? proposal.reason : undefined,
  });
}
