import { JUDGE_MODEL, PRODUCT_MODELS } from "@/lib/ai/models";
import { PARSE_PROMPT_VERSION } from "@/lib/ai/prompts/parse";
import { acceptance, passRate } from "@/lib/ai/scorer";

// Рядок звіту живого прогону golden cases. notRun — кейс не запускали через ліміт (429): у частку успіху не входить.
export type Row = {
  run: number;
  id: string;
  ac: string;
  modelId: string;
  fields: boolean;
  judge?: boolean;
  pass: boolean;
  notRun?: boolean;
  why?: string;
};

export type ReportMeta = { runs: number; cases: number; stoppedAt?: string; at: Date };

const mark = (b: boolean | undefined) => (b === undefined ? "—" : b ? "так" : "ні");
const result = (r: Row) => (r.notRun ? "NOT RUN" : r.pass ? "✅" : "❌");

function byModel(ran: Row[]): string[] {
  const groups = new Map<string, Row[]>();
  for (const r of ran) groups.set(r.modelId, [...(groups.get(r.modelId) ?? []), r]);
  return [...groups].map(([model, rs]) => `| \`${model}\` | ${passRate(rs).passed} | ${rs.length} |`);
}

const rowLine = (r: Row) =>
  `| ${r.run} | ${r.id} | ${r.ac} | \`${r.modelId}\` | ${mark(r.fields)} | ${mark(r.judge)} | ${result(r)} | ${(r.why ?? "").replaceAll("|", "/")} |`;

// Поріг PM для кожного прогону окремо: 8 з 10, кейси 9 і 10 — завжди. NOT RUN — не FAIL, але й не прийнято, поки кейс не пройдено.
function acceptanceLines(rows: Row[]): string[] {
  const runs = [...new Set(rows.map((r) => r.run))];
  return runs.map((run) => {
    const a = acceptance(rows.filter((r) => r.run === run));
    const must = a.mustFail.length === 0 ? "кейси 9 і 10 пройшли" : `кейси 9 і 10: не пройшли ${a.mustFail.join(", ")}`;
    return `- Поріг PM (прогін ${run}): ${a.passed} з ${a.total} (потрібно ≥ 8), ${must} — **${a.accepted ? "прийнято" : "НЕ прийнято"}**`;
  });
}

// Звіт: частка успіху загалом і за моделлю + кожен кейс. Файл комітять (він без секретів).
export function buildReport(rows: Row[], meta: ReportMeta): string {
  const ran = rows.filter((r) => !r.notRun);
  const total = passRate(ran);
  const notRun = rows.length - ran.length;
  return [
    `# Живий прогін golden cases — ${meta.at.toISOString()}`,
    "",
    `- Промпт: \`${PARSE_PROMPT_VERSION}\`; ланцюжок моделей: ${PRODUCT_MODELS.map((m) => `\`${m}\``).join(" → ")}; суддя: \`${JUDGE_MODEL}\``,
    `- Прогонів: ${meta.runs}; кейсів у прогоні: ${meta.cases}`,
    `- **Частка успіху: ${total.passed}/${total.total} (${Math.round(total.rate * 100)}%)** — з кейсів, що отримали відповідь`,
    ...acceptanceLines(rows),
    `- Не запущено (NOT RUN): ${notRun}${meta.stoppedAt ? ` — ліміт 429, зупинено на: ${meta.stoppedAt}` : ""}`,
    "",
    "| Модель, що відповіла | Пройшло | Усього |",
    "|---|---|---|",
    ...byModel(ran),
    "",
    "| Прогін | Кейс | AC | Модель | Поля | Суддя | Результат | Розбіжності / причина судді / помилка |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map(rowLine),
    "",
  ].join("\n");
}
