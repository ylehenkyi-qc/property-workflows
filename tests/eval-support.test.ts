import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { proposeValues } from "@/lib/ai/parse";
import { judgeDescription, passRate } from "@/lib/ai/scorer";
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
        row({ id: "GC-02", ac: "AC-DOCAI-02", pass: false, fields: false, why: "category: очікувалось | отримано" }),
        row({ id: "GC-03", ac: "AC-DOCAI-10", modelId: "—", pass: false, notRun: true, why: "NOT RUN: 429" }),
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
});
