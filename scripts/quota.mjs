#!/usr/bin/env node
// npm run ai:quota — скільки безкоштовних запитів лишилось сьогодні на ВАШОМУ акаунті OpenRouter.
// GET https://openrouter.ai/api/v1/key → data.free_model_daily_requests { used, limit, remaining } за поточну
// UTC-добу (у листопаді нова доба — о 02:00 за Києвом). Ліміт за хвилину (20) цей запит не показує.
// Потрібен OPENROUTER_API_KEY у .env.local; без нього скрипт пише «пропущено» і завершується з кодом 0.
// Скрипт ніколи не друкує ключ і сиру відповідь сервера — лише три числа.
const key = process.env.OPENROUTER_API_KEY?.trim();

function fail(message) {
  console.error(`ai:quota — ${message}`);
  process.exit(1);
}

async function fetchKeyInfo() {
  try {
    return await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
  } catch (error) {
    return fail(`немає з'єднання з OpenRouter: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (!key) {
  console.log("ai:quota — пропущено: OPENROUTER_API_KEY не задано (додайте його в .env.local).");
  process.exit(0);
}

const res = await fetchKeyInfo();
if (res.status === 401) fail("ключ не прийнято (401). Перевірте значення в .env.local.");
if (!res.ok) fail(`HTTP ${res.status}`);

const quota = (await res.json())?.data?.free_model_daily_requests;
if (!quota || typeof quota.remaining !== "number") {
  console.log("ai:quota — у відповіді немає free_model_daily_requests (формат змінився?).");
  process.exit(0);
}
console.log(`Безкоштовні запити сьогодні (UTC): використано ${quota.used} із ${quota.limit}, лишилось ${quota.remaining}.`);
// Живий прогін golden cases: 10 викликів моделі + до 10 викликів судді.
if (quota.remaining < 20) console.log("Для повного живого прогону golden cases потрібно до 20 запитів — краще завтра.");
