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

import RunNotFound from "./[id]/not-found";
import RunPage from "./[id]/page";
import RunsPage from "./page";

const RUN_ID = "c0000000-0000-4000-8000-000000000001";
const html = (element: React.ReactElement) => renderToStaticMarkup(element);

const USERS = [
  { id: "user-a", email: "manager-a@example.test" },
  { id: "user-b", email: "manager-b@example.test" },
  { id: "user-c", email: "manager-c@example.test" },
];

const SECTIONS = [
  { id: "s2", name: "Move-in day", position: 2 },
  { id: "s1", name: "Before move-in", position: 1 },
];
const task = (id: string, name: string, section: string, position: number, required: boolean, assignee = "user-b", status = "to_do") => ({
  id,
  name,
  position,
  required,
  status,
  assignee_id: assignee,
  section_id: section,
});
const TASKS = [
  task("t1", "Inspect the apartment", "s1", 1, true),
  task("t2", "Collect the signed lease", "s1", 2, true),
  task("t3", "Hand over the keys", "s2", 1, true),
  task("t4", "Send welcome information", "s2", 2, false),
  task("t5", "Record meter readings", "s2", 3, false),
];

// Рендерить сторінку запуску від імені користувача viewer із роллю role.
async function renderRun(options: {
  viewer: string;
  role?: "manager" | "admin";
  managerId?: string;
  tasks?: ReturnType<typeof task>[];
  run?: unknown;
}) {
  const { viewer, role = "manager", managerId = "user-a", tasks = TASKS } = options;
  const client = fakeSupabase({
    claims: { sub: viewer },
    tables: {
      profiles: { data: { role } },
      runs: {
        data:
          options.run === undefined
            ? { id: RUN_ID, case_name: "Apartment 12", status: "in_progress", template_version: 1, manager_id: managerId }
            : options.run,
      },
      run_sections: { data: SECTIONS },
      run_tasks: { data: tasks },
    },
    rpc: { list_assignable_users: { data: USERS } },
  });
  mocks.client = client;
  const markup = html(await RunPage({ params: Promise.resolve({ id: RUN_ID }), searchParams: Promise.resolve({}) }));
  return { markup, client, rows: markup.split('data-testid="run-task"').slice(1) };
}

beforeEach(() => {
  mocks.client = null;
});

