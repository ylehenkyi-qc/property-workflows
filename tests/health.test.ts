// D0: /api/health відрізняє «база відповіла» від «база недоступна, призупинена чи ключ хибний».
import { describe, expect, it } from "vitest";
import { appEnvFrom, classifyDbProbe, supabaseRefFrom } from "@/lib/health";

describe("classifyDbProbe (/api/health)", () => {
  it("рахує базу живою, коли запит пройшов або Postgres відмовив у правах (42501)", () => {
    expect(classifyDbProbe({ status: 200, error: null })).toEqual({ db: "ok", reason: "" });
    expect(classifyDbProbe({ status: 401, error: { code: "42501", message: "permission denied for table profiles" } })).toEqual({
      db: "ok",
      reason: "",
    });
    expect(classifyDbProbe({ status: 400, error: { code: "PGRST100", message: "bad filter" } }).db).toBe("ok");
  });

  it("повідомляє «paused», коли Supabase відповідає 540 (безкоштовний проєкт призупинено)", () => {
    expect(classifyDbProbe({ status: 540, error: { message: "project paused" } })).toEqual({ db: "down", reason: "paused" });
  });

  it("повідомляє про хибний публічний ключ", () => {
    expect(classifyDbProbe({ status: 401, error: { message: "Invalid API key" } })).toEqual({
      db: "down",
      reason: "invalid-api-key",
    });
  });

  it("повідомляє код, коли PostgREST не дістає до бази або мережі немає", () => {
    expect(classifyDbProbe({ status: 503, error: { code: "PGRST002", message: "schema cache" } })).toEqual({
      db: "down",
      reason: "status-503-PGRST002",
    });
    expect(classifyDbProbe({ status: 0, error: { message: "fetch failed" } })).toEqual({ db: "down", reason: "status-0" });
  });
});

describe("supabaseRefFrom (/api/health, WS11)", () => {
  it("бере ref з адреси проєкту Supabase", () => {
    expect(supabaseRefFrom("https://abcdefghijklmnopqrst.supabase.co")).toBe("abcdefghijklmnopqrst");
    expect(supabaseRefFrom("https://abcdefghijklmnopqrst.supabase.co/rest/v1/")).toBe("abcdefghijklmnopqrst");
  });

  it("повертає unknown для локальної адреси, чужого хоста, порожнього й хибного значення", () => {
    for (const url of ["http://127.0.0.1:54321", "https://example.test", "https://evil.example/abc.supabase.co", "", "not a url", undefined]) {
      expect(supabaseRefFrom(url)).toBe("unknown");
    }
  });
});

describe("appEnvFrom (/api/health, WS11)", () => {
  it("віддає перевагу APP_ENV, потім VERCEL_ENV, інакше local", () => {
    expect(appEnvFrom("staging", "preview")).toBe("staging");
    expect(appEnvFrom(undefined, "production")).toBe("production");
    expect(appEnvFrom(" staging ", "preview")).toBe("staging");
    expect(appEnvFrom(undefined, undefined)).toBe("local");
  });

  it("не пускає в health довільний текст зі змінної", () => {
    expect(appEnvFrom("Bearer sb_secret_abc def", "preview")).toBe("preview");
    expect(appEnvFrom("x".repeat(40), undefined)).toBe("local");
    expect(appEnvFrom("", "")).toBe("local");
  });
});
