import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc }),
}));

// Як у Next.js, redirect() перериває дію винятком; у тесті читаємо адресу з нього.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { ASSIGNEE_ME } from "@/lib/runs/assignees";
import { launchRun } from "./actions";

const TEMPLATE_ID = "a0000000-0000-4000-8000-000000000001";
const TASK_ID = "a0000000-0000-4000-8000-000000000101";
const OTHER_TASK_ID = "a0000000-0000-4000-8000-000000000102";
const MANAGER_B = "b0000000-0000-4000-8000-000000000002";
const RUN_ID = "c0000000-0000-4000-8000-000000000003";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  data.set("template_id", TEMPLATE_ID);
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

// Повертає адресу, на яку дія зробила redirect().
async function submit(data: FormData): Promise<string> {
  try {
    await launchRun(data);
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
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "manager-a" } } });
  mocks.rpc.mockResolvedValue({ data: RUN_ID, error: null });
});

describe("launchRun", () => {
  it("AC-RUN-03: порожня назва або лише пробіли — запуск не створюється, форма показує «Enter a case name»", async () => {
    const expected = `/runs/new?template=${TEMPLATE_ID}&error=name_empty`;

    expect(await submit(form({ case_name: "" }))).toBe(expected);
    expect(await submit(form({ case_name: "    " }))).toBe(expected);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("AC-RUN-07: назва у 101 символ — запуск не створюється, форма показує «Case name must be at most 100 characters»", async () => {
    const url = await submit(form({ case_name: "a".repeat(101) }));

    expect(url).toBe(`/runs/new?template=${TEMPLATE_ID}&error=name_too_long`);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("AC-RUN-07: назва у 100 символів запускає шаблон", async () => {
    const name = "a".repeat(100);
    const url = await submit(form({ case_name: name }));

    expect(url).toBe(`/runs/${RUN_ID}`);
    expect(mocks.rpc).toHaveBeenCalledWith("launch_run", {
      p_template_id: TEMPLATE_ID,
      p_case_name: name,
      p_assignments: [],
    });
  });

  it("передає в rpc обрізану назву", async () => {
    await submit(form({ case_name: "  Apartment 12, move-in  " }));

    expect(mocks.rpc).toHaveBeenCalledWith(
      "launch_run",
      expect.objectContaining({ p_case_name: "Apartment 12, move-in" }),
    );
  });

  it("AC-RUN-04: менеджер призначає іншого виконавцем задачі — у launch_run передається лише це призначення, решта лишається запускачу", async () => {
    await submit(
      form({
        case_name: "Apartment 12, move-in",
        [`assignee_${TASK_ID}`]: MANAGER_B,
        [`assignee_${OTHER_TASK_ID}`]: "",
      }),
    );

    expect(mocks.rpc).toHaveBeenCalledWith("launch_run", {
      p_template_id: TEMPLATE_ID,
      p_case_name: "Apartment 12, move-in",
      p_assignments: [{ template_task_id: TASK_ID, assignee_id: MANAGER_B }],
    });
  });

  it("AC-RUN-04: значення «me» зі списку виконавців не створює призначення, а обраний інший виконавець зберігається", async () => {
    await submit(
      form({
        case_name: "Apartment 12, move-in",
        [`assignee_${TASK_ID}`]: ASSIGNEE_ME,
        [`assignee_${OTHER_TASK_ID}`]: MANAGER_B,
      }),
    );

    expect(mocks.rpc).toHaveBeenCalledWith("launch_run", {
      p_template_id: TEMPLATE_ID,
      p_case_name: "Apartment 12, move-in",
      p_assignments: [{ template_task_id: OTHER_TASK_ID, assignee_id: MANAGER_B }],
    });
  });

  it("AC-RUN-08: без призначення виконавців (усі «me») у launch_run іде порожній список призначень — виконавець усіх задач менеджер запуску", async () => {
    await submit(
      form({
        case_name: "Apartment 12, move-in",
        [`assignee_${TASK_ID}`]: ASSIGNEE_ME,
        [`assignee_${OTHER_TASK_ID}`]: ASSIGNEE_ME,
      }),
    );

    expect(mocks.rpc).toHaveBeenCalledWith("launch_run", {
      p_template_id: TEMPLATE_ID,
      p_case_name: "Apartment 12, move-in",
      p_assignments: [],
    });
  });

  it("без входу відправляє на /login і не викликає rpc", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });

    expect(await submit(form({ case_name: "Apartment 12, move-in" }))).toBe("/login");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("повідомлення launch_run про назву показує кодом помилки форми", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Enter a case name" } });

    expect(await submit(form({ case_name: "Apartment 12, move-in" }))).toBe(
      `/runs/new?template=${TEMPLATE_ID}&error=name_empty`,
    );
  });

  it("невідому помилку launch_run не показує дослівно, а повертає технічну відмову", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Template not found" } });

    expect(await submit(form({ case_name: "Apartment 12, move-in" }))).toBe(
      `/runs/new?template=${TEMPLATE_ID}&error=failed`,
    );
  });
});
