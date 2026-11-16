import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { proposeValues } from "@/lib/ai/parse";
import { acceptance, judgeDescription, passRate } from "@/lib/ai/scorer";
import { buildReport, type Row } from "../evals/report";

// Опора живого eval (`npm run eval`, evals/golden.live.eval.ts): сам прогін ходить у мережу й не в CI, а ці частини
// — чиста логіка навколо нього — перевіряємо офлайн: частка успіху, звіт, суддя, зворотний виклик onResult.

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const modelSaying = (text: string, modelId = "mock-model") =>
  new MockLanguageModelV4({
    modelId,
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });

const REFUSED = JSON.stringify({
  status: "refused",
  documentType: null,
  request: null,
  estimate: null,
  injectionDetected: false,
  twoProblems: false,
  safetyNote: null,
});

const row = (over: Partial<Row>): Row => ({ run: 1, id: "GC-01", ac: "AC-DOCAI-01", modelId: "m", fields: true, pass: true, ...over });

describe("eval: частка успіху й звіт", () => {
  it("passRate рахує пройдені з усіх, а порожній набір дає 0 без ділення на нуль", () => {
    expect(passRate([{ pass: true }, { pass: false }, { pass: true }, { pass: true }])).toEqual({ passed: 3, total: 4, rate: 0.75 });
    expect(passRate([])).toEqual({ passed: 0, total: 0, rate: 0 });
  });

  it("звіт: NOT RUN не входить у частку успіху, а FAIL входить; видно, яка модель відповіла", () => {
    const report = buildReport(
      [
        row({ id: "GC-01" }),
        row({ id: "GC-02", ac: "—", pass: false, fields: false, why: "category: очікувалось | отримано" }),
        row({ id: "GC-03", ac: "—", modelId: "—", pass: false, notRun: true, why: "NOT RUN: 429" }),
      ],
      { runs: 1, cases: 3, stoppedAt: "GC-03, прогін 1", at: new Date("2026-11-16T12:00:00Z") },
    );

    expect(report).toContain("**Частка успіху: 1/2 (50%)**");
    expect(report).toContain("Не запущено (NOT RUN): 1 — ліміт 429, зупинено на: GC-03, прогін 1");
    expect(report).toContain("| `m` | 1 | 2 |");
    expect(report).toContain("NOT RUN |");
    expect(report).not.toContain("очікувалось | отримано"); // «|» у причині не ламає таблицю
  });
});

describe("eval: поріг приймання PM", () => {
  const ids = Array.from({ length: 10 }, (_, i) => `GC-${String(i + 1).padStart(2, "0")}`);
  const run = (failing: string[]) => ids.map((id) => ({ id, pass: !failing.includes(id) }));

  it("8 з 10 і кейси 9 та 10 пройшли — прийнято (кейси 2 і 3 можуть не пройти)", () => {
    expect(acceptance(run(["GC-02", "GC-03"]))).toMatchObject({ passed: 8, total: 10, accepted: true, mustFail: [] });
  });

  it("7 з 10 — не прийнято навіть коли кейси 9 і 10 пройшли", () => {
    expect(acceptance(run(["GC-01", "GC-02", "GC-03"]))).toMatchObject({ passed: 7, accepted: false, mustFail: [] });
  });

  it("кейс 9 або 10 не пройшов — не прийнято, навіть коли решта 8 пройшли", () => {
    expect(acceptance(run(["GC-09", "GC-01"]))).toMatchObject({ passed: 8, accepted: false, mustFail: ["GC-09"] });
    expect(acceptance(run(["GC-10"]))).toMatchObject({ passed: 9, accepted: false, mustFail: ["GC-10"] });
  });

  it("звіт показує поріг PM і «НЕ прийнято», якщо обов'язковий кейс не пройшов", () => {
    const rows = ids.map((id) => row({ id, pass: id !== "GC-10" }));
    const report = buildReport(rows, { runs: 1, cases: 10, at: new Date("2026-11-16T12:00:00Z") });

    expect(report).toContain("Поріг PM (прогін 1): 9 з 10");
    expect(report).toContain("кейси 9 і 10: не пройшли GC-10");
    expect(report).toContain("НЕ прийнято");
  });
});

describe("eval: суддя й зворотний виклик", () => {
  it("суддя отримує rubric і опис як дані між тегами й повертає вердикт із причиною", async () => {
    const model = modelSaying('{"pass":true,"reason":"mentions the leak"}', "judge");

    const verdict = await judgeDescription(model, "Says the tap leaks", "Kitchen tap leaks");

    expect(verdict).toEqual({ pass: true, reason: "mentions the leak" });
    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(prompt).toContain("<rubric>");
    expect(prompt).toContain("Kitchen tap leaks");
  });

  it("proposeValues повідомляє onResult, яка модель відповіла й що повернула (для звіту й recorded.json)", async () => {
    const seen: { modelId: string; status: string }[] = [];

    const proposal = await proposeValues("Tonight's menu", modelSaying(REFUSED), {
      onResult: ({ modelId, output }) => seen.push({ modelId, status: output.status }),
    });

    expect(proposal.state).toBe("refused");
    expect(seen).toEqual([{ modelId: "mock-model", status: "refused" }]);
  });

  it("proposeValues передає в onFailure причину збою (відповідь не за схемою), а користувач бачить лише недоступність", async () => {
    const failures: unknown[] = [];

    const proposal = await proposeValues("x", modelSaying('{"status":"ok","documentType":"dragons"}'), {
      onFailure: (error) => failures.push(error),
    });

    expect(proposal).toMatchObject({ state: "unavailable", reason: "invalid_output" });
    expect(failures).toHaveLength(1);
  });
});
