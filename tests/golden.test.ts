import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { proposeValues } from "@/lib/ai/parse";
import { PARSE_PROMPT_VERSION } from "@/lib/ai/prompts/parse";
import { scoreProposal, type GoldenCase } from "@/lib/ai/scorer";
import casesJson from "./fixtures/golden/cases.json";
import recordedJson from "./fixtures/golden/recorded.json";

// Офлайн-реплей 10 golden cases PM (solomchaak/property-workflows-spec#40), тимчасових, від розробника: вимоги PM зрізу 4
// немає на 2026-11-15, тож AC-DOCAI-NN — наші. Без мережі й без ключа, тож працює в CI (`npm test`, job `app`).
// Перевіряє КОД навколо моделі (промпт з межею <document>, схема, правила з коду, оцінювач), а НЕ якість моделі:
// відповіді моделі беруться з tests/fixtures/golden/recorded.json, а справжні записує `RECORD=1 npm run eval`.
// Кейс → AC: 1→01, 2→02, 3→10, 4→03, 5→11, 6→12, 7→04, 8→05, 9→06, 10→07.

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
const cases = casesJson as GoldenCase[];
const recorded = recordedJson as Record<string, Recording>;

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

// Модель, що «відповідає» записаним текстом.
function replay(text: string, modelId: string) {
  return new MockLanguageModelV4({
    modelId,
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

// Повертає розбіжності з очікуваним (порожній масив — збіг) і перевіряє, що недовірений вхід дійшов до моделі як дані.
async function replayCase(c: GoldenCase): Promise<string[]> {
  const rec = recorded[c.id];
  if (!rec) return [`немає запису для ${c.id} у recorded.json`];
  const model = replay(rec.text, rec.modelId);
  const { mismatches } = scoreProposal(c.expected, await proposeValues(c.input, model));
  // Недовірений вхід дійшов до моделі загорнутим як дані (AC-DOCAI-07).
  const wrapped = JSON.stringify(model.doGenerateCalls[0].prompt).includes("<document>");
  return wrapped ? mismatches : [...mismatches, "вхід не загорнуто в <document>"];
}

// Назва тесту починається з літерального AC ID: шаблонний рядок чи $ac ac:coverage не зарахує, тож по одному it.each на AC.
const only = (id: string) => cases.filter((c) => c.id === id);

describe("golden cases, офлайн-реплей", () => {
  it.each(only("GC-01"))("AC-DOCAI-01: golden $id (чітка заявка)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-02"))("AC-DOCAI-02: golden $id (аварія)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-04"))("AC-DOCAI-03: golden $id (немає телефону)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-07"))("AC-DOCAI-04: golden $id (кошторис зі збіжною сумою)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-08"))("AC-DOCAI-05: golden $id (кошторис із розбіжною сумою)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-09"))("AC-DOCAI-06: golden $id (не заявка й не кошторис)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-10"))("AC-DOCAI-07: golden $id (інструкція всередині листа)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-03"))("AC-DOCAI-10: golden $id (транскрипт дзвінка)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-05"))("AC-DOCAI-11: golden $id (дві проблеми)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-06"))("AC-DOCAI-12: golden $id (запах газу)", async (c) => expect(await replayCase(c)).toEqual([]));
});

describe("golden cases, цілісність набору", () => {
  it("кожен golden case має запис, записаний поточною версією промпту", () => {
    expect(cases.map((c) => c.id).filter((id) => !recorded[id])).toEqual([]);
    // Змінили PARSE_PROMPT_VERSION — перезапишіть записи живим прогоном (`RECORD=1 npm run eval`).
    const stale = Object.entries(recorded)
      .filter(([, r]) => r.promptVersion !== PARSE_PROMPT_VERSION)
      .map(([id]) => id);
    expect(stale).toEqual([]);
  });

  it("10 кейсів PM, кожен позначений як тимчасовий від розробника й прив'язаний до окремого AC", () => {
    expect(cases).toHaveLength(10);
    expect(new Set(cases.map((c) => c.ac)).size).toBe(10);
    for (const c of cases) expect(c.source).toContain("тимчасовий, від розробника");
  });

  it("кожен кейс із rubric — заявка: суддя оцінює лише вільний текст опису", () => {
    for (const c of cases.filter((x) => x.rubric)) expect(c.expected.kind).toBe("request");
  });

  it("оцінювач ловить розбіжність: інша категорія й зайва примітка дають mismatches", async () => {
    const wrong = replay(
      JSON.stringify({
        status: "ok",
        documentType: "request",
        request: { phone: "555-0101", description: "x", category: "electrical", urgency: "not urgent" },
        estimate: null,
        injectionDetected: true,
        twoProblems: false,
        safetyNote: null,
      }),
      "wrong",
    );
    const score = scoreProposal(cases[0].expected, await proposeValues(cases[0].input, wrong));

    expect(score.pass).toBe(false);
    expect(score.mismatches.join("\n")).toContain("category");
    expect(score.mismatches.join("\n")).toContain("зайві примітки");
  });
});
