import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleCheck } from "@/lib/auth/require-role";
import { runConfirm, runPropose } from "./document-flow";

// Межі дій AI-розбору: сесія й роль, право на запуск ДО виклику моделі, «нічого не пишемо без людини» (AC-DOCAI-08) і «помічник
// недоступний» (AC-DOCAI-09). Сесію й клієнт Supabase передаємо параметром (як їх дає requireRole), модель — теж.
const rpc = vi.fn();
const from = vi.fn();
const insert = vi.fn();

type OkAuth = Extract<RoleCheck, { status: "ok" }>;
const managerAuth = { status: "ok", userId: "u1", role: "manager", supabase: { rpc, from } } as unknown as OkAuth;

const RUN_ID = "c0000000-0000-4000-8000-000000000003";
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const modelSaying = (out: unknown) =>
  new MockLanguageModelV4({
    modelId: "mock",
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(out) }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });

const okOutput = {
  status: "ok",
  documentType: "request",
  request: { phone: "555-0101", description: "Kitchen tap dripping", category: "plumbing", urgency: "not urgent" },
  estimate: null,
  injectionDetected: false,
  twoProblems: false,
  safetyNote: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  from.mockReturnValue({ insert });
  insert.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: true, error: null });
});

describe("runPropose", () => {
  it("AC-DOCAI-08: пропозиція нічого не пише в базу — лише повертає її користувачу", async () => {
    const model = modelSaying(okOutput);

    const result = await runPropose(managerAuth, RUN_ID, "My phone is 555-0101", model);

    expect(result).toMatchObject({ status: "ok", proposal: { state: "ok", kind: "request", request: { phone: "555-0101" } } });
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(from).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("без входу: відмова, перевірка запуску, модель і запис не викликаються", async () => {
    const model = modelSaying(okOutput);
    expect(await runPropose({ status: "unauthenticated" }, RUN_ID, "x", model)).toEqual({ status: "unauthenticated" });
    expect(rpc).not.toHaveBeenCalled();
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(insert).not.toHaveBeenCalled();
  });

  it("вендор (роль не з переліку): відмова до виклику моделі", async () => {
    const model = modelSaying(okOutput);
    expect(await runPropose({ status: "forbidden", role: "vendor" }, RUN_ID, "x", model)).toEqual({ status: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("запуск іншого менеджера: відмова ДО виклику моделі, ліміт ключа не витрачається", async () => {
    const model = modelSaying(okOutput);
    rpc.mockResolvedValue({ data: false, error: null });

    expect(await runPropose(managerAuth, RUN_ID, "x", model)).toEqual({ status: "forbidden" });
    expect(rpc).toHaveBeenCalledWith("can_manage_run", { p_run_id: RUN_ID });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("помилка перевірки запуску (rpc без даних) — теж відмова, а не виклик моделі", async () => {
    const model = modelSaying(okOutput);
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    expect(await runPropose(managerAuth, RUN_ID, "x", model)).toEqual({ status: "forbidden" });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("AC-DOCAI-09: немає ключа (модель null) — стан «недоступний», запису немає", async () => {
    const result = await runPropose(managerAuth, RUN_ID, "My phone is 555-0101", null);

    expect(result).toEqual({
      status: "ok",
      proposal: { state: "unavailable", reason: "no_key", message: "The assistant is not available now. Fill in the values yourself." },
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-06: документ не заявка й не кошторис — відмова з повідомленням, без запису", async () => {
    const model = modelSaying({ ...okOutput, status: "refused", documentType: null, request: null });

    const result = await runPropose(managerAuth, RUN_ID, "Tonight's menu: tomato soup 6.50", model);

    expect(result).toMatchObject({
      status: "ok",
      proposal: { state: "refused", message: "This document is not a maintenance request or an estimate." },
    });
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("runConfirm", () => {
  const confirmed = { phone: "555-0101", description: "Kitchen tap dripping", category: "plumbing", urgency: "urgent" };

  it("AC-DOCAI-08: зберігає саме значення, які підтвердив користувач (виправлене «urgent»), а не пропозицію моделі", async () => {
    const result = await runConfirm(managerAuth, RUN_ID, "request", confirmed);

    expect(result).toEqual({ status: "saved" });
    expect(from).toHaveBeenCalledWith("run_document_values");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({ run_id: RUN_ID, kind: "request", values: confirmed });
  });

  it("AC-DOCAI-08: порожній рядок форми зберігається як null, пробіли обрізаються; кошторис зберігається як є", async () => {
    await runConfirm(managerAuth, RUN_ID, "request", { ...confirmed, phone: "  ", description: "  Tap  " });
    expect(insert).toHaveBeenLastCalledWith({
      run_id: RUN_ID,
      kind: "request",
      values: { ...confirmed, phone: null, description: "Tap" },
    });

    const estimate = { items: [{ name: "Labour", quantity: 2, unitPrice: 60 }], total: 120 };
    expect(await runConfirm(managerAuth, RUN_ID, "estimate", estimate)).toEqual({ status: "saved" });
    expect(insert).toHaveBeenLastCalledWith({ run_id: RUN_ID, kind: "estimate", values: estimate });
  });

  it.each([
    ["категорія не з переліку", "request", { ...confirmed, category: "dragons" }],
    ["терміновість не з переліку", "request", { ...confirmed, urgency: "asap" }],
    ["зайве поле", "request", { ...confirmed, isAdmin: true }],
    ["занадто довгий опис", "request", { ...confirmed, description: "x".repeat(301) }],
    ["кошторис без рядків", "estimate", { items: [], total: 10 }],
    ["від'ємна ціна", "estimate", { items: [{ name: "a", quantity: 1, unitPrice: -5 }], total: null }],
    ["невідомий вид документа", "menu", confirmed],
    ["значення — не об'єкт", "request", "555-0101"],
    ["значення — null", "request", null],
  ])("AC-DOCAI-08: %s — повторна валідація відхиляє, нічого не записано", async (_name, kind, values) => {
    expect(await runConfirm(managerAuth, RUN_ID, kind, values)).toEqual({ status: "invalid" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("без входу чи вендор: відмова, нічого не записано", async () => {
    expect(await runConfirm({ status: "unauthenticated" }, RUN_ID, "request", confirmed)).toEqual({ status: "unauthenticated" });
    expect(await runConfirm({ status: "forbidden", role: "vendor" }, RUN_ID, "request", confirmed)).toEqual({ status: "forbidden" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("відмова бази (RLS: чужий запуск) — помилка, а не «збережено»", async () => {
    insert.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });
    expect(await runConfirm(managerAuth, RUN_ID, "request", confirmed)).toEqual({ status: "error" });
  });
});
