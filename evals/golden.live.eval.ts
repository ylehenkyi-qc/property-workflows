import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JUDGE_MODEL, makeJudgeModel, makeProductModel } from "@/lib/ai/models";
import { proposeValues, type Proposal } from "@/lib/ai/parse";
import { PARSE_PROMPT_VERSION } from "@/lib/ai/prompts/parse";
import type { ParseOutput } from "@/lib/ai/schema";
import { judgeDescription, scoreProposal, type GoldenCase } from "@/lib/ai/scorer";
import casesJson from "../tests/fixtures/golden/cases.json";
import { buildReport, type Row } from "./report";

// `npm run eval` — ЖИВИЙ прогін golden cases на безкоштовних моделях OpenRouter. Ніколи не в `npm test` і не в CI.
// Потрібен ваш ключ у .env.local. Без ключа всі кейси пропускаються — це не помилка.
// Перший 429 (моделі чи судді) зупиняє прогін: цей і решта кейсів — NOT RUN з причиною у звіті, у частку успіху не входять.
// Таймаут, помилка постачальника, відповідь не за схемою — FAIL з причиною (входять у частку успіху).
//   RUNS=2    — кілька прогонів поспіль для частки успіху (pass rate); бюджет див. нижче.
//   CASES=…   — лише вибрані кейси (id через кому); GAP_MS=… — пауза між кейсами, мс.
//   RECORD=1  — успішні відповіді дописати в tests/fixtures/golden/recorded.json (для офлайн-реплею в CI).
// PowerShell: $env:RECORD="1"; npm run eval   (а потім Remove-Item Env:RECORD)

// CASES=GC-07,GC-08 — лише ці кейси (економить денний ліміт, коли решту вже записано).
const only = process.env.CASES?.split(",").map((id) => id.trim());
const cases = (casesJson as GoldenCase[]).filter((c) => !only || only.includes(c.id));
const key = process.env.OPENROUTER_API_KEY?.trim();
const RECORD = process.env.RECORD === "1";
const RUNS = Math.max(1, Number(process.env.RUNS ?? 1) || 1);
const RECORDED_PATH = "tests/fixtures/golden/recorded.json";
const REPORT_DIR = "evals/reports";

// Бюджет: на прогін — 10 викликів моделі + до 10 викликів судді (лише кейси з rubric), з одного денного лічильника акаунта
// (50/день без покупки ≥10 кредитів). Ланцюжок `models` цей ліміт не обходить, спроби fallback теж можуть рахуватися.
const NEEDED = RUNS * (cases.length + cases.filter((c) => c.rubric).length);
// Пауза між кейсами: безкоштовні ендпоінти можуть давати 429 і до ліміту акаунта (на прогоні 1 так і було), тож за замовчуванням 8 с; GAP_MS=… змінює.
const GAP_MS = Number(process.env.GAP_MS ?? 8_000) || 8_000;

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
type Outcome = { row: Row; rateLimited: boolean; recording?: Recording };

const rows: Row[] = [];
const fresh: Record<string, Recording> = {};
// Перший 429 зупиняє прогін (і наступні RUNS): денний ліміт повтором не виправити, решта кейсів — NOT RUN.
let stoppedAt: string | undefined;

const isRateLimit = (error: unknown) => /429|rate.?limit/i.test(error instanceof Error ? error.message : String(error));

async function remainingQuota(): Promise<number | undefined> {
  const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
  const body = (await res.json()) as { data?: { free_model_daily_requests?: { remaining?: number } } };
  return body.data?.free_model_daily_requests?.remaining;
}

function notRunRow(c: GoldenCase, run: number, why: string, modelId = "—"): Row {
  return { run, id: c.id, ac: c.ac, modelId, fields: false, pass: false, notRun: true, why: `NOT RUN: ${why}` };
}

// Суддя оцінює лише опис заявки; 429 судді — окремий результат (кейс NOT RUN), інший збій — вердикт «ні» з причиною.
async function judge(c: GoldenCase, proposal: Proposal): Promise<{ pass: boolean; reason: string } | "rate_limited" | undefined> {
  if (!c.rubric || proposal.state !== "ok" || proposal.kind !== "request") return undefined;
  try {
    return await judgeDescription(makeJudgeModel(key), c.rubric, proposal.request.description);
  } catch (error) {
    return isRateLimit(error) ? "rate_limited" : { pass: false, reason: `суддя: ${error instanceof Error ? error.message : "збій"}` };
  }
}

type Captured = { modelId?: string; output?: ParseOutput };

