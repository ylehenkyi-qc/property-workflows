import { afterEach, describe, expect, it, vi } from "vitest";

// `server-only` у Vitest кидає помилку при імпорті (так і задумано: tests/ai-key.test.ts це перевіряє), тож для перевірки
// самої функції підміняємо лише цей пакет-обмежувач; решта модуля — справжня. Значення ключа тут — не справжнє.
vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadProductModel() {
  const mod = await import("@/lib/ai/openrouter");
  return mod.productModel;
}

describe("productModel без ключа", () => {
  it("AC-DOCAI-09: немає ключа — функція повертає null (помічник недоступний), а не падає", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect((await loadProductModel())()).toBeNull();
  });

  it("AC-DOCAI-09: ключ із самих пробілів теж означає «ключа немає»", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "   ");
    expect((await loadProductModel())()).toBeNull();
  });

  it("AC-DOCAI-09: коли ключ заданий, повертається модель", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-not-a-real-key");
    expect((await loadProductModel())()).not.toBeNull();
  });
});
