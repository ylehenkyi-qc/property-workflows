import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword: mocks.signInWithPassword } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

// Як у Next.js, redirect() перериває дію винятком; у тесті читаємо адресу з нього.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { login } from "./actions";

const RUN_URL = "/runs/c0000000-0000-4000-8000-000000000001";

async function submit(fields: Record<string, string>): Promise<string> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  try {
    await login(form);
  } catch (e) {
    const message = (e as Error).message;
    if (message.startsWith("REDIRECT ")) return message.slice("REDIRECT ".length);
    throw e;
  }
  throw new Error("redirect не викликано");
}

beforeEach(() => {
  mocks.signInWithPassword.mockReset();
  mocks.signInWithPassword.mockResolvedValue({ error: null });
});

describe("login: куди веде вхід", () => {
  it("AC-DSYS-08: після входу з прямого посилання на запуск користувач потрапляє на цей запуск", async () => {
    const url = await submit({ email: "manager1@example.test", password: "x", next: RUN_URL });

    expect(url).toBe(RUN_URL);
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "manager1@example.test", password: "x" });
  });

  it("без next або з чужою адресою вхід веде на головну", async () => {
    expect(await submit({ email: "a@example.test", password: "x" })).toBe("/");
    expect(await submit({ email: "a@example.test", password: "x", next: "https://evil.example" })).toBe("/");
    expect(await submit({ email: "a@example.test", password: "x", next: "//evil.example" })).toBe("/");
  });

  it("помилка входу лишає на сторінці входу й зберігає next", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    const url = await submit({ email: "a@example.test", password: "bad", next: RUN_URL });

    expect(url).toBe(`/login?next=${encodeURIComponent(RUN_URL)}&error=invalid`);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
