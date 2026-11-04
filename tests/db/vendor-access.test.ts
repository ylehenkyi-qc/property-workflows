import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

// Роль vendor (зовнішній підрядник) живе в Postgres: launch_run і list_assignable_users. Перевіряємо на PGlite без Docker.
// Кожен тест — нова база; відмовний тест перевіряє і відмову, і що дані не змінились.
const SEED = "a0000000-0000-4000-8000-000000000001"; // «Tenant move-in», версія 1, 5 задач
const ADMIN = "admin@example.test";
const A = "manager1@example.test"; // менеджер A, запускає шаблон
const B = "manager2@example.test"; // менеджер B
const V1 = "vendor1@example.test"; // вендор V
const V2 = "vendor2@example.test";

let t: TestDb;
let u: Record<string, string>;

beforeEach(async () => {
  t = await createTestDb();
  u = t.users;
});
afterEach(async () => {
  await t.close();
});

// Задачі знімка версії 1 у порядку «секція за позицією, задача за позицією» (задачі 1…5).
async function orderedVersionTasks(): Promise<{ id: string; name: string }[]> {
  return t.asService<{ id: string; name: string }>(
    `select vt.id, vt.name from public.template_version_tasks vt
     join public.template_version_sections vs on vs.id = vt.section_id
     join public.template_versions v on v.id = vt.version_id
     where v.template_id = $1 and v.version = 1
     order by vs.position, vt.position`,
    [SEED],
  );
}

const runCount = async () =>
  Number((await t.asService<{ n: string }>("select count(*) as n from public.runs"))[0].n);

describe("підрядник у запуску", () => {
  it("AC-VENDOR-01: менеджер призначає вендора виконавцем задач 3 і 4, решта задач лишається на менеджері", async () => {
    const tasks = await orderedVersionTasks();
    expect(tasks).toHaveLength(5);
    const assignments = [tasks[2], tasks[3]].map((task) => ({ template_task_id: task.id, assignee_id: u[V1] }));

    const [row] = await t.asUser<{ id: string }>(u[A], "select public.launch_run($1::uuid, $2, $3::jsonb) as id", [
      SEED,
      "Apartment 12, move-in",
      JSON.stringify(assignments),
    ]);

    const rows = await t.asService<{ name: string; assignee_id: string }>(
      "select name, assignee_id from public.run_tasks where run_id = $1",
      [row.id],
    );
    const assigneeOf = Object.fromEntries(rows.map((r) => [r.name, r.assignee_id]));
    expect(rows).toHaveLength(5);
    expect(assigneeOf[tasks[2].name]).toBe(u[V1]);
    expect(assigneeOf[tasks[3].name]).toBe(u[V1]);
    for (const i of [0, 1, 4]) expect(assigneeOf[tasks[i].name]).toBe(u[A]);
  });

  it("AC-VENDOR-09: вендор напряму викликає launch_run — відмова, запуск не створено, список запусків не змінився", async () => {
    const tasks = await orderedVersionTasks();
    const assignments = [{ template_task_id: tasks[0].id, assignee_id: u[V1] }];
    const before = await runCount();

    await expect(
      t.asUser(u[V1], "select public.launch_run($1::uuid, $2, $3::jsonb)", [
        SEED,
        "Apartment 12, move-in",
        JSON.stringify(assignments),
      ]),
    ).rejects.toThrow("Not authorized");

    expect(await runCount()).toBe(before);
    expect(await t.asService("select id from public.runs where manager_id = $1", [u[V1]])).toHaveLength(0);
  });
});

describe("вибір виконавця з підрядниками", () => {
  it("AC-VENDOR-02: менеджер бачить лише id й email менеджера B, адміністратора й вендорів, без імен і ролей", async () => {
    const rows = await t.asUser<Record<string, unknown>>(u[A], "select * from public.list_assignable_users()");

    const emails = rows.map((r) => r.email);
    expect(emails).toContain(B);
    expect(emails).toContain(ADMIN);
    expect(emails).toContain(V1);
    expect(emails).toContain(V2);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["email", "id"]);
  });

  it("вендор не бачить email інших користувачів: вибір виконавця повертає порожній результат", async () => {
    const rows = await t.asUser(u[V1], "select * from public.list_assignable_users()");

    expect(rows).toHaveLength(0);
  });
});