// Збій виклику моделі: 429 — кейс NOT RUN (зупиняє прогін), решта (таймаут, помилка постачальника, не за схемою) — FAIL з причиною.
function failedOutcome(c: GoldenCase, run: number, modelId: string, proposal: Extract<Proposal, { state: "unavailable" }>): Outcome {
  if (proposal.reason === "rate_limited") return { row: notRunRow(c, run, `429 — ${proposal.message}`), rateLimited: true };
  const why = `${proposal.reason}: ${proposal.message}`;
  return { row: { run, id: c.id, ac: c.ac, modelId, fields: false, pass: false, why }, rateLimited: false };
}

const verdictWhy = (verdict?: { pass: boolean; reason: string }) => (verdict && !verdict.pass ? `суддя: ${verdict.reason}` : "");

// Записуємо ЛИШЕ успішні відповіді: офлайн-реплей у CI має лишатися зеленим.
function recordingOf(pass: boolean, captured: Captured): Recording | undefined {
  if (!RECORD || !pass || !captured.output) return undefined;
  return { modelId: captured.modelId ?? "—", recordedAt: new Date().toISOString(), promptVersion: PARSE_PROMPT_VERSION, text: JSON.stringify(captured.output) };
}

// Поля порівнює код, опис — суддя за rubric; 429 судді — кейс NOT RUN.
async function grade(c: GoldenCase, run: number, proposal: Proposal, captured: Captured): Promise<Outcome> {
  const modelId = captured.modelId ?? "—";
  const fields = scoreProposal(c.expected, proposal);
  const verdict = await judge(c, proposal);
  if (verdict === "rate_limited") return { row: notRunRow(c, run, "суддя — 429", modelId), rateLimited: true };
  const pass = fields.pass && (verdict?.pass ?? true);
  const why = [...fields.mismatches, verdictWhy(verdict)].filter(Boolean).join("; ") || verdict?.reason;
  const row: Row = { run, id: c.id, ac: c.ac, modelId, fields: fields.pass, judge: verdict?.pass, pass, why };
  return { row, rateLimited: false, recording: recordingOf(pass, captured) };
}

async function evaluate(c: GoldenCase, run: number): Promise<Outcome> {
  const captured: Captured = {};
  // maxRetries 0: денний 429 повтором не виправити, повтор лише з'їдає ліміт.
  const proposal = await proposeValues(c.input, makeProductModel(key), {
    maxRetries: 0,
    timeoutMs: 90_000,
    onResult: (info) => Object.assign(captured, info),
  });
  if (proposal.state === "unavailable") return failedOutcome(c, run, captured.modelId ?? "—", proposal);
  return grade(c, run, proposal, captured);
}

function saveRecordings() {
  if (!RECORD || Object.keys(fresh).length === 0) return;
  // Злиття, а не заміна: прогін, обірваний 429, зберігає старі записи решти кейсів.
  const old = JSON.parse(readFileSync(RECORDED_PATH, "utf8")) as Record<string, Recording>;
  writeFileSync(RECORDED_PATH, JSON.stringify({ ...old, ...fresh }, null, 2) + "\n");
}

function saveReport() {
  if (rows.length === 0) return;
  const at = new Date();
  const path = `${REPORT_DIR}/${at.toISOString().replace(/[:.]/g, "-")}.md`;
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(path, buildReport(rows, { runs: RUNS, cases: cases.length, stoppedAt, at }));
  console.table(rows); // яка модель з ланцюжка відповіла на кейс: бал — за модель, а не «за AI»
  console.log(`Звіт: ${path}; суддя: ${JUDGE_MODEL}`);
}

describe.skipIf(!key)("golden cases, живий прогін (безкоштовні моделі OpenRouter)", () => {
  beforeAll(async () => {
    // Скільки безкоштовних запитів лишилось сьогодні (UTC-доба; у листопаді скидається о 02:00 за Києвом).
    const remaining = await remainingQuota();
    if (typeof remaining === "number" && remaining < NEEDED) {
      throw new Error(`Сьогодні лишилось ${remaining} безкоштовних запитів, потрібно ${NEEDED}. Запустіть завтра або зменште RUNS.`);
    }
  });

  for (let run = 1; run <= RUNS; run++) {
    for (const c of cases) {
      it(`${c.ac}: прогін ${run}, golden ${c.id}`, async (ctx) => {
        if (stoppedAt) {
          rows.push(notRunRow(c, run, `зупинено після 429 (${stoppedAt})`));
          return ctx.skip();
        }
        await sleep(GAP_MS);
        const outcome = await evaluate(c, run);
        // Рядок у звіт — ДО перевірки: інакше кейс зникає зі звіту, і частку успіху рахують з меншого знаменника.
        rows.push(outcome.row);
        if (outcome.rateLimited) {
          stoppedAt = `${c.id}, прогін ${run}`;
          return ctx.skip();
        }
        if (outcome.recording) fresh[c.id] = outcome.recording;
        expect(outcome.row.pass, `${c.id}: ${outcome.row.why}`).toBe(true);
      });
    }
  }

  afterAll(() => {
    saveReport();
    saveRecordings();
  });
});
