import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { proposeValues } from "@/lib/ai/parse";
import { PARSE_PROMPT_VERSION } from "@/lib/ai/prompts/parse";
import { scoreProposal, type GoldenCase } from "@/lib/ai/scorer";
import casesJson from "./fixtures/golden/cases.json";
import recordedJson from "./fixtures/golden/recorded.json";

// Офлайн-реплей 10 golden cases PM (solomchaak/property-workflows-spec#40), за вимогою PM solomchaak/property-workflows-spec#59 (AC-DOCAI-01…16). Без мережі й без ключа, тож працює в CI (`npm test`, job `app`).
// Перевіряє КОД навколо моделі (промпт з межею <document>, схема, правила з коду, оцінювач), а НЕ якість моделі:
// відповіді моделі беруться з tests/fixtures/golden/recorded.json, а справжні записує `RECORD=1 npm run eval`.
// Кейс → AC: 1→01, 7→02, 4→06, 5→07, 8→08, 9→09, 10→10; кейси 2, 3, 6 окремого AC не мають. Поріг PM: 8 з 10, кейси 9 і 10 завжди.

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
  it.each(only("GC-07"))("AC-DOCAI-02: golden $id (кошторис зі збіжною сумою)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-04"))("AC-DOCAI-06: golden $id (немає телефону)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-05"))("AC-DOCAI-07: golden $id (дві проблеми)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-08"))("AC-DOCAI-08: golden $id (кошторис із розбіжною сумою)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-09"))("AC-DOCAI-09: golden $id (не заявка й не кошторис)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-10"))("AC-DOCAI-10: golden $id (інструкція всередині листа)", async (c) => expect(await replayCase(c)).toEqual([]));
  // Кейси без окремого AC у вимозі PM (solomchaak/property-workflows-spec#59): лише оцінка якості, входять у поріг 8 з 10.
  it.each(only("GC-02"))("golden-кейс 2 (без окремого AC): $id (аварія)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-03"))("golden-кейс 3 (без окремого AC): $id (транскрипт дзвінка)", async (c) => expect(await replayCase(c)).toEqual([]));
  it.each(only("GC-06"))("golden-кейс 6 (без окремого AC): $id (запах газу)", async (c) => expect(await replayCase(c)).toEqual([]));
});

describe("golden cases, цілісність набору", () => {
  it("кожен golden case має запис, записаний поточною версією промпту", () => {
    expect(cases.map((c) => c.id).filter((id) => !recorded[id])).toEqual([]);
    // Змінили PARSE_PROMPT_VERSION — перезапишіть записи живим прогоном (`RECORD=1 npm run eval`).
    // Заглушки (modelId "hand-written-stub") — не відповіді моделі: версія промпту їх не стосується; ці AC лишаються «відкладено».
    const stale = Object.entries(recorded)
      .filter(([, r]) => r.modelId !== "hand-written-stub" && r.promptVersion !== PARSE_PROMPT_VERSION)
      .map(([id]) => id);
    expect(stale).toEqual([]);
  });

  it("10 кейсів PM: сім прив'язані до окремих AC вимоги PM, три (2, 3, 6) — лише для оцінки якості", () => {
    expect(cases).toHaveLength(10);
    const withAc = cases.filter((c) => c.ac).map((c) => c.ac);
    expect(new Set(withAc).size).toBe(7);
    expect(withAc.sort()).toEqual(["AC-DOCAI-01", "AC-DOCAI-02", "AC-DOCAI-06", "AC-DOCAI-07", "AC-DOCAI-08", "AC-DOCAI-09", "AC-DOCAI-10"]);
    for (const c of cases) expect(c.source).toContain("solomchaak/property-workflows-spec#40");
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
