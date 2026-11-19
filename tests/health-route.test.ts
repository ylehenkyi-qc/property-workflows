// WS11: маршрут /api/health віддає середовище застосунку і ref бази (без секретів). Мокаємо лише мережу (fetch): справжній
// supabase-js іде до «Supabase», який відповідає як anon без прав на таблицю — Postgres живий, db = "ok".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

const REF = "abcdefghijklmnopqrst";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${REF}.supabase.co`);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "0123456789abcdef0123456789abcdef01234567");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function databaseAnswers(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));
}

describe("GET /api/health", () => {
  it("на staging показує appEnv з APP_ENV і ref бази staging", async () => {
    vi.stubEnv("APP_ENV", "staging");
    databaseAnswers(401, { code: "42501", message: "permission denied for table profiles" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      sha: "0123456789abcdef0123456789abcdef01234567",
      env: "preview",
      appEnv: "staging",
      supabaseRef: REF,
      db: "ok",
      reason: "",
    });
  });

  it("без APP_ENV appEnv береться з VERCEL_ENV, а хибна адреса бази дає supabaseRef unknown", async () => {
    vi.stubEnv("APP_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test");
    databaseAnswers(401, { code: "42501", message: "permission denied for table profiles" });
    const body = await (await GET()).json();
    expect(body).toMatchObject({ appEnv: "preview", supabaseRef: "unknown" });
  });

  it("база призупинена: 503, db down з причиною paused; appEnv і ref усе одно в відповіді", async () => {
    vi.stubEnv("APP_ENV", "staging");
    databaseAnswers(540, { message: "project paused" });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, db: "down", reason: "paused", appEnv: "staging", supabaseRef: REF });
  });
});