// Читання вендора: лише свої запуски й задачі. Дані: A запускає «Apartment 12, move-in» з V на задачах 3 і 4
// та «Apartment 14, repair» без призначень вендору.
const TEMPLATE_TABLES = [
  "templates",
  "template_sections",
  "template_tasks",
  "template_versions",
  "template_version_sections",
  "template_version_tasks",
  "template_drafts",
] as const;

async function launchAs(userId: string, caseName: string, assignments: { template_task_id: string; assignee_id: string }[]) {
  const [row] = await t.asUser<{ id: string }>(userId, "select public.launch_run($1::uuid, $2, $3::jsonb) as id", [
    SEED,
    caseName,
    JSON.stringify(assignments),
  ]);
  return row.id;
}

async function setupVendorRuns() {
  const tasks = await orderedVersionTasks();
  const run12 = await launchAs(
    u[A],
    "Apartment 12, move-in",
    [tasks[2], tasks[3]].map((task) => ({ template_task_id: task.id, assignee_id: u[V1] })),
  );
  const run14 = await launchAs(u[A], "Apartment 14, repair", []);
  // Дані самі існують: 5 задач у кожному запуску, 3 і 4 запуску 12 — на V.
  const all = await t.asService<{ name: string }>("select name from public.run_tasks where run_id = $1", [run12]);
  expect(all).toHaveLength(5);
  expect(await t.asService("select id from public.run_tasks where run_id = $1", [run14])).toHaveLength(5);
  return { tasks, run12, run14 };
}

const rowsOf = (userId: string, table: string) => t.asUser<Record<string, unknown>>(userId, `select * from public.${table}`);

