import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../../tests/helpers/fake-supabase";

const mocks = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.client }));

// Як у Next.js, redirect() і notFound() перериває рендер винятком.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import RunPage from "./[id]/page";
import RunsPage from "./page";

// Що вендор бачить на сторінках запусків: дані віддає база (RLS і list_vendor_runs), сторінка лише показує їх і
// нічого не читає понад дозволене (runs, шаблони, email виконавців).
const RUN_12 = "c0000000-0000-4000-8000-000000000012";
const html = (element: React.ReactElement) => renderToStaticMarkup(element);

const vendorRun = (overrides: Record<string, unknown> = {}) => ({
  id: RUN_12,
  case_name: "Apartment 12, move-in",
  status: "in_progress",
  tasks_total: 2,
  tasks_done: 0,
  ...overrides,
});

const SECTIONS = [
  { id: "s1", name: "Before move-in", position: 1 },
  { id: "s2", name: "Move-in day", position: 2 },
];
// Задачі 3 і 4 вендора V (решту задач запуску база вендору не віддає).
const TASK_3 = { id: "t3", name: "Send welcome information", position: 3, required: false, status: "to_do", assignee_id: "vendor-v", section_id: "s1" };
const TASK_4 = { id: "t4", name: "Hand over the keys", position: 1, required: true, status: "to_do", assignee_id: "vendor-v", section_id: "s2" };

function asVendor(rpc: Record<string, { data: unknown }>, tables: Record<string, { data: unknown }> = {}) {
  const client = fakeSupabase({
    claims: { sub: "vendor-v", email: "vendor1@example.test" },
    tables: { profiles: { data: { role: "vendor" } }, ...tables },
    rpc,
  });
  mocks.client = client;
  return client;
}

beforeEach(() => {
  mocks.client = null;
});

describe("список запусків вендора", () => {
  it("AC-VENDOR-03: вендор бачить запуск «Apartment 12, move-in» зі статусом запуску й «Your tasks: 0 of 2 done», без шаблону й прогресу всього запуску", async () => {
    const client = asVendor({ list_vendor_runs: { data: [vendorRun()] } });

    const markup = html(await RunsPage());

    expect(markup).toContain("Apartment 12, move-in");
    expect(markup).toContain("in progress");
    expect(markup).toContain("Your tasks: 0 of 2 done");
    expect(markup).not.toContain("Apartment 14, repair");
    // посилання на сторінку запуску, а не на форму запуску шаблону
    expect(markup).toContain(`/runs/${RUN_12}`);
    expect(markup).not.toContain("New run");
    // нічого понад дозволене: ні запусків напряму, ні шаблонів, ні задач усього запуску
    expect(client.calls.from).not.toContain("runs");
    expect(client.calls.from).not.toContain("templates");
    expect(client.calls.from).not.toContain("run_tasks");
  });

  it("AC-VENDOR-10: вендор без задач бачить «No tasks assigned to you yet.» і порожньої таблиці немає", async () => {
    asVendor({ list_vendor_runs: { data: [] } });

    const markup = html(await RunsPage());

    expect(markup).toContain("No tasks assigned to you yet.");
    expect(markup).not.toContain("<table");
    expect(markup).not.toContain("New run");
  });
});

describe("сторінка запуску вендора", () => {
  it("AC-VENDOR-04: вендор бачить лише свої задачі з назвою, секцією, «required»/«optional» і статусом, без email, версії й прогресу запуску", async () => {
    const client = asVendor(
      { list_vendor_runs: { data: [vendorRun()] }, list_assignable_users: { data: [{ id: "a", email: "manager1@example.test" }] } },
      { run_sections: { data: SECTIONS }, run_tasks: { data: [TASK_3, TASK_4] } },
    );

    const markup = html(await RunPage({ params: Promise.resolve({ id: RUN_12 }), searchParams: Promise.resolve({}) }));

    expect(markup).toContain("Apartment 12, move-in");
    expect(markup).toContain("Your tasks: 0 of 2 done");
    // задача 3 і задача 4: назва, секція, позначка, статус
    expect(markup).toContain("Send welcome information");
    expect(markup).toContain("Before move-in");
    expect(markup).toContain("optional");
    expect(markup).toContain("Hand over the keys");
    expect(markup).toContain("Move-in day");
    expect(markup).toContain("required");
    expect(markup).toContain("to do");
    expect((markup.match(/data-testid="run-task"/g) ?? []).length).toBe(2);
    // без email виконавців, версії шаблону, статусу й прогресу всього запуску
    expect(markup).not.toContain("example.test");
    expect(markup).not.toContain("Template version");
    expect(markup).not.toMatch(/\d+ of \d+ done(?!\s*<)/);
    expect(markup).not.toContain('data-testid="run-status"');
    expect(client.calls.rpc).not.toContain("list_assignable_users");
    expect(client.calls.from).not.toContain("runs");
    expect(client.calls.from).not.toContain("templates");
  });

  it("AC-VENDOR-06: запуск, де вендор без задач, — «Run not found» і жодна задача запуску не читається", async () => {
    const client = asVendor(
      { list_vendor_runs: { data: [] } },
      { run_sections: { data: SECTIONS }, run_tasks: { data: [TASK_3] } },
    );

    await expect(
      RunPage({ params: Promise.resolve({ id: RUN_12 }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NOT_FOUND");

    // сторінка питає базу про запуск (а не відмовляє вендору наперед), і, не знайшовши його, нічого не читає далі
    expect(client.calls.rpc).toContain("list_vendor_runs");
    expect(client.calls.from).not.toContain("run_tasks");
    expect(client.calls.from).not.toContain("run_sections");
  });
});
