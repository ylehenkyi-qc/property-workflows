import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getClaims: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

// Як у Next.js, redirect() перериває дію винятком; у тесті читаємо адресу з нього.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { MARK_TASK_ERRORS } from "@/lib/runs/markTaskErrors";
import { markTaskDone } from "./actions";

const TASK_ID = "a0000000-0000-4000-8000-000000000101";
const RUN_ID = "c0000000-0000-4000-8000-000000000003";

// Повертає адресу, на яку дія зробила redirect().
async function submit(taskId = TASK_ID, runId = RUN_ID): Promise<string> {
  try {
    await markTaskDone(taskId, runId);
  } catch (e) {
    const message = (e as Error).message;
    if (message.startsWith("REDIRECT ")) return message.slice("REDIRECT ".length);
    throw e;
  }
  throw new Error("redirect не викликано");
}

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.getClaims.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "manager-c" } } });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});

describe("markTaskDone", () => {
  it("AC-VENDOR-07: коли база відповіла «Run not found», дія повертає на сторінку з кодом run_not_found, а не з загальною помилкою", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "Run not found" } });

    const url = await submit();

    expect(url).toBe(`/runs/${RUN_ID}?error=run_not_found`);
    expect(MARK_TASK_ERRORS.run_not_found).toBe("Run not found");
  });

  it("AC-TASK-03: при відмові за правами (42501) сторінка показує дослівне повідомлення з відмовою", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "Only the task's assignee, the run manager, or an administrator can mark a task as done",
      },
    });

    const url = await submit();

    expect(url).toBe(`/runs/${RUN_ID}?error=forbidden`);
    const code = new URL(url, "http://localhost").searchParams.get("error") as "forbidden";
    expect(MARK_TASK_ERRORS[code]).toBe(
      "Only the task's assignee, the run manager, or an administrator can mark a task as done",
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("викликає rpc mark_task_done з p_task_id і повертає на сторінку запуску", async () => {
    const url = await submit();

    expect(mocks.rpc).toHaveBeenCalledWith("mark_task_done", { p_task_id: TASK_ID });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/runs/${RUN_ID}`);
    expect(url).toBe(`/runs/${RUN_ID}`);
  });

  it("невідома помилка дає загальний текст «Could not mark the task as done»", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "Task not found" } });

    const url = await submit();

    expect(url).toBe(`/runs/${RUN_ID}?error=failed`);
    expect(MARK_TASK_ERRORS.failed).toBe("Could not mark the task as done");
  });

  it("без входу відправляє на /login і не викликає rpc", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    expect(await submit()).toBe("/login");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("некоректний runId не підставляє в адресу повернення", async () => {
    expect(await submit(TASK_ID, "../evil")).toBe("/runs");
  });
});
