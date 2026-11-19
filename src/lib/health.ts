// D0: чи відповіла база на запит /api/health. Чиста функція — щоб перевірити всі гілки тестом без мережі.
// Запит — публічним ключем до таблиці без доступу для anon: «немає прав» (42501) теж означає, що Postgres живий.

/** Код SQLSTATE Postgres, напр. 42501 «permission denied»: запит дійшов до бази. */
const SQLSTATE = /^[0-9A-Z]{5}$/;
/** PostgREST не може під'єднатися до бази. */
const PGRST_DB_DOWN = /^PGRST00[0-3]$/;
/** Supabase відповідає 540, коли безкоштовний проєкт призупинено (Dashboard → Resume project). */
const SUPABASE_PAUSED = 540;

export type DbProbe = { status: number; error: { code?: string; message?: string } | null };
export type DbHealth = { db: "ok" | "down"; reason: string };

export function classifyDbProbe({ status, error }: DbProbe): DbHealth {
  if (status === SUPABASE_PAUSED) return { db: "down", reason: "paused" };
  const code = error?.code ?? "";
  if (!error || SQLSTATE.test(code) || (code.startsWith("PGRST") && !PGRST_DB_DOWN.test(code))) {
    return { db: "ok", reason: "" };
  }
  if (/api key/i.test(error.message ?? "")) return { db: "down", reason: "invalid-api-key" };
  // 0 — мережа (Supabase недоступний або хибний URL), 5xx, PGRST000–003.
  return { db: "down", reason: `status-${status}${code ? `-${code}` : ""}` };
}

/** ref проєкту Supabase з адреси `https://<ref>.supabase.co`. Не секрет: браузер і так бачить адресу в NEXT_PUBLIC_SUPABASE_URL. */
export function supabaseRefFrom(url: string | undefined): string {
  try {
    const match = /^([a-z0-9]+)\.supabase\.co$/.exec(new URL(url ?? "").hostname);
    return match ? match[1] : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Середовище застосунку: APP_ENV (на staging — лише для гілки staging у Vercel), інакше VERCEL_ENV (production, preview,
 * development), інакше «local». Лише коротке слово з літер, цифр і дефіса: довільне значення змінної в health не потрапляє.
 */
export function appEnvFrom(appEnv: string | undefined, vercelEnv: string | undefined): string {
  const word = (value: string | undefined) => (/^[a-z][a-z0-9-]{0,19}$/.test(value?.trim() ?? "") ? value!.trim() : null);
  return word(appEnv) ?? word(vercelEnv) ?? "local";
}