describe("AC-TASK-10: чужий запуск за прямим посиланням", () => {
  it("AC-TASK-10: запуск, якого RLS не віддав, дає «Run not found» без жодної задачі", async () => {
    const client = fakeSupabase({
      claims: { sub: "user-c" },
      tables: { profiles: { data: { role: "manager" } }, runs: { data: null }, run_tasks: { data: TASKS } },
    });
    mocks.client = client;

    await expect(
      RunPage({ params: Promise.resolve({ id: RUN_ID }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NOT_FOUND");
    // задач запуску сторінка навіть не запитувала
    expect(client.calls.from).not.toContain("run_tasks");

    const notFound = html(RunNotFound());
    expect(notFound).toContain("Run not found");
    expect(notFound).not.toContain("run-task");
  });
});

describe("сторінка запуску: задачі", () => {
  it("AC-TASK-11: біля кожної задачі email виконавця, без імен і ролей", async () => {
    const { rows, markup } = await renderRun({ viewer: "user-b" });

    expect(rows).toHaveLength(5);
    for (const row of rows) expect(row).toContain("manager-b@example.test");
    expect(markup).not.toContain("manager-a@example.test"); // email інших виконавців не додаємо
    expect(markup).not.toMatch(/\b(admin|manager)\b(?!-)/i); // ролей на сторінці немає
  });

  it("AC-TASK-12: задачі двома групами: «Before move-in» (2) і потім «Move-in day» (3)", async () => {
    const { markup } = await renderRun({ viewer: "user-a" });

    const first = markup.indexOf("Before move-in");
    const second = markup.indexOf("Move-in day");
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(second);

    const [beforeGroup, moveInGroup] = [markup.slice(first, second), markup.slice(second)];
    expect(beforeGroup.match(/data-testid="run-task"/g)).toHaveLength(2);
    expect(moveInGroup.match(/data-testid="run-task"/g)).toHaveLength(3);
  });

  it("AC-TASK-15: кожна задача «required» або «optional» поруч зі статусом: 3 і 2", async () => {
    const { rows } = await renderRun({ viewer: "user-a" });

    expect(rows.filter((row) => row.includes(">required<"))).toHaveLength(3);
    expect(rows.filter((row) => row.includes(">optional<"))).toHaveLength(2);
    for (const row of rows) expect(row).toContain('data-status="to_do"');
  });
});

describe("кнопка «Mark as done»", () => {
  const TWO_TASKS = [task("tb", "Task for B", "s1", 1, false, "user-b"), task("tc", "Task for C", "s1", 2, false, "user-c")];

  it("AC-TASK-18: менеджер C бачить кнопку лише на своїй задачі, а не на задачі менеджера B", async () => {
    const { rows } = await renderRun({ viewer: "user-c", tasks: TWO_TASKS });

    const forB = rows.find((row) => row.includes("Task for B"))!;
    const forC = rows.find((row) => row.includes("Task for C"))!;
    expect(forC).toContain("Mark as done");
    expect(forB).not.toContain("Mark as done");
  });

  it("AC-TASK-01: виконавець бачить кнопку на своїй задачі", async () => {
    const { rows } = await renderRun({ viewer: "user-b", tasks: TWO_TASKS });

    expect(rows.find((row) => row.includes("Task for B"))).toContain("Mark as done");
  });

  it("AC-TASK-02: менеджер запуску бачить кнопку на задачі виконавця", async () => {
    const { rows } = await renderRun({ viewer: "user-a", tasks: TWO_TASKS });

    expect(rows.filter((row) => row.includes("Mark as done"))).toHaveLength(2);
  });

  it("AC-TASK-07: адміністратор бачить кнопку на задачах чужого запуску", async () => {
    const { rows } = await renderRun({ viewer: "user-admin", role: "admin", tasks: TWO_TASKS });

    expect(rows.filter((row) => row.includes("Mark as done"))).toHaveLength(2);
  });

  it("задача «done» кнопки не має", async () => {
    const { rows } = await renderRun({
      viewer: "user-a",
      tasks: [task("td", "Finished task", "s1", 1, false, "user-b", "done")],
    });

    expect(rows[0]).not.toContain("Mark as done");
  });

  it("AC-TASK-04: остання обов'язкова задача позначається через підтвердження, а не прямою відправкою форми", async () => {
    const afterTwoDone = TASKS.map((item) => (item.id === "t1" || item.id === "t2" ? { ...item, status: "done" } : item));

    const { rows } = await renderRun({ viewer: "user-b", tasks: afterTwoDone });

    const keys = rows.find((row) => row.includes("Hand over the keys"))!;
    expect(keys).toContain('data-confirm="true"');
    expect(keys).not.toContain("<form");
    // необов'язкова задача цього запуску позначається напряму
    const welcome = rows.find((row) => row.includes("Send welcome information"))!;
    expect(welcome).toContain("<form");
    expect(welcome).not.toContain("data-confirm");
  });

  it("AC-TASK-16: підтвердження тільки на останній обов'язковій задачі, поки є інша обов'язкова «to do» — прямо", async () => {
    // 1 обов'язкова «done», ще 2 «to do»: жодна з них не остання
    const oneDone = TASKS.map((item) => (item.id === "t1" ? { ...item, status: "done" } : item));

    const { rows } = await renderRun({ viewer: "user-b", tasks: oneDone });

    for (const name of ["Collect the signed lease", "Hand over the keys"]) {
      const row = rows.find((r) => r.includes(name))!;
      expect(row).toContain("<form");
      expect(row).not.toContain("data-confirm");
    }
  });
});

describe("список запусків", () => {
  const run = (id: string, caseName: string, status: string, createdAt: string, templateId: string) => ({
    id,
    case_name: caseName,
    status,
    created_at: createdAt,
    template_id: templateId,
  });
  const done = (runId: string, n: number, total: number) =>
    Array.from({ length: total }, (_, i) => ({ run_id: runId, status: i < n ? "done" : "to_do" }));
  const TEMPLATES = [
    { id: "tpl-move", name: "Tenant move-in" },
    { id: "tpl-repair", name: "Repair" },
  ];

  function renderList(runs: ReturnType<typeof run>[], tasks: { run_id: string; status: string }[]) {
    mocks.client = fakeSupabase({
      tables: { runs: { data: runs }, run_tasks: { data: tasks }, templates: { data: TEMPLATES } },
    });
    return RunsPage();
  }

  it("AC-TASK-13: показано і завершений («completed», «4 of 5 done»), і поточний запуск зі статусом і прогресом", async () => {
    const markup = html(
      await renderList(
        [
          run("r-done", "Apartment 12", "completed", "2026-10-20T10:00:00Z", "tpl-move"),
          run("r-open", "Apartment 7", "in_progress", "2026-10-21T10:00:00Z", "tpl-move"),
        ],
        [...done("r-done", 4, 5), ...done("r-open", 1, 3)],
      ),
    );

    const rows = markup.split("<tr").slice(2); // без шапки таблиці
    const completedRow = rows.find((row) => row.includes("Apartment 12"))!;
    expect(completedRow).toContain("completed");
    expect(completedRow).toContain("4 of 5 done");
    const openRow = rows.find((row) => row.includes("Apartment 7"))!;
    expect(openRow).toContain("in progress");
    expect(openRow).toContain("1 of 3 done");
  });

  it("AC-TASK-14: «Repair» першим, «Tenant move-in» другим, у кожному рядку назва випадку й шаблону", async () => {
    const markup = html(
      await renderList(
        [
          run("r1", "Apartment 12", "in_progress", "2026-10-20T10:00:00Z", "tpl-move"),
          run("r2", "Apartment 12", "in_progress", "2026-10-22T10:00:00Z", "tpl-repair"),
        ],
        [],
      ),
    );

    const rows = markup.split("<tr").slice(2); // без шапки таблиці
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Repair");
    expect(rows[0]).toContain("Apartment 12");
    expect(rows[1]).toContain("Tenant move-in");
    expect(rows[1]).toContain("Apartment 12");
  });

  it("AC-TASK-17: виконавець бачить чужий запуск у списку з прогресом «2 of 5 done»", async () => {
    // Які запуски віддає RLS, вирішує база (tests/db/run-tracking.test.ts); тут — що список показує отримане
    const markup = html(
      await renderList([run("r1", "Apartment 12", "in_progress", "2026-10-20T10:00:00Z", "tpl-move")], done("r1", 2, 5)),
    );

    expect(markup).toContain("Apartment 12");
    expect(markup).toContain("2 of 5 done");
  });
});
