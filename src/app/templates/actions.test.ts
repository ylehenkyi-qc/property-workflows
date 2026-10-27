import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/require-role", () => ({ requireRole: mocks.requireRole }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

// Як у Next.js, redirect() перериває дію винятком; у тесті читаємо адресу з нього.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { createTemplate, publishTemplate, saveTemplateDraft } from "./actions";

const TEMPLATE_ID = "d0000000-0000-4000-8000-000000000001";
const CONTENT = [
  {
    name: "Move-in day",
    tasks: [
      { name: "Hand over keys", required: true },
      { name: "Sign handover act", required: false },
    ],
  },
];

const admin = () => ({ status: "ok", supabase: { rpc: mocks.rpc }, userId: "admin-1", role: "admin" });

async function redirectedTo(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (e) {
    const message = (e as Error).message;
    if (message.startsWith("REDIRECT ")) return message.slice("REDIRECT ".length);
    throw e;
  }
  throw new Error("redirect не викликано");
}

beforeEach(() => {
  mocks.requireRole.mockReset();
  mocks.rpc.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.requireRole.mockResolvedValue(admin());
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});

describe("AC-EDITOR-08: дії шаблонів спершу перевіряють роль", () => {
  // Якщо requireRole відмовив, rpc не викликається: прибрати guard з дії — і ці тести червоніють. Саме правило
  // захищає ще й база (функції перевіряють роль першим рядком), але тоді, без цього тесту, цього б ніхто не бачив.
  const attempts: [string, () => Promise<unknown>][] = [
    ["saveTemplateDraft", () => saveTemplateDraft(TEMPLATE_ID, CONTENT)],
    ["publishTemplate", () => publishTemplate(TEMPLATE_ID)],
    ["createTemplate", () => redirectedTo(() => createTemplate(new FormData()))],
  ];

  for (const [name, run] of attempts) {
    it(`AC-EDITOR-08: ${name} від менеджера не доходить до rpc`, async () => {
      mocks.requireRole.mockResolvedValue({ status: "forbidden", role: "manager" });

      await run();

      expect(mocks.requireRole).toHaveBeenCalledWith("admin");
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it(`AC-EDITOR-08: ${name} без входу не доходить до rpc`, async () => {
      mocks.requireRole.mockResolvedValue({ status: "unauthenticated" });

      // гість отримує redirect на вхід (виняток), а не результат: ігноруємо його, перевіряємо лише що rpc не було
      await Promise.resolve()
        .then(run)
        .catch(() => undefined);

      expect(mocks.rpc).not.toHaveBeenCalled();
    });
  }

  it("AC-EDITOR-08: менеджер отримує «Not enough rights»", async () => {
    mocks.requireRole.mockResolvedValue({ status: "forbidden", role: "manager" });
    expect(await saveTemplateDraft(TEMPLATE_ID, CONTENT)).toEqual({ ok: false, error: "Not enough rights" });
    expect(await publishTemplate(TEMPLATE_ID)).toEqual({ ok: false, error: "Not enough rights" });
  });
});

describe("AC-EDITOR-26: гість напряму змінює шаблон", () => {
  it("AC-EDITOR-26: збереження й публікація від гостя відхилені перенаправленням на вхід, rpc не викликано", async () => {
    mocks.requireRole.mockResolvedValue({ status: "unauthenticated" });
    const login = `/login?next=${encodeURIComponent(`/templates/${TEMPLATE_ID}/edit`)}`;

    expect(await redirectedTo(() => saveTemplateDraft(TEMPLATE_ID, CONTENT))).toBe(login);
    expect(await redirectedTo(() => publishTemplate(TEMPLATE_ID))).toBe(login);

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("saveTemplateDraft", () => {
  it("AC-EDITOR-01: автозбереження відправляє rpc з повним вмістом шаблону", async () => {
    const result = await saveTemplateDraft(TEMPLATE_ID, CONTENT);

    expect(result).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith("save_template_draft", {
      p_template_id: TEMPLATE_ID,
      p_content: CONTENT,
    });
  });

  it("AC-EDITOR-25: зміну не збережено — «Your last change was not kept. Try again.»; відмова за правами (42501) — «Not enough rights»", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    expect(await saveTemplateDraft(TEMPLATE_ID, CONTENT)).toEqual({
      ok: false,
      error: "Your last change was not kept. Try again.",
    });

    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "FORBIDDEN" } });
    expect(await saveTemplateDraft(TEMPLATE_ID, CONTENT)).toEqual({ ok: false, error: "Not enough rights" });
  });
});

describe("publishTemplate", () => {
  it("AC-EDITOR-03: збереження повертає номер нової версії й оновлює сторінки шаблону", async () => {
    mocks.rpc.mockResolvedValue({ data: 2, error: null });

    const result = await publishTemplate(TEMPLATE_ID);

    expect(result).toEqual({ ok: true, version: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith("publish_template", { p_template_id: TEMPLATE_ID });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates");
  });

  it("AC-EDITOR-04: шаблон без обов'язкової задачі — дослівне повідомлення, сторінки не оновлюються", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "22023", message: "A template needs at least one required task" },
    });

    const result = await publishTemplate(TEMPLATE_ID);

    expect(result).toEqual({ ok: false, error: "A template needs at least one required task" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createTemplate", () => {
  it("створює шаблон з назви форми й веде в редактор", async () => {
    mocks.rpc.mockResolvedValue({ data: TEMPLATE_ID, error: null });
    const form = new FormData();
    form.set("name", "Repair");

    const url = await redirectedTo(() => createTemplate(form));

    expect(mocks.rpc).toHaveBeenCalledWith("create_template", { p_name: "Repair" });
    expect(url).toBe(`/templates/${TEMPLATE_ID}/edit`);
  });

  it("гість іде на вхід, менеджер — назад зі спискових помилок", async () => {
    mocks.requireRole.mockResolvedValue({ status: "unauthenticated" });
    expect(await redirectedTo(() => createTemplate(new FormData()))).toBe("/login?next=%2Ftemplates");

    mocks.requireRole.mockResolvedValue({ status: "forbidden", role: "manager" });
    expect(await redirectedTo(() => createTemplate(new FormData()))).toBe("/templates?error=forbidden");
  });

  it("збій бази повертає на список із кодом помилки", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });

    expect(await redirectedTo(() => createTemplate(new FormData()))).toBe("/templates?error=create_failed");
  });
});
