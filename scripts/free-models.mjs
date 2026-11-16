#!/usr/bin/env node
// npm run ai:models — які безкоштовні моделі OpenRouter доступні СЬОГОДНІ і що вони вміють.
// Публічний список https://openrouter.ai/api/v1/models — ключ не потрібен, нічого не витрачає.
// Колонки: SO = structured_outputs (строга json_schema), RF = response_format, tools = виклик інструментів.
// Наприкінці — чи всі моделі з ланцюжка в src/lib/ai/models.ts ще є в списку (код виходу 2, якщо якоїсь немає).
//   node scripts/free-models.mjs          таблиця
//   node scripts/free-models.mjs --json   JSON для власних скриптів
import { existsSync, readFileSync } from "node:fs";

const URL = "https://openrouter.ai/api/v1/models";
const MODELS_FILE = "src/lib/ai/models.ts";

const isZero = (v) => Number(v ?? 0) === 0;
const yes = (b) => (b ? "так" : "—");

const priceIsZero = ({ pricing = {} }) => isZero(pricing.prompt) && isZero(pricing.completion);
const isFree = (m) => m.id.endsWith(":free") || priceIsZero(m);

const contextOf = (m) => m.context_length ?? m.top_provider?.context_length ?? null;
const modalities = (m) => (m.architecture?.input_modalities ?? []).join("+");

function toRow(m) {
  const params = m.supported_parameters ?? [];
  return {
    id: m.id,
    // Нульова ціна без суфікса :free (stealth-моделі тощо) — не плутати з безкоштовними LLM.
    note: m.id.endsWith(":free") ? "" : "ціна 0, але без :free — перевірте опис",
    context: contextOf(m),
    input: modalities(m),
    tools: params.includes("tools"),
    SO: params.includes("structured_outputs"),
    RF: params.includes("response_format"),
    expires: m.expiration_date ?? "",
  };
}

const bySupport = (a, b) => Number(b.SO) - Number(a.SO) || a.id.localeCompare(b.id);

async function loadModels() {
  const res = await fetch(URL);
  if (!res.ok) {
    console.error(`GET ${URL} → HTTP ${res.status}`);
    process.exit(1);
  }
  const { data } = await res.json();
  return data;
}

function printTable(rows, total) {
  console.log(`OpenRouter, ${new Date().toISOString()}: моделей усього ${total}, безкоштовних (або з ціною 0) ${rows.length}`);
  console.table(
    rows.map((r) => ({ id: r.id, "контекст": r.context, "вхід": r.input, tools: yes(r.tools), SO: yes(r.SO), RF: yes(r.RF), "до": r.expires, "увага": r.note })),
  );
}

// Лише рядки ID з `:free`, знайдені в тексті файлу з ланцюжком.
function chainIds() {
  if (!existsSync(MODELS_FILE)) return [];
  const found = [...readFileSync(MODELS_FILE, "utf8").matchAll(/"([a-z0-9._-]+\/[a-z0-9._-]+:free)"/gi)];
  return [...new Set(found.map((m) => m[1]))];
}

function checkChain(rows) {
  const chain = chainIds();
  const known = new Set(rows.map((r) => r.id));
  const gone = chain.filter((id) => !known.has(id));
  if (gone.length > 0) {
    console.log(`\nУВАГА: у ${MODELS_FILE} є моделі, яких сьогодні немає в списку: ${gone.join(", ")}. Оновіть ланцюжок.`);
    process.exitCode = 2;
    return;
  }
  if (chain.length > 0) console.log(`\nУсі моделі з ${MODELS_FILE} є в списку (${chain.length}).`);
}

const data = await loadModels();
const rows = data.filter(isFree).map(toRow).sort(bySupport);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  printTable(rows, data.length);
  checkChain(rows);
}
