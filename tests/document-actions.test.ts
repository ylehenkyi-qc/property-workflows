import { beforeEach, describe, expect, it, vi } from "vitest";

// Обгортки Server Actions: перевіряють, що справжній requireRole (getClaims() + роль з profiles.role) стоїть першим і пускає
// лише manager і admin. Мокаємо лише межу з Supabase; решта (ролі, логіка дій) — справжній код.
const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  profile: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} })); // поза Next.js revalidatePath кидає виняток
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
    from: (table: string) =>
      table === "profiles"
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.profile() }) }) }) }
        : { insert: mocks.insert },
  }),
}));

import { confirmDocumentValues, proposeDocumentValues } from "@/app/runs/[id]/document-actions";

const RUN_ID = "c0000000-0000-4000-8000-000000000003";
const confirmed = { phone: "555-0101", description: "Kitchen tap dripping", category: "plumbing", urgency: "urgent" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("OPENROUTER_API_KEY", ""); // немає ключа: модель не збирається, мережі в тесті немає
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
  mocks.profile.mockReturnValue({ role: "manager" });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.insert.mockResolvedValue({ error: null });
});

describe("proposeDocumentValues", () => {
  it("AC-DOCAI-13: менеджер без ключа отримує стан «недоступний», а не помилку сторінки", async () => {
    expect(await proposeDocumentValues(RUN_ID, "My phone is 555-0101")).toEqual({
      status: "ok",
      proposal: { state: "unavailable", reason: "no_key", message: "The assistant is not available now. Fill in the values yourself." },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-01: адміністратор теж може користуватися помічником", async () => {
    mocks.profile.mockReturnValue({ role: "admin" });
    expect(await proposeDocumentValues(RUN_ID, "x")).toMatchObject({ status: "ok" });
  });

  it("AC-DOCAI-16: вендор: відмова, запуск не перевіряється, запису немає", async () => {
    mocks.profile.mockReturnValue({ role: "vendor" });
    expect(await proposeDocumentValues(RUN_ID, "x")).toEqual({ status: "forbidden" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-16: менеджер, який не менеджер цього запуску, не дістає значень: відмова, модель не викликається", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    vi.stubEnv("OPENROUTER_API_KEY", "test-key-not-used");
    expect(await proposeDocumentValues(RUN_ID, "x")).toEqual({ status: "forbidden" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-16: без входу: відмова, запуск не перевіряється", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });
    expect(await proposeDocumentValues(RUN_ID, "x")).toEqual({ status: "unauthenticated" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("confirmDocumentValues", () => {
  it("AC-DOCAI-04: менеджер зберігає підтверджені значення", async () => {
    expect(await confirmDocumentValues(RUN_ID, "request", confirmed)).toEqual({ status: "saved" });
    expect(mocks.insert).toHaveBeenCalledWith({ run_id: RUN_ID, kind: "request", values: confirmed });
  });

  it("AC-DOCAI-16: менеджер, який не менеджер цього запуску, не зберігає — «forbidden» (UI: «Not enough rights»), запису немає", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await confirmDocumentValues(RUN_ID, "request", confirmed)).toEqual({ status: "forbidden" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-16: вендор не зберігає — відмова, запису немає", async () => {
    mocks.profile.mockReturnValue({ role: "vendor" });
    expect(await confirmDocumentValues(RUN_ID, "request", confirmed)).toEqual({ status: "forbidden" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("AC-DOCAI-16: без входу не зберігає — відмова, запису немає", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });
    expect(await confirmDocumentValues(RUN_ID, "request", confirmed)).toEqual({ status: "unauthenticated" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