describe("читання вендора", () => {
  it("AC-VENDOR-03: вендор бачить лише запуск, де має задачі, зі статусом запуску й лічильником лише своїх задач", async () => {
    await setupVendorRuns();

    const rows = await t.asUser<Record<string, unknown>>(u[V1], "select * from public.list_vendor_runs()");

    expect(rows).toHaveLength(1);
    expect(rows[0].case_name).toBe("Apartment 12, move-in");
    expect(rows[0].status).toBe("in_progress");
    expect(Number(rows[0].tasks_total)).toBe(2);
    expect(Number(rows[0].tasks_done)).toBe(0);
    expect(rows.map((r) => r.case_name)).not.toContain("Apartment 14, repair");
  });

  it("AC-VENDOR-04: вендор читає рівно свої задачі 3 і 4 з секціями, без чужих задач, запусків, профілів і email", async () => {
    const { tasks, run12 } = await setupVendorRuns();

    const own = await t.asUser<{ name: string; required: boolean; status: string; section_id: string; run_id: string }>(
      u[V1],
      "select * from public.run_tasks",
    );
    expect(own.map((r) => r.name).sort()).toEqual([tasks[2].name, tasks[3].name].sort());
    for (const r of own) {
      expect(typeof r.required).toBe("boolean");
      expect(r.status).toBe("to_do");
      expect(r.run_id).toBe(run12);
    }
    for (const i of [0, 1, 4]) expect(own.map((r) => r.name)).not.toContain(tasks[i].name);

    // Назва секції кожної задачі — через run_sections; очікування з service_role.
    const expected = await t.asService<{ name: string; section: string }>(
      `select rt.name, rs.name as section from public.run_tasks rt
       join public.run_sections rs on rs.id = rt.section_id
       where rt.run_id = $1 and rt.name = any($2::text[])`,
      [run12, [tasks[2].name, tasks[3].name]],
    );
    expect(expected).toHaveLength(2);
    const joined = await t.asUser<{ name: string; section: string }>(
      u[V1],
      `select rt.name, rs.name as section from public.run_tasks rt
       join public.run_sections rs on rs.id = rt.section_id`,
    );
    expect([...joined].sort((a, b) => a.name.localeCompare(b.name))).toEqual(
      [...expected].sort((a, b) => a.name.localeCompare(b.name)),
    );

    // run_sections — лише секції, де є задачі V.
    const sections = await t.asUser<{ id: string; name: string }>(u[V1], "select id, name from public.run_sections");
    const ownSectionIds = new Set(own.map((r) => r.section_id));
    expect(sections.length).toBeGreaterThan(0);
    expect(new Set(sections.map((s) => s.id))).toEqual(ownSectionIds);

    // Рядки запуску (template_version, manager_id), чужі профілі й виконавці недоступні.
    expect(await rowsOf(u[V1], "runs")).toHaveLength(0);
    const profiles = await t.asUser<{ id: string }>(u[V1], "select id from public.profiles");
    expect(profiles.map((p) => p.id)).toEqual([u[V1]]);
    expect(await rowsOf(u[V1], "list_assignable_users()")).toHaveLength(0);
  });

  it("AC-VENDOR-06: запуск, де вендор без задач, недоступний за прямим id; контроль — свій запуск знаходиться", async () => {
    const { run12, run14 } = await setupVendorRuns();

    expect(await t.asUser(u[V1], "select * from public.run_tasks where run_id = $1", [run14])).toHaveLength(0);
    expect(await t.asUser(u[V1], "select * from public.run_sections where run_id = $1", [run14])).toHaveLength(0);
    expect(await t.asUser(u[V1], "select * from public.runs where id = $1", [run14])).toHaveLength(0);
    expect(await t.asUser(u[V1], "select * from public.list_vendor_runs($1::uuid)", [run14])).toHaveLength(0);

    const own = await t.asUser<{ id: string }>(u[V1], "select * from public.list_vendor_runs($1::uuid)", [run12]);
    expect(own).toHaveLength(1);
    expect(own[0].id).toBe(run12);
  });

  it("AC-VENDOR-08: шаблони для вендора порожні в усіх семи таблицях, адміністратору й менеджеру B вони доступні", async () => {
    await setupVendorRuns();

    for (const table of TEMPLATE_TABLES) {
      expect(await rowsOf(u[V1], table), `vendor ${table}`).toHaveLength(0);
      expect((await rowsOf(u[ADMIN], table)).length, `admin ${table}`).toBeGreaterThan(0);
    }
    const names = (await rowsOf(u[B], "templates")).map((r) => r.name);
    expect(names).toContain("Tenant move-in");
  });

  it("AC-VENDOR-10: вендор без задач бачить порожні списки запусків і задач", async () => {
    await setupVendorRuns();

    expect(await t.asUser(u[V2], "select * from public.list_vendor_runs()")).toHaveLength(0);
    expect(await rowsOf(u[V2], "run_tasks")).toHaveLength(0);
    expect(await rowsOf(u[V2], "runs")).toHaveLength(0);
  });

  it("менеджери й адміністратор читають запуск і задачі як раніше; list_vendor_runs для них порожній", async () => {
    const tasks = await orderedVersionTasks();
    const run = await launchAs(
      u[A],
      "Apartment 12, move-in",
      [
        { template_task_id: tasks[0].id, assignee_id: u[B] },
        { template_task_id: tasks[2].id, assignee_id: u[V1] },
      ],
    );

    for (const who of [A, ADMIN, B]) {
      const runs = await t.asUser<{ id: string }>(u[who], "select id from public.runs where id = $1", [run]);
      expect(runs, `${who} runs`).toHaveLength(1);
      const rows = await t.asUser(u[who], "select id from public.run_tasks where run_id = $1", [run]);
      expect(rows, `${who} tasks`).toHaveLength(5);
      expect(await t.asUser(u[who], "select * from public.list_vendor_runs()"), `${who} vendor runs`).toHaveLength(0);
    }
  });
});
